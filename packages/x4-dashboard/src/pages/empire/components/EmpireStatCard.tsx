import type { ReactNode } from "react";
import type { Coins } from "lucide-react";
import { HUDCard } from "../../../components/layout/HUDCard";

export function StatCard({ icon: Icon, tone, value, label, big }: { icon?: typeof Coins; tone: string; value: ReactNode; label: string; big?: boolean }) {
  return (
    <HUDCard className="p-4 flex flex-col gap-1 justify-center">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {Icon && <Icon className={`h-3.5 w-3.5 ${tone}`} />}
        {label}
      </div>
      <span className={`font-bold tabular-nums leading-tight ${big ? "text-4xl" : "text-3xl"} ${tone}`}>{value}</span>
    </HUDCard>
  );
}

export function Panel({
  title,
  icon: Icon,
  headerRight,
  children,
}: {
  title: string;
  icon: typeof Coins;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <HUDCard className="p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 border-b border-border/50 pb-3">
        <Icon className="h-3.5 w-3.5" /> {title}
        {headerRight && <span className="ml-auto normal-case tracking-normal font-normal">{headerRight}</span>}
      </div>
      {children}
    </HUDCard>
  );
}
