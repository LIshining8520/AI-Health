import tempfile
from pathlib import Path
import unittest
from import_apple_health import parse_export, merged_hours


class AppleImportTest(unittest.TestCase):
    def test_merge_sources_units_and_duplicate(self):
        self.assertEqual(merged_hours([(0, 3600), (1800, 7200), (0, 3600)]), 2)
        def record(kind, value, unit, source='phone'):
            return f'<Record type="HKQuantityTypeIdentifier{kind}" value="{value}" unit="{unit}" sourceName="{source}" startDate="2026-10-28 08:00:00 +0800" endDate="2026-10-28 09:00:00 +0800"/>'
        step = record('StepCount', 100, 'count')
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'export.xml'
            path.write_text('<HealthData>' + step + step + record('StepCount', 150, 'count', 'watch') + record('BodyMass', 100, 'lb') + '<ActivitySummary dateComponents="2026-10-28" activeEnergyBurned="418.4" activeEnergyBurnedUnit="kJ" appleExerciseTime="45" appleStandHours="8"/>' + '<Workout workoutActivityType="HKWorkoutActivityTypeRunning" startDate="2026-10-28 08:00:00 +0800" endDate="2026-10-28 09:00:00 +0800" duration="3600" durationUnit="s" totalEnergyBurned="418.4" totalEnergyBurnedUnit="kJ">' + step + '</Workout></HealthData>')
            result = parse_export(path)
            self.assertEqual(result['recordCount'], 3)
            self.assertEqual(result['days'][0]['steps'], 150)
            self.assertAlmostEqual(result['days'][0]['weightKg'], 45.359237)
            self.assertIsNone(result['days'][0]['sleepHours'])
            self.assertEqual(result['days'][0]['workouts'][0]['type'], 'Running')
            self.assertEqual(result['days'][0]['workouts'][0]['minutes'], 60)
            self.assertAlmostEqual(result['days'][0]['workouts'][0]['kcal'], 100)
            self.assertAlmostEqual(result['days'][0]['fitness']['activeKcal'], 100)
            self.assertEqual(result['days'][0]['fitness']['exerciseMinutes'], 45)
            self.assertIsNone(result['days'][0]['fitness']['standGoal'])


if __name__ == '__main__':
    unittest.main()
