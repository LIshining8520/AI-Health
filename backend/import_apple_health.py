"""Stream an Apple Health XML export into a local, aggregated JSON snapshot."""
import argparse
from collections import defaultdict
from datetime import datetime
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo

ZONE = ZoneInfo('Asia/Shanghai')
TYPES = {f'HKQuantityTypeIdentifier{k}': k for k in ('StepCount', 'BodyMass', 'HeartRate')}
TYPES['HKQuantityTypeIdentifierHeartRateVariabilitySDNN'] = 'HRV'
TYPES['HKQuantityTypeIdentifierEnvironmentalAudioExposure'] = 'Noise'
TYPES['HKCategoryTypeIdentifierSleepAnalysis'] = 'Sleep'


def merged_hours(intervals):
    total = 0
    end = None
    for start, stop in sorted(set(intervals)):
        total += max(0, stop - max(start, end if end is not None else start))
        end = max(stop, end if end is not None else stop)
    return total / 3600


def parse_export(path):
    steps = defaultdict(lambda: defaultdict(float))
    sleep = defaultdict(list)
    hearts = defaultdict(lambda: [0., 0])
    weights = {}
    workouts = defaultdict(list)
    fitness = {}
    noise = {}
    hrv = {}
    hrv_samples = defaultdict(list)
    seen = set()
    count = 0
    exported = None
    stack = []
    for event, element in ET.iterparse(path, events=('start', 'end')):
        if event == 'start':
            stack.append(element)
            continue
        a = element.attrib
        if len(stack) == 2 and element.tag == 'ExportDate':
            exported = a.get('value')
        if len(stack) == 2 and element.tag == 'Workout':
            start = datetime.strptime(a['startDate'], '%Y-%m-%d %H:%M:%S %z').astimezone(ZONE)
            end = datetime.strptime(a['endDate'], '%Y-%m-%d %H:%M:%S %z').astimezone(ZONE)
            duration = float(a.get('duration', 0))
            unit = a.get('durationUnit')
            minutes = duration * {'min': 1, 's': 1 / 60, 'hr': 60}.get(unit, 0)
            if unit not in ('min', 's', 'hr'):
                minutes = (end - start).total_seconds() / 60
            kcal = float(a['totalEnergyBurned']) if a.get('totalEnergyBurned') else None
            if kcal is not None:
                kcal = kcal / 4.184 if a.get('totalEnergyBurnedUnit') == 'kJ' else kcal if a.get('totalEnergyBurnedUnit') in ('Cal', 'kcal') else None
            if math.isfinite(minutes) and minutes >= 0 and (kcal is None or math.isfinite(kcal) and kcal >= 0):
                workouts[start.date().isoformat()].append({'type': a.get('workoutActivityType', 'Other').removeprefix('HKWorkoutActivityType'), 'start': start.isoformat(), 'end': end.isoformat(), 'minutes': minutes, 'kcal': kcal, 'source': a.get('sourceName', 'Apple 健康')})
        if len(stack) == 2 and element.tag == 'ActivitySummary':
            fields = {'activeKcal': 'activeEnergyBurned', 'activeGoal': 'activeEnergyBurnedGoal',
                      'exerciseMinutes': 'appleExerciseTime', 'exerciseGoal': 'appleExerciseTimeGoal',
                      'standHours': 'appleStandHours', 'standGoal': 'appleStandHoursGoal'}
            item = {}
            for key, attr in fields.items():
                value = float(a[attr]) if attr in a else None
                item[key] = value if value is not None and math.isfinite(value) and value >= 0 else None
            unit = a.get('activeEnergyBurnedUnit')
            if unit == 'kJ':
                for key in ('activeKcal', 'activeGoal'):
                    if item[key] is not None:
                        item[key] /= 4.184
            elif unit not in ('Cal', 'kcal'):
                item['activeKcal'] = item['activeGoal'] = None
            fitness[a['dateComponents']] = item
        if len(stack) == 2 and element.tag == 'Record'  and a.get('type') in TYPES:
            kind = TYPES[a['type']]
            start = datetime.strptime(a['startDate'], '%Y-%m-%d %H:%M:%S %z').astimezone(ZONE)
            end = datetime.strptime(a['endDate'], '%Y-%m-%d %H:%M:%S %z').astimezone(ZONE)
            value = a['value']
            # Only deduplicate retained metrics; never retain the full XML tree.
            key = (kind, a.get('sourceName'), a['startDate'], a['endDate'], value, a.get('unit'))
            if key not in seen:
                seen.add(key)
                count += 1
                day = start.date().isoformat()
                if kind == 'Sleep':
                    if value in ('HKCategoryValueSleepAnalysisAsleep', 'HKCategoryValueSleepAnalysisAsleepUnspecified', 'HKCategoryValueSleepAnalysisAsleepCore', 'HKCategoryValueSleepAnalysisAsleepDeep', 'HKCategoryValueSleepAnalysisAsleepREM', '1', '3', '4', '5'):
                        # Assign overnight sleep to its waking date; merge sources/stages.
                        sleep[end.date().isoformat()].append((start.timestamp(), end.timestamp()))
                else:
                    number = float(value)
                    if math.isfinite(number) and number >= 0:
                        unit = a.get('unit')
                        if kind == 'StepCount' and unit == 'count':
                            steps[day][a.get('sourceName', '未知来源')] += number
                        elif kind == 'BodyMass' and unit in ('kg', 'lb', 'g'):
                            kg = number * {'kg': 1, 'lb': .45359237, 'g': .001}[unit]
                            if 0 < kg <= 500 and (day not in weights or end.isoformat() > weights[day]['at']):
                                weights[day] = {'kg': kg, 'at': end.isoformat()}
                        elif kind == 'Noise' and unit == 'dBASPL':
                            if day not in noise or end.isoformat() > noise[day]['at']:
                                noise[day] = {'value': number, 'at': end.isoformat()}
                        elif kind == 'HRV' and unit in ('ms', 's') and number > 0:
                            value_ms = number * (1000 if unit == 's' else 1)
                            hrv_samples[day].append({'at': start.isoformat(), 'value': value_ms})
                            item = hrv.setdefault(day, {'value': value_ms, 'at': end.isoformat(), 'total': 0., 'count': 0})
                            item['total'] += value_ms
                            item['count'] += 1
                            if end.isoformat() >= item['at']:
                                item.update(value=value_ms, at=end.isoformat())
                        elif kind == 'HeartRate' and unit == 'count/min':
                            hearts[day][0] += number
                            hearts[day][1] += 1
        stack.pop()
        if stack:
            stack[-1].remove(element)
        element.clear()
    days = sorted(set(steps) | set(sleep) | set(hearts) | set(weights) | set(fitness) | set(noise) | set(workouts) | set(hrv))
    rows = []
    for day in days:
        source = max(steps[day], key=steps[day].get) if steps[day] else None
        rows.append({'date': day, 'steps': round(steps[day][source]) if source else None,
                     'stepSource': source, 'sleepHours': round(merged_hours(sleep[day]), 2) if sleep[day] else None,
                     'hrvHistory': sorted(hrv_samples[day], key=lambda item: item['at']),
                     'hrv': {k: hrv[day][k] for k in ('value', 'at')} | {'average': hrv[day]['total'] / hrv[day]['count']} if day in hrv else None,
                     'weightKg': weights.get(day, {}).get('kg'), 'fitness': fitness.get(day), 'workouts': sorted(workouts[day], key=lambda w: w['start'], reverse=True), 'noise': noise.get(day),
                     'heartRate': round(hearts[day][0] / hearts[day][1], 1) if hearts[day][1] else None})
    return {'exportedAt': exported, 'importedAt': datetime.now(ZONE).isoformat(),
            'recordCount': count, 'timezone': str(ZONE), 'days': rows,
            'stepMethod': '每日选取步数总量最大的单一来源，不叠加设备；与 Apple 健康合并结果可能不同。',
            'sleepMethod': '按睡眠片段结束日期归档，合并重叠阶段和来源；不含卧床与清醒。'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('xml', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).parent / 'data' / 'apple-health.json')
    args = parser.parse_args()
    result = parse_export(args.xml)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    temporary.replace(args.output)
    print(f"Imported {result['recordCount']} metric records across {len(result['days'])} days.")
