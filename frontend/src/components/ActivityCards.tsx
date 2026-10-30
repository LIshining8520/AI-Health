import { Moon, Dumbbell, Clock3, Activity, ArrowUp } from 'lucide-react';
import type { Dashboard } from '../types';

function Rings({ values, colors, label }: { values: (number | null)[]; colors: string[]; label: string }) {
  return <svg className="activity-rings" viewBox="0 0 100 100" role="img" aria-label={label}>
    {values.map((value, i) => {
      const radius = 42 - i * 12;
      const circumference = 2 * Math.PI * radius;
      return <g key={i} transform="rotate(-90 50 50)">
        <circle cx="50" cy="50" r={radius} fill="none" stroke={colors[i]} strokeWidth="10" opacity=".12" />
        {value != null && value > 0 && <circle cx="50" cy="50" r={radius} fill="none" stroke={colors[i]} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${Math.min(1, value) * circumference} ${circumference}`} strokeDashoffset={0}><title>{["活动", "锻炼", "站立"][i]}：{Math.round(value * 100)}%</title></circle>}
      </g>;
    })}
  </svg>;
}
const workoutNames: Record<string, string> = { Walking: "步行", Running: "跑步", Cycling: "骑行", Swimming: "游泳", Yoga: "瑜伽", Hiking: "徒步", TraditionalStrengthTraining: "力量训练", FunctionalStrengthTraining: "功能性力量训练", HighIntensityIntervalTraining: "高强度间歇训练", Dance: "舞蹈", Elliptical: "椭圆机", Rowing: "划船", Other: "其他训练" };
const progress = (value: number | null | undefined, goal: number | null | undefined) => value != null && goal != null && goal > 0 && Number.isFinite(value) && Number.isFinite(goal) ? Math.max(0, value / goal) : null;
const amount = (value: number | null | undefined) => value == null ? '—' : Math.round(value).toLocaleString('zh-CN');

export default function ActivityCards({ dashboard }: { dashboard: Dashboard | null }) {
  const sleep = dashboard?.sleep;
  const fitness = dashboard?.fitness;
  const minutes = sleep ? Math.round(sleep.hours * 60) : null;
  return <div className="activity-cards">
    <section className="card activity-summary sleep-summary">
      <div className="activity-heading"><Moon size={20} fill="currentColor" /><h3>睡眠</h3></div>
      <div className="activity-content">
        <div className="activity-stat"><span><Clock3 size={14} />睡眠时长</span><b>{minutes == null ? '—' : Math.floor(minutes / 60)}<small>小时</small>{minutes == null ? '—' : minutes % 60}<small>分钟</small></b></div>
        <div className="activity-stat"><span><Moon size={14} />睡眠质量</span><b>—</b></div>
        <Rings values={[null, null]} colors={['#a14cff', '#6486ff']} label="睡眠装饰圆环，暂无睡眠质量评分" />
      </div>
      <p className="activity-note">{sleep ? `${sleep.date} · Apple 健康 · 当日睡眠记录` : '暂无睡眠时长记录'} · 未提供质量评分</p>
    </section>
    <section className="card activity-summary fitness-summary">
      <div className="activity-heading"><Dumbbell size={20} /><h3>健身</h3></div>
      <div className="activity-content">
        <div className="activity-stat"><span><Activity size={14} />{fitness?.workoutOnly ? "训练消耗" : "活动"}</span><b>{amount(fitness?.activeKcal)}<small>千卡</small></b></div>
        <div className="activity-stat"><span><Dumbbell size={14} />{fitness?.workoutOnly ? "训练时长" : "锻炼"}</span><b>{amount(fitness?.exerciseMinutes)}<small>分钟</small></b></div>
        <div className="activity-stat"><span><ArrowUp size={14} />站立</span><b>{amount(fitness?.standHours)}<small>小时</small></b></div>
        <Rings values={[progress(fitness?.activeKcal, fitness?.activeGoal), progress(fitness?.exerciseMinutes, fitness?.exerciseGoal), progress(fitness?.standHours, fitness?.standGoal)]} colors={['#ff768f', '#ffac74', '#80c2ff']} label="活动、锻炼、站立目标完成进度，圆环最多显示一圈" />
      </div>
      {fitness?.goalDate && fitness.goalDate !== fitness.date && <p className="activity-note">目标沿用 {fitness.goalDate} 的健身记录</p>}
    </section>
    <section className="card activity-summary">
      <div className="activity-heading"><Dumbbell size={20} /><h3>体能训练</h3></div>
      {dashboard?.workouts?.length ? dashboard.workouts.map((workout, index) => (
        <div className="workout-record" key={`${workout.start}-${index}`}>
          <div><b>{workoutNames[workout.type] || workout.type}</b><span>{new Date(workout.start).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' })} · {workout.source}</span></div>
          <div><b>{Math.round(workout.minutes)}<small> 分钟</small></b><span>{workout.kcal == null ? '消耗未记录' : `${Math.round(workout.kcal)} 千卡`}</span></div>
        </div>
      )) : <p className="activity-note">所选日期暂无可读取的体能训练记录；步数不会自动生成训练。</p>}
      <p className="activity-note">按训练开始日期归档 · 与活动圆环汇总分开展示</p>
    </section>
  </div>;
}
