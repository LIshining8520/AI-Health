import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  Check,
  ChartPie,
  HelpCircle,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Weight,
  X,
} from "lucide-react";
import type { AppleHealthSummary } from "./apple-health";
import { exportAppleHealthData, hasReadableHealthData, addAppleHealthWeight, addAppleHealthWater, isNativeIPhone, readAppleHealth } from "./apple-health";
import { clearStoredAvatar, prepareAvatar, readStoredAvatar, storeAvatar } from "./avatar";
import IconBubble from "./components/IconBubble";
import ChatPage, { ChatComposer } from "./pages/ChatPage";
import HealthPage from "./pages/HealthPage";
import MinePage from "./pages/MinePage";
import type { Dashboard, Message } from "./types";

type Tab = "chat" | "health" | "mine";
const initialMessages: Message[] = [
  { role: "assistant", text: "你好，我是冷酸宁。可以和我聊聊健康习惯或一般健康问题。对话会发送到 AI 智能小助手。发送“分析今日健康数据”时，会自动读取当天健康摘要并交给 AI 智能小助手 分析。" },
];
const API = (isNativeIPhone() ? import.meta.env.VITE_MOBILE_API_BASE_URL : "") || import.meta.env.VITE_API_BASE_URL || "";
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(isNativeIPhone() && import.meta.env.VITE_MOBILE_CHAT_TOKEN ? { Authorization: `Bearer ${import.meta.env.VITE_MOBILE_CHAT_TOKEN}` } : {}), ...options?.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(typeof error?.detail === "string" ? error.detail : "服务暂时不可用，请稍后重试");
  }
  return response.json();
}
export default function App() {
  const [healthEnabled, setHealthEnabled] = useState(() => localStorage.getItem("zhikang-health-enabled") === "true");
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthError, setHealthError] = useState("");
  const lastReadDate = useRef<string | null>(null);
  const [nativeSummary, setNativeSummary] = useState<AppleHealthSummary | null>(null);
  const [healthDate, setHealthDate] = useState(() => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" }));
  const [tab, setTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [aiReady, setAiReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [connection, setConnection] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(() => isNativeIPhone() && localStorage.getItem("zhikang-health-enabled") !== "true" ? "health-onboarding" : "");
  const [value, setValue] = useState("62.0");
  const [saving, setSaving] = useState(false);
  const [reminder, setReminder] = useState(
    localStorage.getItem("zhikang-reminder") === "true",
  );
  const [name, setName] = useState(
    localStorage.getItem("zhikang-name") || "小林",
  );
  const [draftName, setDraftName] = useState(name);
  const [avatar, setAvatar] = useState(readStoredAvatar);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (isNativeIPhone()) return;
    const controller = new AbortController();
    setDashboard(null);
    setConnection("loading");
    request<Dashboard>(`/dashboard?date=${healthDate}`, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setDashboard(data);
        setConnection("ready");
      })
      .catch(() => { if (!controller.signal.aborted) setConnection("error"); });
    return () => controller.abort();
  }, [healthDate]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    if (messages.length > 3 || sending)
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);
  useEffect(() => {
    if (modal) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [modal]);
  useEffect(() => {
    request<{ configured: boolean }>("/ai/status").then(data => setAiReady(data.configured)).catch(() => setAiReady(false));
  }, []);
  useEffect(() => {
    if (!isNativeIPhone() || !healthEnabled) return;
    let active = true;
    let reading = false;
    async function refreshHealth() {
      if (!active || reading || document.visibilityState === "hidden") return;
      reading = true;
      setHealthBusy(true);
      setHealthError("");
      try {
        const result = await readAppleHealth(false, healthDate);
        if (active) {
          setNativeSummary(result); lastReadDate.current = healthDate;
          const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
          if (healthDate === today && !hasReadableHealthData(result)) setModal("health-onboarding");
        }
      } catch (error) {
        if (active) { setNativeSummary(null); setHealthError(error instanceof Error ? error.message : "健康数据读取失败"); setModal("health-onboarding"); }
      } finally { reading = false; if (active) setHealthBusy(false); }
    }
    const onVisible = () => { if (document.visibilityState === "visible") void refreshHealth(); };
    if (lastReadDate.current !== healthDate) void refreshHealth();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => { active = false; document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
  }, [healthEnabled, healthDate]);
  useEffect(() => {
    if (!isNativeIPhone()) return;
    const onVisible = () => {
      if (document.visibilityState === "visible" && !healthEnabled) setModal("health-onboarding");
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [healthEnabled]);
  async function connectHealthFromGuide() {
    if (healthBusy) return;
    setHealthBusy(true);
    setHealthError("");
    try {
      const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
      const result = await readAppleHealth(true, today);
      setNativeSummary(result);
      lastReadDate.current = today;
      localStorage.setItem("zhikang-health-enabled", "true");
      setHealthEnabled(true);
      if (hasReadableHealthData(result)) setModal("");
      else setHealthError("暂未读到健康数据，可能尚未授权或没有记录。请到「健康」App → 个人头像 → 隐私 → App → 冷酸宁，打开需要的数据读取开关，然后返回重试。");
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : "健康连接失败，请检查系统授权后重试。");
    } finally { setHealthBusy(false); }
  }
  async function toggleHealth() {
    if (healthBusy) return;
    if (healthEnabled) {
      localStorage.removeItem("zhikang-health-enabled");
      setHealthEnabled(false);
      setNativeSummary(null);
      lastReadDate.current = null;
      setHealthError("");
      return;
    }
    setHealthBusy(true);
    setHealthError("");
    try {
      const result = await readAppleHealth(true, healthDate);
      setNativeSummary(result);
      lastReadDate.current = healthDate;
      localStorage.setItem("zhikang-health-enabled", "true");
      setHealthEnabled(true);
    } catch (error) { setHealthError(error instanceof Error ? error.message : "健康连接失败"); }
    finally { setHealthBusy(false); }
  }
  async function analyzeToday(text: string) {
    if (sending) return;
    setInput("");
    setTab("chat");
    setSending(true);
    setMessages(items => [...items, { role: "user", text, report: true }]);
    try {
      let data: Record<string, unknown> | undefined;
      if (isNativeIPhone()) {
        if (!healthEnabled) throw new Error("请先在「我的 → 隐私与授权」开启 Apple 健康自动读取，再发送分析请求。");
        const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
        const fresh = await readAppleHealth(false, today);
        setNativeSummary(fresh);
        data = {
          "报告日期": fresh.dataDate, "来源": "手机 HealthKit 实时查询（不保证全天完整）",
          "步数": fresh.steps == null ? null : Math.round(fresh.steps), "睡眠小时": fresh.sleepHours,
          "睡眠统计开始": fresh.sleepStart, "睡眠统计结束": fresh.sleepEnd,
          "HRV（SDNN，ms，所选日最近值及均值，非实时）": fresh.hrv,
          "平均心率（次/分，非静息）": fresh.heartRate, "饮水（mL，已记录）": fresh.waterMl,
          "活动与目标": fresh.fitness, "环境噪音（dB(A)，最近一次）": fresh.noise,
          "最近体重（kg）": fresh.weightKg, "体重测量日期": fresh.weightDate,
          "当天训练（最多20条）": fresh.workouts.slice(0, 20), "读取提示": fresh.warnings || [],
        };
      }
      const result = await request<{ reply: string }>("/report/analyze", { method: "POST", body: JSON.stringify({ message: text, data }) });
      setMessages(items => [...items, { role: "assistant", text: result.reply, report: true }]);
    } catch (error) {
      setMessages(items => [...items, { role: "assistant", text: error instanceof Error ? error.message : "健康分析失败，请重试。", error: true }]);
    } finally { setSending(false); }
  }
  async function send(text = input) {
    if (!text.trim() || sending) return;
    if (/(今天|今日|当天)/.test(text) && /(健康|身体|报告)/.test(text) && /(分析|报告|总结|评估|解读|建议|怎么样|如何)/.test(text) && !/(不要|不用|无需).{0,6}(分析|报告)/.test(text)) {
      await analyzeToday(text.trim());
      return;
    }
    setInput("");
    setMessages((items) => [...items, { role: "user", text: text.trim() }]);
    setSending(true);
    try {
      const reply = await request<{ reply: string }>("/chat", {
        method: "POST",
        body: JSON.stringify({ message: text.trim(), history: messages.slice(1).filter(m => !m.error && !m.report).slice(-20).map(m => ({ role: m.role, content: m.text })) }),
      });
      setMessages((items) => [
        ...items,
        { role: "assistant", text: reply.reply },
      ]);
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          text: error instanceof Error ? error.message : "暂时无法连接服务，请重试。",
          error: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  }
  async function addRecord(kind: "water" | "weight", amount: number) {
    if (saving) return;
    if (!Number.isFinite(amount) || (kind === "weight" ? amount < 1 || amount > 500 : amount <= 0 || amount > 5000)) {
      setToast(kind === "weight" ? "体重须在 1–500 kg 之间" : "饮水量须在 0–5000 mL 之间");
      return;
    }
    setSaving(true);
    try {
      if (isNativeIPhone()) {
        if (kind === "water") await addAppleHealthWater(amount);
        else await addAppleHealthWeight(amount);
        setModal("");
        try {
          const summary = await readAppleHealth(false, healthDate);
          setNativeSummary(summary);
          setHealthError("");
          setToast(kind === "water" ? `已将 ${amount} mL 饮水保存到 Apple 健康` : `已将 ${amount} kg 体重保存到 Apple 健康`);
        } catch (error) {
          setHealthError(error instanceof Error ? error.message : "健康数据刷新失败");
          setToast("记录已保存，但数据刷新失败，请稍后重新读取，勿重复添加。");
        }
        return;
      }
      await request<Dashboard>("/records", {
        method: "POST",
        body: JSON.stringify({ kind, value: amount }),
      });
      setDashboard(await request<Dashboard>(`/dashboard?date=${healthDate}`));
      setConnection("ready");
      setToast(kind === "water" ? "已记录 250 mL 饮水" : "体重记录已保存");
      setModal("");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }
  async function pickAvatar(file: File | undefined) {
    if (!file || avatarBusy) return;
    setAvatarBusy(true);
    try {
      const dataUrl = await prepareAvatar(file);
      if (!storeAvatar(dataUrl)) throw new Error("本机存储空间不足，头像未能保存");
      setAvatar(dataUrl);
      setToast("头像已更新");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "头像处理失败，请重试");
    } finally {
      setAvatarBusy(false);
    }
  }
  function removeAvatar() {
    clearStoredAvatar();
    setAvatar("");
    setToast("头像已移除");
  }
  const exporting = useRef(false);
  async function exportData() {
    if (exporting.current) return;
    if (isNativeIPhone()) {
      if (!healthEnabled) {
        setModal("health-onboarding");
        setToast("请先连接 Apple 健康后再导出");
        return;
      }
      exporting.current = true;
      try {
        const summary = await readAppleHealth(false, healthDate);
        if (!hasReadableHealthData(summary)) {
          setToast("暂无可导出的健康记录，请检查所选日期、健康数据及读取权限");
          return;
        }
        setNativeSummary(summary);
        const completed = await exportAppleHealthData(JSON.stringify({
          profile: { name }, exportedAt: new Date().toISOString(), timeZone: "Asia/Shanghai",
          source: "Apple 健康", scope: "所选日期健康摘要及接口返回的体重历史，不含完整健康数据库、头像或聊天记录", ...summary,
        }, null, 2));
        if (completed) setToast("导出操作已完成");
      } catch (error) {
        setToast(error instanceof Error ? error.message : "导出失败，请重试");
      } finally { exporting.current = false; }
      return;
    }
    if (!dashboard) {
      setToast("请先连接后端后再导出");
      return;
    }
    const blob = new Blob(
      [JSON.stringify({ profile: { name }, ...dashboard }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "冷酸宁-健康记录.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast("健康记录已导出");
  }
  const weight = (isNativeIPhone() ? nativeSummary?.weightKg : dashboard?.weight) ?? 62;
  return (
    <div className="studio">
      <aside className="studio-note">
        <div className="brand-mark">
          <Sparkles size={23} />
        </div>
        <span className="eyebrow">LENGSUANNING / WELLNESS COMPANION</span>
        <h1>
          把健康，
          <br />
          融入每一天<span>。</span>
        </h1>
        <p>
          从一次倾听、一杯水，
          <br />
          到一个更了解自己的日常。
        </p>
        <div className="studio-divider" />
        <span className="studio-caption">冷酸宁 · 你的 AI 健康助手</span>
        <div className="demo-label">
          <span />
          本地演示 · 非医疗诊断服务
        </div>
      </aside>
      <main className="phone-shell">
        <div className={`mobile-app reference-${tab}`}>
          <div className="app-topline">
            <span>冷酸宁 LENGSUANNING</span>
            <span>
              <span className={`connection-dot ${connection}`} />
              {isNativeIPhone() ? "手机本地测试" : connection === "ready"
                ? "本地演示"
                : connection === "loading"
                  ? "连接中"
                  : "离线预览"}
            </span>
          </div>
          <div className={`page-content ${tab === "chat" ? "chat-page" : tab === "health" ? "health-page" : ""}`}>
            {tab === "chat" && (
              <ChatPage
                messages={messages}
                avatar={avatar}
                onAnalyze={() => void analyzeToday("帮我分析今日健康数据，并给出健康报告")}
                onNewChat={() => {
                  setMessages([...initialMessages]);
                  setInput("");
                }}
                reportLoading={sending}
                sending={sending}
                bottomRef={bottomRef}
              />
            )}
            {tab === "health" && (
              <HealthPage
                dashboard={dashboard}
                nativeSummary={nativeSummary}
                healthEnabled={healthEnabled}
                healthBusy={healthBusy}
                healthError={healthError}
                date={healthDate}
                onDateChange={setHealthDate}
                saving={saving}
                onAddWater={() => void addRecord("water", 250)}
                onRecordWeight={() => {
                  setValue(weight.toFixed(1));
                  setModal("weight");
                }}
              />
            )}
            {tab === "mine" && (
              <MinePage
                name={name}
                avatar={avatar}
                recordCount={dashboard?.records.length ?? 0}
                onOpenProfile={() => {
                  setDraftName(name);
                  setModal("profile");
                }}
                onOpenModal={setModal}
                onExportData={() => void exportData()}
              />
            )}
          </div>
          <div className="bottom-dock">
            {tab === "chat" && (
              <ChatComposer
                aiReady={aiReady}
                input={input}
                sending={sending}
                onInputChange={setInput}
                onSend={() => void send()}
                onAnalyze={() => void analyzeToday("帮我分析今日健康数据，并给出健康报告")}
                onOpenPrompts={() => setModal("prompts")}
              />
            )}
            <nav className="bottom-nav" aria-label="主导航">
              {(
                [
                  ["chat", MessageCircle, "对话"],
                  ["health", ChartPie, "健康"],
                  ["mine", UserRound, "我的"],
                ] as const
              ).map(([id, Icon, label]) => (
                <button
                  key={id}
                  className={tab === id ? "active" : ""}
                  aria-current={tab === id ? "page" : undefined}
                  onClick={() => setTab(id)}
                >
                  <Icon size={21} strokeWidth={1.5} />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
            <div className="home-indicator" />
          </div>
        </div>
      </main>
      <aside className="preview-note">
        <span>DESIGN PREVIEW / 01</span>
        <p>
          柔和一点，
          <br />
          让每次打开都安心。
        </p>
        <div className="swatches">
          <i />
          <i />
          <i />
        </div>
        <small>React H5 + Python FastAPI</small>
      </aside>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      <dialog
        ref={dialogRef}
        onCancel={() => setModal("")}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModal("");
        }}
      >
        <div className="modal-content">
          <button
            className="close-button"
            aria-label="关闭弹窗"
            onClick={() => setModal("")}
          >
            <X size={20} />
          </button>
          {modal === "health-onboarding" && (
            <div className="health-onboarding">
              <IconBubble icon={ShieldCheck} />
              <span className="health-eyebrow">CONNECT YOUR HEALTH</span>
              <h3>让冷酸宁，更了解你</h3>
              <p>连接 Apple 健康，查看睡眠、活动、心率与体重的变化。你可以逐项选择允许读取的数据。</p>
              <ol><li>点击下方按钮，打开系统授权。</li><li>开启你希望分享的数据读取开关。</li><li>完成后返回 App，自动更新健康概览。</li></ol>
              <p>若系统未再次弹窗，请到「健康」App → 个人头像 → 隐私 → App → 冷酸宁，检查并开启读取权限，再返回重试。没有健康记录时也可能显示为空。</p>
              <p>健康数据不会自动上传；仅在你主动请求 AI 健康分析时，才发送当天摘要。</p>
              {healthError && <p className="health-error" role="alert">{healthError}</p>}
              <button className="wide-button" disabled={healthBusy} onClick={() => void connectHealthFromGuide()}>{healthBusy ? "正在连接…" : healthEnabled ? "重新检查健康数据" : "开启 Apple 健康授权"}</button>
              <button className="onboarding-later" disabled={healthBusy} onClick={() => setModal("")}>稍后再说</button>
            </div>
          )}
          {modal === "weight" && (
            <>
              <IconBubble icon={Weight} color="mint" />
              <h3>记录此刻的自己</h3>
              <p>每一次记录，都让变化更清晰。</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void addRecord("weight", Number(value));
                }}
              >
                <label htmlFor="weight">体重 / kg</label>
                <input
                  id="weight"
                  className="form-input weight-input"
                  type="number"
                  min="1"
                  max="500"
                  step="0.1"
                  required
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
                <button className="wide-button" disabled={saving}>
                  {saving ? "保存中…" : "保存记录"}
                </button>
              </form>
            </>
          )}
          {modal === "profile" && (
            <>
              <IconBubble icon={UserRound} />
              <h3>健康档案</h3>
              <p>头像和称呼只保存在这台设备，用于对话中显示。</p>
              <div className="avatar-editor">
                <span className={`avatar-preview ${avatar ? "has-image" : ""}`}>
                  {avatar ? (
                    <img src={avatar} alt="当前头像" />
                  ) : (
                    <UserRound size={34} strokeWidth={1.3} />
                  )}
                </span>
                <div className="avatar-actions">
                  <div className="avatar-buttons">
                    <button
                      type="button"
                      className="avatar-upload-button"
                      disabled={avatarBusy}
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <Upload size={15} strokeWidth={1.8} />
                      {avatarBusy ? "处理中…" : avatar ? "更换头像" : "上传头像"}
                    </button>
                    {avatar && (
                      <button
                        type="button"
                        className="avatar-remove-button"
                        aria-label="移除头像"
                        disabled={avatarBusy}
                        onClick={removeAvatar}
                      >
                        <Trash2 size={15} strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                  <small>支持 JPG / PNG，会自动裁成方形并压缩。</small>
                </div>
                <input
                  ref={avatarInputRef}
                  className="avatar-file-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    void pickAvatar(file);
                    e.target.value = "";
                  }}
                />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = draftName.trim();
                  if (n) {
                    setName(n);
                    localStorage.setItem("zhikang-name", n);
                    setModal("");
                    setToast("档案已更新");
                  }
                }}
              >
                <label htmlFor="name">你的称呼</label>
                <input
                  id="name"
                  className="form-input"
                  required
                  maxLength={20}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                />
                <button className="wide-button">保存档案</button>
              </form>
            </>
          )}
          {modal === "reminder" && (
            <>
              <IconBubble icon={Bell} />
              <h3>提醒设置</h3>
              <p>当前仅保存偏好，系统通知将在 App 封装阶段接入。</p>
              <button
                className="toggle-row"
                role="switch"
                aria-checked={reminder}
                onClick={() => {
                  setReminder(!reminder);
                  localStorage.setItem("zhikang-reminder", String(!reminder));
                }}
              >
                <span>每日记录提醒</span>
                <span className={`toggle ${reminder ? "on" : ""}`}>
                  <i />
                </span>
              </button>
            </>
          )}
          {modal === "privacy" && (
            <>
              <IconBubble icon={ShieldCheck} />
              <h3>隐私与授权</h3>
              <button className="toggle-row" role="switch" aria-checked={healthEnabled} disabled={healthBusy || !isNativeIPhone()} onClick={() => void toggleHealth()}>
                <span>Apple 健康自动读取{healthBusy ? " · 读取中…" : ""}</span>
                <span className={`toggle ${healthEnabled ? "on" : ""}`}><i /></span>
              </button>
              <p>开启后记住连接偏好，每次打开 App 或切回前台自动读取，切换日期自动更新，无需反复点击连接。系统权限由 iPhone 管理；开关开启不代表所有项目已获授权。</p>
              <p>主动添加饮水记录时，会单独请求饮水读写权限，并保存到 Apple 健康。</p>
              <p>关闭会停止自动读取并清除当前内存中的健康数据，不会撤销系统权限。撤销权限请到 iPhone「健康」的应用授权设置。</p>
              {!isNativeIPhone() && <p>Apple 健康连接仅支持安装到 iPhone 的 App。</p>}
              {healthError && <p className="health-error" role="alert">{healthError}</p>}
              <p>仅连接偏好保存在本机，健康数据不自动上传；AI 对话发送聊天文字，发送今日健康分析请求时，会自动读取当天健康摘要并发送到 DeepSeek 生成报告。</p>
            </>
          )}
          {modal === "help" && (
            <>
              <IconBubble icon={HelpCircle} />
              <h3>关于冷酸宁</h3>
              <p>
                冷酸宁 v0.1.0 是 React H5 + FastAPI
                工程原型。聊天为固定规则演示，图表含示例数据。
              </p>
              <p>
                可以体验：发送问题、记录饮水和体重、修改称呼，以及导出记录。真实
                AI、登录、报告解析与原生通知尚未接入。
              </p>
            </>
          )}
          {modal === "prompts" && (
            <>
              <IconBubble icon={Sparkles} />
              <h3>从一个小问题开始</h3>
              <p>选择话题，体验健康助手。</p>
              {[
                "帮我看看睡眠记录",
                "如何记录今天的饮水？",
                "如何查看体重变化？",
              ].map((text) => (
                <button
                  className="prompt-button"
                  key={text}
                  onClick={() => {
                    setModal("");
                    void send(text);
                  }}
                >
                  {text}
                  <ArrowUpRight size={17} />
                </button>
              ))}
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
