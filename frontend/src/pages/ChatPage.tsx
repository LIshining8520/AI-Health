import { useEffect, useRef, useState, type RefObject } from "react";
import {
  ArrowUp,
  Camera,
  ImagePlus,
  FileUp,
  FolderUp,
  FileText,
  X,
  LoaderCircle,
  Plus,
  Sparkles,
  SquarePen,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { attachmentImageUrl, isImageAttachment, ATTACHMENT_ACCEPT, type ChatAttachment } from "../chat-attachments";
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
        <button type="button" className="round-icon" aria-label="开始新对话" disabled={sending} onClick={onNewChat}><SquarePen size={17} /></button>
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
              <div className="message-bubble">{message.attachments?.length ? <div className="message-attachments">{message.attachments.map((file, index) => <div className="sent-attachment" key={index}>{isImageAttachment(file) ? <a href={attachmentImageUrl(file)} target="_blank" rel="noreferrer"><img src={attachmentImageUrl(file)} alt={file.name} /></a> : <FileText size={18} />}<span>{file.name}</span></div>)}</div> : null}{message.text}</div>
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
      </div><aside className="session-sidebar"><div className="session-side-header">陪伴时刻 <Sparkles size={17} /></div><h3>你的空间，<br />你的节奏。</h3><p>从今天的状态开始，一起找到适合你的健康小习惯。</p><div className="session-focus"><Sparkles size={24} /><div><strong>专注当下</strong><small>每一次倾听，都是照顾自己的开始</small></div></div><div className="session-topics"><span>可以聊聊</span><div><i>睡眠</i><i>日常压力</i><i>健康习惯</i></div></div><div className="session-divider" /><strong>慢慢来，没关系</strong><p>不用急着找到答案，也不用组织完美的语言。</p><button className="end-session-button" disabled={sending || reportLoading} onClick={onNewChat}>开始新的对话</button></aside></div>
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
  attachments: ChatAttachment[];
  attachmentBusy: boolean;
  onFiles: (files: File[]) => void;
  onDocuments: (fallback: () => void) => void;
  onImages: (camera: boolean, fallback: () => void) => void;
  onFolder: (fallback: () => void) => void;
  onRemoveAttachment: (index: number) => void;
}
export function ChatComposer({
  aiReady,
  input,
  sending,
  onInputChange,
  onSend,
  onAnalyze,
  attachments, attachmentBusy, onFiles, onDocuments, onImages, onFolder, onRemoveAttachment,
}: ChatComposerProps) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const pick = (files: FileList | null) => {
    setToolsOpen(false);
    if (files?.length) onFiles(Array.from(files));
  };
  const choose = (action: () => void) => { setToolsOpen(false); action(); };
  useEffect(() => {
    if (!toolsOpen) return;
    const dismiss = (event: Event) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !plusRef.current?.contains(target)) setToolsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setToolsOpen(false); plusRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [toolsOpen]);
  useEffect(() => { if (sending || attachmentBusy) setToolsOpen(false); }, [sending, attachmentBusy]);
  const toolsMenu = toolsOpen && <section ref={menuRef} className="chat-tools" id="chat-tools" role="menu" aria-label="添加到对话"
    onKeyDown={event => {
      const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      let next: number;
      if (event.key === "ArrowDown") next = (index + 1) % buttons.length;
      else if (event.key === "ArrowUp") next = (index + buttons.length - 1) % buttons.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = buttons.length - 1;
      else return;
      event.preventDefault(); buttons[next]?.focus();
    }}>
    <div className="tools-heading"><span>添加到对话</span><small>选择来源</small></div>
    <div className="tools-grid">
      <button type="button" role="menuitem" disabled={sending || attachmentBusy} onClick={() => choose(() => onImages(true, () => cameraInput.current?.click()))}><span className="tool-icon camera"><Camera /></span><span><strong>拍照</strong><small>使用相机</small></span></button>
      <button type="button" role="menuitem" disabled={sending || attachmentBusy} onClick={() => choose(() => onImages(false, () => imageInput.current?.click()))}><span className="tool-icon image"><ImagePlus /></span><span><strong>上传图片</strong><small>JPG、PNG 等</small></span></button>
      <button type="button" role="menuitem" disabled={sending || attachmentBusy} onClick={() => choose(() => onDocuments(() => fileInput.current?.click()))}><span className="tool-icon file"><FileUp /></span><span><strong>上传文件</strong><small>PDF、DOCX、TXT</small></span></button>
      <button type="button" role="menuitem" disabled={sending || attachmentBusy} onClick={() => choose(() => onFolder(() => folderInput.current?.click()))}><span className="tool-icon folder"><FolderUp /></span><span><strong>上传文件夹</strong><small>批量选择文件</small></span></button>
    </div>
    <p>点击发送后交给 DeepSeek 解析 · 每个会话最多 8 个附件 / 2.5 MB</p>
  </section>;
  return (
    <div className="chat-composer-wrap">
      <div className="suggested-prompts">{["帮我分析今日健康数据", "如何改善睡眠？", "我想放松一下"].map(prompt => <button key={prompt} disabled={sending} onClick={() => onInputChange(prompt)}>{prompt}</button>)}</div>
      <div className="tools-area">
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={e => { pick(e.target.files); e.target.value = ""; }} />
        <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={e => { pick(e.target.files); e.target.value = ""; }} />
        <input ref={fileInput} type="file" accept={ATTACHMENT_ACCEPT} multiple hidden onChange={e => { pick(e.target.files); e.target.value = ""; }} />
        <input ref={folderInput} type="file" multiple hidden {...{webkitdirectory:""}} onChange={e => { pick(e.target.files); e.target.value = ""; }} />
        {attachmentBusy && <p className="attachment-status" role="status">正在读取文件…</p>}
        {attachments.length > 0 && <div className="attachment-list" aria-label="待发送附件">{attachments.map((file, index) => <div className="attachment-item" key={index}>{isImageAttachment(file) ? <img src={attachmentImageUrl(file)} alt={file.name} /> : <FileText size={14} />}<span title={file.name}>{file.name}</span><button type="button" aria-label={`移除 ${file.name}`} disabled={sending} onClick={() => onRemoveAttachment(index)}><X size={14} /></button></div>)}</div>}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <div className="composer-card">
          {toolsMenu}
          <button ref={plusRef} type="button" className="composer-plus" aria-label="添加附件" aria-haspopup="menu" aria-expanded={toolsOpen} aria-controls={toolsOpen ? "chat-tools" : undefined}
            disabled={sending || attachmentBusy} onClick={() => setToolsOpen(open => !open)}
            onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); setToolsOpen(true); requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()); } }}>
            <Plus size={18} strokeWidth={1.8} />
          </button>
          <input
            className="composer-input"
            aria-label="向健康助手提问"
            maxLength={2000}
            placeholder="随便问点什么…"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
          />
          <div className="composer-row">
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
              disabled={sending || attachmentBusy || (!input.trim() && !attachments.length)}
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
    </div>
  );
}
