import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Droplet,
  Ear,
  Footprints,
  Heart,
  Moon,
  Plus,
  TrendingUp,
  Weight,
} from "lucide-react";
import HrvTrend from "../components/HrvTrend";
import HealthCalendar from "../components/HealthCalendar";
import { isNativeIPhone } from "../apple-health";
import type { AppleHealthSummary } from "../apple-health";
import ActivityCards from "../components/ActivityCards";
import ImportedHealthCard from "../ImportedHealthCard";
import AppleHealthCard from "../AppleHealthCard";
import IconBubble from "../components/IconBubble";
import type { Dashboard } from "../types";



interface HealthPageProps {
  dashboard: Dashboard | null;
  nativeSummary: AppleHealthSummary | null;
  healthEnabled: boolean;
  healthBusy: boolean;
  healthError: string;
  date: string;
  onDateChange: (date: string) => void;
  saving: boolean;
  onAddWater: () => void;
  onRecordWeight: () => void;
}
export default function HealthPage({
  dashboard: remoteDashboard,
  nativeSummary,
  healthEnabled,
  healthBusy,
  healthError,
  date,
  onDateChange,
  saving,
  onAddWater,
  onRecordWeight,
}: HealthPageProps) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [selectedPointDate, setSelectedPointDate] = useState<string | null>(null);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
  const native = isNativeIPhone();
  const readDate = nativeSummary?.dataDate;
  const weightHistory = nativeSummary?.weightHistory ?? [];
  const dashboard: Dashboard | null = native ? {
    water: date === readDate ? nativeSummary?.waterMl ?? 0 : 0, weight: nativeSummary?.weightKg ?? null, weightHistory, records: [],
    workouts: date === readDate ? nativeSummary?.workouts ?? [] : [],
    hrvHistory: date === readDate ? nativeSummary?.hrvHistory ?? [] : [],
    hrv: date === readDate && nativeSummary?.hrv ? { date, ...nativeSummary.hrv } : null,
    heartRate: date === readDate && nativeSummary?.heartRate != null ? { date, value: nativeSummary.heartRate } : null,
    noise: date === readDate && nativeSummary?.noise ? { date, ...nativeSummary.noise } : null,
    fitness: date === readDate && nativeSummary?.fitness ? { date, ...nativeSummary.fitness } : null,
    steps: date === readDate ? nativeSummary?.steps : null,
    sleep: date === readDate && nativeSummary?.sleepHours != null ? { date, hours: nativeSummary.sleepHours } : null,
  } : remoteDashboard;
  const canRecord = date === today && !native;
  const water = dashboard?.water ?? 0;
  const history = dashboard?.weightHistory ?? [];
  const latest = history.at(-1);
  const weight = latest?.value;
  const end = Date.parse(`${latest?.date ?? date}T00:00:00Z`);
  const start = end - (period === "week" ? 6 : 29) * 86400000;
  const trend = history.filter(row => Date.parse(`${row.date}T00:00:00Z`) >= start);
  const selected = trend.find(row => row.date === selectedPointDate);
  const values = trend.map(row => row.value);
  const low = Math.floor(Math.min(...values, weight ?? 60) - 0.5);
  const high = Math.ceil(Math.max(...values, weight ?? 60) + 0.5);
  const x = (date: string) => 15 + (Date.parse(`${date}T00:00:00Z`) - start) / Math.max(86400000, end - start) * 258;
  const y = (value: number) => 100 - ((value - low) / (high - low)) * 80;
  const points = trend.map(row => `${x(row.date)},${y(row.value)}`).join(" ");
  const labels = [start, (start + end) / 2, end].map(time => new Date(time).toISOString().slice(5, 10));
  return (
    <>
      <header className="page-header">
        <div>
          <h2>{date === today ? "今天" : date}</h2>
          <p>按日期查看你的健康记录</p>
        </div>
        <span className="header-spark">
          <Heart size={23} strokeWidth={1.5} />
        </span>
      </header>
      <HealthCalendar date={date} onChange={value => { setSelectedPointDate(null); onDateChange(value); }} />
      <p className="demo-section-label" role="status">{date} · {dashboard ? "当日记录 · — 表示无数据" : "正在加载当日数据…"}</p>
      <ActivityCards dashboard={dashboard} />
      <div className="metric-grid heart-noise-grid">
      <section className="card metric-card">
        <div className="metric-title">
          <IconBubble icon={Heart} />
          <span>心率</span>
        </div>
        <p className="metric-hint">平均心率</p>
        <div className="metric-value" aria-label="平均心率">
          {dashboard?.heartRate ? dashboard.heartRate.value.toFixed(1) : "—"}
          <small>次/分</small>
        </div>
        <p className="metric-hint">
          {dashboard?.heartRate ? `${dashboard.heartRate.date} · Apple 健康 · 当日平均心率` : "暂无心率记录"}
        </p>
        <p className="apple-health-meta">所选日期的样本均值，非实时心率</p>
      </section>
         <section className="card metric-card ">
        <div className="metric-title"><IconBubble icon={Activity} color="mint" /><span>HRV · 心率变异性</span></div>
        <p className="metric-hint">所选日最近测量 · SDNN</p>
        <div className="metric-value" aria-label="最近一次 HRV">
          {dashboard?.hrv ? dashboard.hrv.value.toFixed(1) : "—"}<small>ms</small>
        </div>
        <p className="metric-hint">{dashboard?.hrv ? `当日平均 ${dashboard.hrv.average.toFixed(1)} ms` : "暂无 HRV 数据"}</p>
        <p className="apple-health-meta">{dashboard?.hrv ? `${new Date(dashboard.hrv.at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}（上海时间）· Apple 健康 · 非实时测量` : "需要设备记录并允许读取心率变异性"}</p>
      </section>
      </div>

      <div className="metric-grid">
            <section className="card metric-card noise-card">
        <div className="metric-title">
          <IconBubble icon={Ear} color="noise" />
          <span>环境噪音</span>
        </div>
        <p className="metric-hint">最近测量</p>
        <div className="metric-value">
          {dashboard?.noise ? dashboard.noise.value.toFixed(1) : "—"}
          <small>dB(A)</small>
        </div>
        <p className="metric-hint">{dashboard?.noise ? `${dashboard.noise.date} · Apple 健康` : "暂无环境噪音记录"}</p>
        <p className="apple-health-meta">{dashboard?.noise ? new Date(dashboard.noise.at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" }) + "（上海时间）· 非实时测量" : "导入记录后显示测量值"}</p>
      </section>

        <section className="card metric-card">
          <div className="metric-title">
            <IconBubble icon={Droplet} />
            <span>饮水</span>
          </div>
          <div className="metric-value">
            {native && (date !== readDate || nativeSummary?.waterMl == null) ? "—" : water.toLocaleString()}
            <small>mL</small>
          </div>
          <div className="water-bars" aria-label={`已记录饮水 ${water} 毫升`}>
            {Array.from({ length: 16 }, (_, i) => (
              <i
                className={
                  i < Math.min(16, Math.round(water / 125)) ? "filled" : ""
                }
                key={i}
              />
            ))}
          </div>
          <button
            className="subtle-button"
            disabled={saving || !canRecord}
            onClick={onAddWater}
          >
            <Plus size={16} />
            记录 250 mL
          </button>
        </section>
        <section className="card metric-card">
          <div className="metric-title">
            <IconBubble icon={Weight} color="mint" />
            <span>最近体重</span>
          </div>
          <div className="metric-value">
            {weight == null ? "—" : weight.toFixed(1)}
            <small>kg</small>
          </div>
          <p className="metric-hint">
            {latest ? `${latest.date} · ${latest.source}` : "暂无体重记录"}
          </p>
          <button className="text-button" disabled={!canRecord} onClick={onRecordWeight}>
            记录体重
            <ArrowUpRight size={14} />
          </button>
        </section>
        <section className="card metric-card" >
        <div className="metric-title"><IconBubble icon={Footprints} color="mint" /><span>步数</span></div>
        <div className="metric-value">{dashboard?.steps == null ? "—" : Math.round(dashboard.steps).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}<small>步</small></div>
        <p className="metric-hint">{date} · Apple 健康 · 每日最大单一来源</p>
      </section>
      </div>
      <HrvTrend history={dashboard?.hrvHistory ?? []} date={date} />
      <section className="card trend-card">
        <div className="card-heading">
          <span>
            <TrendingUp size={21} />
            体重趋势
          </span>
          <div className="segmented">
            {(["week", "month"] as const).map(value => (
              <button key={value} className={period === value ? "active" : ""}
                onClick={() => { setPeriod(value); setSelectedPointDate(null); }}>
                {value === "week" ? "周" : "月"}
              </button>
            ))}
          </div>
        </div>
        {trend.length > 0 ? <>
        <div className="trend-chart">
          <div className="y-labels">
            <span>{high}</span>
            <span>{((high + low) / 2).toFixed(1)}</span>
            <span>{low}</span>
          </div>
          <svg viewBox="0 0 290 125" role="img" aria-label={`${period === "week" ? "周" : "月"}体重趋势，${trend.length} 个真实测量点`}>
            <defs>
              <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8ac4b1" stopOpacity=".5" />
                <stop offset="100%" stopColor="#8ac4b1" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[20, 60, 100].map((y) => (
              <line
                key={y}
                x1="15"
                y1={y}
                x2="273"
                y2={y}
                className="grid-line"
              />
            ))}
            {trend.length > 1 && <polygon points={`${x(trend[0].date)},112 ${points} ${x(trend.at(-1)!.date)},112`} fill="url(#area)" />}
            <polyline
              points={points}
              fill="none"
              stroke="#064548"
              strokeWidth="2.3"
              strokeLinejoin="round"
            />
            {trend.map(row => (
              <g key={row.date} className="weight-trend-node" role="button" tabIndex={0}
                aria-label={`${row.date}，体重 ${row.value.toFixed(2)} kg`}
                aria-pressed={selectedPointDate === row.date}
                style={{ cursor: "pointer" }}
                onClick={() => setSelectedPointDate(row.date)}
                onKeyDown={event => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedPointDate(row.date);
                  }
                }}>
                <circle cx={x(row.date)} cy={y(row.value)} r={12} fill="transparent" />
                <circle cx={x(row.date)} cy={y(row.value)} r={selectedPointDate === row.date ? 6 : 4} fill="#064548" stroke="white" strokeWidth={1.5} />
                <title>{row.date} · {row.value.toFixed(2)} kg · {row.source}</title>
              </g>
            ))}
            {selected && (
              <g pointerEvents="none" transform={`translate(${Math.max(58, Math.min(232, x(selected.date)))},${y(selected.value) < 45 ? y(selected.value) + 12 : y(selected.value) - 44})`}>
                <rect x={-55} width={110} height={36} rx={6} fill="#064548" />
                <text textAnchor="middle" y={14} fill="white" fontSize={10}>{selected.date}</text>
                <text textAnchor="middle" y={29} fill="white" fontSize={12} fontWeight={600}>{selected.value.toFixed(2)} kg</text>
              </g>
            )}
          </svg>
        </div>
        <div className="chart-labels">
          {labels.map((label, i) => <span key={i}>{label}</span>)}
        </div>
        <p className="chart-caption" role="status">{selected ? `${selected.date} · ${selected.value.toFixed(2)} kg · ${selected.source}` : "点击节点查看该次体重"}</p>
        <p className="chart-caption">{`截至最近测量日 ${latest?.date} 的${period === "week" ? "7" : "30"}天`} · {trend.length} 个记录日 · kg</p>
        <p className="chart-caption">同一天取最近一次测量，缺失日期不补值；连线表示测量点之间的变化。{trend.length === 1 ? "当前仅有一个测量点。" : ""}</p>
        </> : <p className="health-empty">暂无体重数据，请导入 Apple 健康记录或记录体重。</p>}
      </section>

      {!native && <details style={{ marginTop: 20 }}><summary>数据来源与连接</summary><ImportedHealthCard />{!native && <AppleHealthCard />}</details>}
      {!canRecord && <p className="chart-caption">历史日期仅供查看，新增记录请切换到今天。</p>}
    </>
  );
}
