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
  UserRound,
  Weight,
  X,
} from "lucide-react";
import type { AppleHealthSummary } from "./apple-health";
import { addAppleHealthWater, isNativeIPhone, readAppleHealth } from "./apple-health";
import IconBubble from "./components/IconBubble";
import ChatPage, { ChatComposer } from "./pages/ChatPage";
import HealthPage from "./pages/HealthPage";
import MinePage from "./pages/MinePage";
import type { Dashboard, Message } from "./types";

type Tab = "chat" | "health" | "mine";
const initialMessages: Message[] = [
  { role: "assistant", text: "你好，我是知康。可以和我聊聊健康习惯或一般健康问题。对话会发送到 DeepSeek。发送“分析今日健康数据”时，会自动读取当天健康摘要并交给 DeepSeek 分析。" },
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
  const [modal, setModal] = useState("");
  const [value, setValue] = useState("62.0");
  const [saving, setSaving] = useState(false);
  const [reminder, setReminder] = useState(
    localStorage.getItem("zhikang-reminder") === "true",
  );
  const [name, setName] = useState(
    localStorage.getItem("zhikang-name") || "小林",
  );
  const [draftName, setDraftName] = useState(name);
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
        if (active) { setNativeSummary(result); lastReadDate.current = healthDate; }
      } catch (error) {
        if (active) { setNativeSummary(null); setHealthError(error instanceof Error ? error.message : "健康数据读取失败"); }
      } finally { reading = false; if (active) setHealthBusy(false); }
    }
    const onVisible = () => { if (document.visibilityState === "visible") void refreshHealth(); };
    if (lastReadDate.current !== healthDate) void refreshHealth();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => { active = false; document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
  }, [healthEnabled, healthDate]);
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
    setSaving(true);
    try {
      if (isNativeIPhone() && kind === "water") {
        await addAppleHealthWater(amount);
        try {
          const summary = await readAppleHealth(false, healthDate);
          setNativeSummary(summary);
          setHealthError("");
          setToast(`已将 ${amount} mL 饮水保存到 Apple 健康`);
        } catch (error) {
          setHealthError(error instanceof Error ? error.message : "健康数据刷新失败");
          setToast("饮水已保存，但数据刷新失败，请稍后重新读取，勿重复添加。");
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
  function exportData() {
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
    link.download = "知康-健康记录.json";
    link.click();
    URL.revokeObjectURL(url);
    setToast("健康记录已导出");
  }
  const weight = dashboard?.weight ?? 62;
  return (
    <div className="studio">
      <aside className="studio-note">
        <div className="brand-mark">
          <Sparkles size={23} />
        </div>
        <span className="eyebrow">ZHIKANG / WELLNESS COMPANION</span>
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
        <span className="studio-caption">知康 · 你的 AI 健康助手</span>
        <div className="demo-label">
          <span />
          本地演示 · 非医疗诊断服务
        </div>
      </aside>
      <main className="phone-shell">
        <div className="mobile-app">
          <div className="app-topline">
            <span>知康 ZHIKANG</span>
            <span>
              <span className={`connection-dot ${connection}`} />
              {isNativeIPhone() ? "手机本地测试" : connection === "ready"
                ? "本地演示"
                : connection === "loading"
                  ? "连接中"
                  : "离线预览"}
            </span>
          </div>
          <div className={`page-content ${tab === "chat" ? "chat-page" : ""}`}>
            {tab === "chat" && (
              <ChatPage
                messages={messages}
                onAnalyze={() => void analyzeToday("帮我分析今日健康数据，并给出健康报告")}
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
                recordCount={dashboard?.records.length ?? 0}
                onOpenProfile={() => {
                  setDraftName(name);
                  setModal("profile");
                }}
                onOpenModal={setModal}
                onExportData={exportData}
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
              <p>先从一个亲切的称呼开始。</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = draftName.trim();
                  if (n) {
                    setName(n);
                    localStorage.setItem("zhikang-name", n);
                    setModal("");
                    setToast("称呼已更新");
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
              <h3>关于知康</h3>
              <p>
                知康 v0.1.0 是 React H5 + FastAPI
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
