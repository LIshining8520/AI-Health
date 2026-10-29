import type { RefObject } from "react";
import {
  LoaderCircle,
  Moon,
  Plus,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { Message } from "../types";

interface ChatPageProps {
  onAnalyze: () => void;
  reportLoading: boolean;
  messages: Message[];
  sending: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
}
export default function ChatPage({
  onAnalyze,
  reportLoading,
  messages,
  sending,
  bottomRef,
}: ChatPageProps) {
  return (
    <>
      <header className="page-header">
        <div>
          <h2>你的健康助手</h2>
          <p>陪你养成健康好习惯</p>
        </div>
        <span className="header-spark">
          <Sparkles size={24} strokeWidth={1.4} />
        </span>
      </header>
      <div className="conversation" aria-live="polite">
        {messages.map((message, i) => (
          <div className={`message ${message.role}`} key={i}>
            {message.role === "assistant" && (
              <span className="ai-avatar">
                <Sparkles size={20} strokeWidth={1.5} />
              </span>
            )}
            <div className="message-bubble">{message.text}</div>
            {message.role === "user" && (
              <span className="user-avatar">
                <UserRound size={20} />
              </span>
            )}
          </div>
        ))}
        {sending && (
          <div className="message assistant">
            <span className="ai-avatar">
              <Sparkles size={20} />
            </span>
            <div className="message-bubble typing">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
  
        <div ref={bottomRef} />
      </div>
    </>
  );
}

interface ChatComposerProps {
  aiReady: boolean;
  input: string;
  sending: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onOpenPrompts: () => void;
}
export function ChatComposer({
  aiReady,
  input,
  sending,
  onInputChange,
  onSend,
  onOpenPrompts,
}: ChatComposerProps) {
  return (
    <>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <div className="input-wrap">
          <button type="button" aria-label="快捷提问" onClick={onOpenPrompts}>
            <Plus size={22} />
          </button>
          <input
            aria-label="向健康助手提问"
            maxLength={2000}
            placeholder="输入你的问题…"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
          />
        </div>
        <button
          className="send-button"
          aria-label="发送消息"
          disabled={sending || !input.trim()}
        >
          {sending ? (
            <LoaderCircle size={20} className="spin" />
          ) : (
            <Send size={20} />
          )}
        </button>
      </form>
      <div className="ai-notice">{aiReady ? "DeepSeek 对话 · 不提供诊断" : "AI 待配置 · 请在后端设置 API Key"} · 仅发送聊天文字</div>
    </>
  );
}
