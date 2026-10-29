import type { LucideIcon } from "lucide-react";

export default function IconBubble({
  icon: Icon,
  color = "",
}: {
  icon: LucideIcon;
  color?: string;
}) {
  return (
    <span className={`icon-bubble ${color}`}>
      <Icon size={21} strokeWidth={1.6} />
    </span>
  );
}
