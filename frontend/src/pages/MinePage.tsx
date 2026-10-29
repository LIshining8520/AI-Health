import {
  Bell,
  CalendarDays,
  ChevronRight,
  Download,
  FileText,
  HelpCircle,
  ShieldCheck,
  TrendingUp,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface MinePageProps {
  name: string;
  recordCount: number;
  onOpenProfile: () => void;
  onOpenModal: (modal: string) => void;
  onExportData: () => void;
}
export default function MinePage({
  name,
  recordCount,
  onOpenProfile,
  onOpenModal,
  onExportData,
}: MinePageProps) {
  const settings: [LucideIcon, string, () => void][] = [
    [FileText, "健康档案", onOpenProfile],
    [Bell, "提醒设置", () => onOpenModal("reminder")],
    [ShieldCheck, "隐私与授权", () => onOpenModal("privacy")],
    [Download, "导出健康数据", onExportData],
    [HelpCircle, "帮助与反馈", () => onOpenModal("help")],
  ];
  return (
    <>
      <header className="page-header">
        <div>
          <h2>我的</h2>
          <p>更了解自己，也更照顾自己</p>
        </div>
      </header>
      <button className="card profile-card" onClick={onOpenProfile}>
        <span className="profile-avatar">
          <UserRound size={34} strokeWidth={1.3} />
        </span>
        <span>
          <strong>{name}</strong>
          <small>把健康融入日常</small>
        </span>
        <ChevronRight size={20} />
      </button>
      <section className="card summary-card">
        <div>
          <CalendarDays size={22} strokeWidth={1.5} />
          <span>本地记录</span>
          <b>
            {recordCount}
            <small>条</small>
          </b>
        </div>
        <div>
          <TrendingUp size={22} strokeWidth={1.5} />
          <span>体验模式</span>
          <b className="summary-text">演示版</b>
        </div>
      </section>
      <section className="card settings-card">
        {settings.map(([Icon, title, onClick]) => (
          <button key={title} onClick={onClick}>
            <Icon size={22} strokeWidth={1.5} />
            <span>{title}</span>
            <ChevronRight size={18} />
          </button>
        ))}
      </section>
      <div className="privacy-note">
        <ShieldCheck size={16} />
        <span>你的健康数据，由你掌控</span>
      </div>
      <p className="version">知康 v0.1.0 · LOCAL PREVIEW</p>
    </>
  );
}
