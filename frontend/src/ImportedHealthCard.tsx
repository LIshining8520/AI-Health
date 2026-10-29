import { useEffect, useState } from 'react';

type Day = { date: string; steps: number | null; stepSource: string | null; sleepHours: number | null; weightKg: number | null; heartRate: number | null };
type Snapshot = { days: Day[]; recordCount: number; exportedAt?: string; stepMethod?: string; sleepMethod?: string };
const format = (v: number | null | undefined, digits = 0) => v == null ? '—' : v.toLocaleString('zh-CN', { maximumFractionDigits: digits });

export default function ImportedHealthCard() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);
  console.log(data,'data>>>>>');
  
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/apple-health`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw Error(); return r.json(); })
      .then(setData).catch(e => { if (e.name !== 'AbortError') setError(true); });
    return () => controller.abort();
  }, []);
  if (error) return <section className="card apple-health-card"><p role="alert">无法读取本地导入数据，请确认后端已启动后刷新。</p></section>;
  if (!data?.days.length) return null;
  const rows = data.days.slice(-14).reverse();
  const weight = [...data.days].reverse().find(d => d.weightKg != null);
  return <section className="card apple-health-card">
    <div className="card-heading"><span>Apple 健康 · 本地导入</span><small>真实数据</small></div>
    <p className="apple-health-description">{data.days[0].date} 至 {data.days.at(-1)?.date} · {data.recordCount.toLocaleString()} 条指标记录</p>
    <p className="apple-health-meta">最近体重：{format(weight?.weightKg, 1)} kg {weight && `（${weight.date}）`}</p>
    <p className="apple-health-meta">导出时间：{data.exportedAt || '未知'} · 时区：上海</p>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 12, textAlign: 'right', borderSpacing: '0 12px' }}>
        <caption style={{ textAlign: 'left' }}>最近 14 个有记录的日期（非今日实时数据）</caption>
        <thead><tr><th scope="col">日期</th><th scope="col">步数</th><th scope="col">睡眠/h</th><th scope="col">体重/kg</th><th scope="col">心率均值</th></tr></thead>
        <tbody>{rows.map(d => <tr key={d.date}><th scope="row">{d.date}</th><td title={d.stepSource || ''}>{format(d.steps)}</td><td>{format(d.sleepHours, 1)}</td><td>{format(d.weightKg, 1)}</td><td>{format(d.heartRate, 1)}</td></tr>)}</tbody>
      </table>
    </div>
    <p className="apple-health-meta">— 表示该日期没有对应记录；心率单位为次/分，按样本计算算术平均。</p>
    <p className="apple-health-meta">{data.stepMethod}</p>
    <p className="apple-health-meta">{data.sleepMethod}</p>
    <p className="health-local-note">仅保存在本机；不发送到 AI。下方演示趋势不代表这份导入数据。</p>
  </section>;
}
