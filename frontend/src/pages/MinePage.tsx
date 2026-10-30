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
  avatar?: string;
  recordCount: number;
  onOpenProfile: () => void;
  onOpenModal: (modal: string) => void;
  onExportData: () => void;
}
export default function MinePage({
  name,
  avatar = "",
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
          <span className="health-eyebrow">YOUR PERSONAL SPACE</span><h2>我的</h2>
          <p>更了解自己，也更照顾自己</p>
        </div>
      </header>
      <div className="mine-profile-column"><button className="card profile-card" onClick={onOpenProfile}>
        <span className={`profile-avatar ${avatar ? "has-image" : ""}`}>
          {avatar ? (
            <img src={avatar} alt={`${name}的头像`} />
          ) : (
            <UserRound size={34} strokeWidth={1.3} />
          )}
        </span>
        <span>
          <strong>{name}</strong>
          <small>把健康融入日常</small><span className="profile-edit-label">编辑个人资料 ↗</span>
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
      </div><div className="mine-settings-column"><p className="mine-section-label">偏好与设置 / PREFERENCES</p><section className="card settings-card">
        {settings.map(([Icon, title, onClick]) => (
          <button key={title} onClick={onClick}>
            <span className="setting-icon"><Icon size={19} strokeWidth={1.5} /></span>
            <span>{title}</span>
            <ChevronRight size={18} />
          </button>
        ))}
      </section>
      <div className="privacy-note">
        <ShieldCheck size={16} />
        <span>你的健康数据，由你掌控</span>
      </div>
      <p className="version">冷酸宁 v0.1.0 · YOUR WELLNESS COMPANION</p></div>
    </>
  );
}
