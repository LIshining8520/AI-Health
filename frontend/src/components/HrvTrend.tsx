import { useState } from "react";
import { Activity } from "lucide-react";

export default function HrvTrend({ history, date }: { history: { at: string; value: number }[]; date: string }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const start = Date.parse(`${date}T00:00:00+08:00`);
  const end = start + 86400000;
  const timeLabel = (at: string | number) => new Date(at).toLocaleTimeString("zh-CN", {
    timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const rows = history.filter(row => {
    const time = Date.parse(row.at);
    return time >= start && time < end && Number.isFinite(row.value) && row.value > 0;
  }).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).map((row, index) => ({ ...row, id: `${row.at}-${index}` }));
  const selected = rows.find(row => row.id === selectedDate);
  const values = rows.map(row => row.value);
  const low = Math.max(0, Math.floor(Math.min(...values, 1e6) - 5));
  const high = Math.ceil(Math.max(...values, low + 1) + 5);
  const x = (at: string) => 15 + (Date.parse(at) - start) / (end - start) * 258;
  const y = (value: number) => 100 - (value - low) / (high - low) * 80;
  const points = rows.map(row => `${x(row.at)},${y(row.value)}`).join(" ");
  return <section className="card trend-card hrv-trend-card">
    <div className="card-heading">
      <span><Activity size={21} />HRV 趋势</span><span className="trend-unit">SDNN · ms</span>
    </div>
    {rows.length ? <>
      <div className="trend-summary"><div><span>当日平均</span><strong>{(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)}<small>ms</small></strong></div><span className="trend-record-count">{rows.length} 次测量 · {date}</span></div>
      <div className="trend-chart">
        <div className="y-labels"><span>{high}</span><span>{((high + low) / 2).toFixed(1)}</span><span>{low}</span></div>
        <svg viewBox="0 0 290 125" role="img" aria-label={`HRV 当天测量趋势，${rows.length} 条记录，单位毫秒`}>
          <defs><linearGradient id="hrvTrendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b8a4d6" stopOpacity=".3" /><stop offset="100%" stopColor="#b8a4d6" stopOpacity="0" /></linearGradient></defs>
          {rows.length > 1 && <polygon points={`${x(rows[0].at)},112 ${points} ${x(rows.at(-1)!.at)},112`} fill="url(#hrvTrendFill)" />}
          {[20, 60, 100].map(value => <line key={value} x1="15" y1={value} x2="273" y2={value} className="grid-line" />)}
          <polyline points={points} fill="none" stroke="#7b68a7" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
          {rows.map(row => <g key={row.id} className="weight-trend-node" role="button" tabIndex={0}
            aria-label={`${timeLabel(row.at)}，HRV ${row.value.toFixed(1)} ms`} aria-pressed={selectedDate === row.id}
            style={{ cursor: "pointer" }} onClick={() => setSelectedDate(row.id)}
            onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedDate(row.id); } }}>
            <circle cx={x(row.at)} cy={y(row.value)} r={12} fill="transparent" />
            <circle cx={x(row.at)} cy={y(row.value)} r={selectedDate === row.id ? 6 : 4} fill="#7b68a7" stroke="white" strokeWidth={1.5} />
            <title>{timeLabel(row.at)} · {row.value.toFixed(1)} ms</title>
          </g>)}
          {selected && <g pointerEvents="none" transform={`translate(${Math.max(58, Math.min(232, x(selected.at)))},${y(selected.value) < 45 ? y(selected.value) + 12 : y(selected.value) - 44})`}>
            <rect x={-55} width={110} height={36} rx={6} fill="#7b68a7" />
            <text textAnchor="middle" y={14} fill="white" fontSize={10}>{timeLabel(selected.at)}</text>
            <text textAnchor="middle" y={29} fill="white" fontSize={12} fontWeight={600}>{selected.value.toFixed(1)} ms</text>
          </g>}
        </svg>
      </div>
      <div className="chart-labels">{[start, (start + end) / 2, end - 1000].map((time, i) => <span key={i}>{timeLabel(time)}</span>)}</div>
      <p className="chart-caption" role="status">{selected ? `${timeLabel(selected.at)} · HRV ${selected.value.toFixed(1)} ms` : "点击节点查看测量时间及 HRV"}</p>
      <p className="chart-caption">{date} · {rows.length} 条测量记录 · 上海时间 · SDNN（ms）</p>
      <p className="chart-caption">按测量开始时间展示当天原始样本，非连续实时监测；无记录时段不补值。{rows.length === 1 ? "当天仅有一个测量点。" : ""}</p>
    </> : <p className="health-empty">所选日期暂无 HRV 记录，请检查 Apple 健康中的数据与授权。</p>}
  </section>;
}
