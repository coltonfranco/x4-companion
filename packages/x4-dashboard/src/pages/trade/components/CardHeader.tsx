import type { ReactNode } from "react";
import type { Wallet } from "lucide-react";

export function CardHeader({ icon: Icon, title, extra }: { icon: typeof Wallet; title: string; extra?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/20">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
      {extra && <span className="ml-auto">{extra}</span>}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="px-4 py-8 text-center text-sm text-muted-foreground">{text}</div>;
}
