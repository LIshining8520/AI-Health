import type { RefObject } from "react";
import {
  ArrowUp,
  LoaderCircle,
  Plus,
  Sparkles,
  SquarePen,
  Stethoscope,
  UserRound,
} from "lucide-react";
import type { Message } from "../types";

interface ChatPageProps {
  onAnalyze: () => void;
  onNewChat: () => void;
  reportLoading: boolean;
  messages: Message[];
  avatar?: string;
  sending: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
}
export default function ChatPage({
  onAnalyze,
  onNewChat,
  reportLoading,
  messages,
  avatar = "",
  sending,
  bottomRef,
}: ChatPageProps) {
  return (
    <>
      <header className="chat-topbar">
        <div className="therapist-identity"><span className="therapist-avatar"><Sparkles size={23} /><i /></span><div><p className="chat-title">冷酸宁 AI</p><p className="chat-status"><span />在这里，陪伴你</p></div></div>
        <button className="report-pill" disabled={reportLoading} onClick={onAnalyze}><Stethoscope size={14} />今日健康报告</button>
      </header>
      <div className="reference-chat-layout"><div className="conversation" aria-live="polite">
        <div className="chat-date">今天 · 给自己一点时间</div>
        <div className="session-intro"><span className="intro-spark"><Sparkles size={18} /></span><div><p>一个安心表达的空间</p><span>慢慢来，用你舒服的方式，聊聊今天的感受与健康。</span></div></div>
        {messages.map((message, i) => (
            <div className={`message ${message.role}`} key={i}>
              {message.role === "assistant" && (
                <span className="ai-avatar">
                  <Sparkles size={14} strokeWidth={1.6} />
                </span>
              )}
              <div className="message-bubble">{message.text}</div>
              {message.role === "user" && (
                <span className={`user-avatar ${avatar ? "has-image" : ""}`}>
                  {avatar ? (
                    <img src={avatar} alt="我的头像" />
                  ) : (
                    <UserRound size={14} />
                  )}
                </span>
              )}
            </div>
          ))}
        {sending && (
          <div className="message assistant">
            <span className="ai-avatar">
              <Sparkles size={14} />
            </span>
            <div className="message-bubble typing">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div><aside className="session-sidebar"><div className="session-side-header">陪伴时刻 <Sparkles size={17} /></div><h3>你的空间，<br />你的节奏。</h3><p>从今天的状态开始，一起找到适合你的健康小习惯。</p><div className="session-focus"><Sparkles size={24} /><div><strong>专注当下</strong><small>每一次倾听，都是照顾自己的开始</small></div></div><div className="session-topics"><span>可以聊聊</span><div><i>睡眠</i><i>日常压力</i><i>健康习惯</i></div></div><div className="session-divider" /><strong>慢慢来，没关系</strong><p>不用急着找到答案，也不用组织完美的语言。</p><button className="end-session-button" onClick={onNewChat}>开始新的对话</button></aside></div>
    </>
  );
}

interface ChatComposerProps {
  aiReady: boolean;
  input: string;
  sending: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onAnalyze: () => void;
  onOpenPrompts: () => void;
}
export function ChatComposer({
  aiReady,
  input,
  sending,
  onInputChange,
  onSend,
  onAnalyze,
  onOpenPrompts,
}: ChatComposerProps) {
  return (
    <>
      <div className="suggested-prompts">{["帮我分析今日健康数据", "如何改善睡眠？", "我想放松一下"].map(prompt => <button key={prompt} disabled={sending} onClick={() => onInputChange(prompt)}>{prompt}</button>)}</div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <div className="composer-card">
          <input
            className="composer-input"
            aria-label="向健康助手提问"
            maxLength={2000}
            placeholder="随便问点什么…"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
          />
          <div className="composer-row">
            <button
              type="button"
              className="composer-plus"
              aria-label="快捷提问"
              onClick={onOpenPrompts}
            >
              <Plus size={18} strokeWidth={1.8} />
            </button>
            <span
              className="composer-chip"
              title={aiReady ? "DeepSeek 已连接" : "AI 待配置"}
            >
              {aiReady ? "DeepSeek" : "AI 待配置"}
            </span>
            <span className="composer-spacer" />
            <button
              type="button"
              className="composer-ghost"
              aria-label="分析今日健康数据"
              disabled={sending}
              onClick={onAnalyze}
            >
              <Sparkles size={17} strokeWidth={1.7} />
            </button>
            <button
              className="send-button"
              aria-label="发送消息"
              disabled={sending || !input.trim()}
            >
              {sending ? (
                <LoaderCircle size={18} className="spin" />
              ) : (
                <ArrowUp size={18} strokeWidth={2.2} />
              )}
            </button>
          </div>
        </div>
      </form>
      <div className="ai-notice">
        {aiReady
          ? "AI 智能小助手 对话 · 不提供诊断"
          : "AI 待配置 · 请在后端设置 API Key"}{" "}
        · 健康分析会发送当天健康摘要
      </div>
    </>
  );
}
