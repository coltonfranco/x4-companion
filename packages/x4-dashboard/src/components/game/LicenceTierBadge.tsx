import { CheckCircle2, Lock } from "lucide-react";

/** Unlocked/locked indicator for a licence tier, shared by the faction detail page
 *  and the empire licences widget so both read the same way at a glance. */
export function LicenceTierBadge({
  unlocked,
  label,
  className = "",
  title,
}: {
  unlocked: boolean;
  label: string;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 ${unlocked ? "text-emerald-400" : "text-muted-foreground"} ${className}`}
    >
      {unlocked ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Lock className="w-3.5 h-3.5 shrink-0" />}
      <span className="truncate">{label}</span>
    </span>
  );
}
