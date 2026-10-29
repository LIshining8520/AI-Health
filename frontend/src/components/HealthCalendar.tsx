import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function HealthCalendar({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  const selected = Date.parse(`${date}T00:00:00Z`);
  const monday = selected - ((new Date(selected).getUTCDay() + 6) % 7) * 86400000;
  const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
  return <section className="health-calendar" aria-label="健康数据日历">
    <div className="calendar-toolbar">
      <button aria-label="上一周" onClick={() => onChange(iso(selected - 7 * 86400000))}><ChevronLeft size={18} /></button>
      <input aria-label="选择健康数据日期" type="date" value={date} max={today} onChange={e => { if (e.target.value && e.target.value <= today) onChange(e.target.value); }} />
      <button aria-label="下一周" disabled={iso(monday + 7 * 86400000) > today} onClick={() => onChange(iso(Math.min(selected + 7 * 86400000, Date.parse(`${today}T00:00:00Z`))))}><ChevronRight size={18} /></button>
      <button className="calendar-today" onClick={() => onChange(today)}>今天</button>
    </div>
    <div className="calendar-week">
      {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((day, i) => {
        const value = iso(monday + i * 86400000);
        return <button key={value} aria-label={value} aria-pressed={date === value} disabled={value > today} onClick={() => onChange(value)}><small>{day}</small><span>{Number(value.slice(-2))}</span></button>;
      })}
    </div>
  </section>;
}
