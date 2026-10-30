import { useEffect, useRef, useState } from "react";
import { Heart, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { isNativeIPhone, readAppleHealth } from "./apple-health";
import type { AppleHealthSummary } from "./apple-health";

export default function AppleHealthCard({ onRead, date }: { date?: string; onRead?: (summary: AppleHealthSummary | null) => void }) {
  const [summary, setSummary] = useState<AppleHealthSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requested, setRequested] = useState(false);
  const lastRequestedDate = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (requested && !busy && lastRequestedDate.current !== date) void sync(false);
  }, [date, requested, busy]);
  async function sync(requestAccess: boolean) {
    if (busy) return;
    lastRequestedDate.current = date;
    setBusy(true);
    setError("");
    try {
      const result = await readAppleHealth(requestAccess, date);
      
      setSummary(result);
      onRead?.(result);
      setRequested(true);
    } catch (error) {
      // Do not keep previously read data visible as if a failed refresh succeeded.
      setSummary(null);
      onRead?.(null);
      setError(error instanceof Error ? error.message : "读取失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  const empty =
    summary &&
    [summary.steps, summary.sleepHours, summary.weightKg, summary.heartRate, summary.hrv, summary.waterMl, summary.noise, summary.fitness].every(
      (v) => v === null,
    );
  return (
    <section className="card apple-health-card">
      <div className="card-heading">
        <span>
          <Heart size={20} />
          Apple 健康
        </span>
        <small>只读连接</small>
      </div>
      <p className="apple-health-description">
        申请读取本机支持的常规健康数据，你可以逐项选择允许。当前页面仅查询已接入的指标。
      </p>
      {summary && (
        <>
          <div className="apple-health-metrics">
            <div>
              <small>所选日步数</small>
              <b>
                {summary.steps === null
                  ? "—"
                  : Math.round(summary.steps).toLocaleString()}
                <em>步</em>
              </b>
            </div>
            <div>
              <small>所选日睡眠</small>
              <b>
                {summary.sleepHours === null
                  ? "—"
                  : summary.sleepHours.toFixed(1)}
                <em>小时</em>
              </b>
            </div>
            <div>
              <small>最近体重</small>
              <b>
                {summary.weightKg === null ? "—" : summary.weightKg.toFixed(1)}
                <em>kg</em>
              </b>
            </div>
          </div>
          <p className="apple-health-meta">
            来源：Apple 健康 · 读取于{" "}
            {new Date(summary.syncedAt).toLocaleString("zh-CN")}
          </p>
          {summary.weightDate && (
            <p className="apple-health-meta">
              体重记录于{" "}
              {new Date(summary.weightDate).toLocaleDateString("zh-CN")}
            </p>
          )}
          <p className="apple-health-meta">
            睡眠统计时段：{new Date(summary.sleepStart).toLocaleString("zh-CN")}{" "}
            至 {new Date(summary.sleepEnd).toLocaleString("zh-CN")}
          </p>
        </>
      )}
      {empty && (
        <p className="health-empty">
          暂未读到数据。可能没有对应记录，或尚未允许读取；请在系统「健康」中检查数据与权限。
        </p>
      )}
      {summary &&
        !empty &&
        [summary.steps, summary.sleepHours, summary.weightKg].some(
          (v) => v === null,
        ) && (
          <p className="health-empty">
            「—」表示未读到记录，可能无数据或未允许读取。
          </p>
        )}
      {summary?.warnings?.map((warning, index) => <p className="health-error" role="status" key={index}>{warning}（其他已读数据仍然显示）</p>)}
      {error && (
        <p className="health-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="wide-button"
        disabled={busy}
        onClick={() => void sync(!requested)}
      >
        {busy ? (
          <LoaderCircle size={16} className="spin" />
        ) : requested ? (
          <RefreshCw size={16} />
        ) : (
          <Heart size={16} />
        )}
        {busy ? "正在读取…" : requested ? "重新读取" : "连接 Apple 健康"}
      </button>
      {requested && (
        <button
          className="health-permission-button"
          disabled={busy}
          onClick={() => void sync(true)}
        >
          检查授权设置
        </button>
      )}
      <div className="health-local-note">
        <ShieldCheck size={13} />
        <span>读取结果仅在当前页面内存中展示，不上传后端或 AI</span>
      </div>
      {!isNativeIPhone() && (
        <p className="apple-health-meta">
          网页预览暂不可连接，需要安装 iPhone App。
        </p>
      )}
    </section>
  );
}
