import { Activity, Flame, Boxes } from "lucide-react";
import { HUDCard } from "../../../components/layout/HUDCard";
import { formatCompactNumber } from "../../../lib/formatters";
import type { WareMarket } from "../types";
import { CardHeader } from "./CardHeader";

function fmtShort(v: number): string {
  return formatCompactNumber(v, { decimals: 0, base: (n) => String(Math.round(n)) });
}

function MarketColumn({ title, icon: Icon, tone, rows, metric }: {
  title: string; icon: typeof Activity; tone: "good" | "bad";
  rows: WareMarket[]; metric: "demand" | "supply";
}) {
  const color = tone === "bad" ? "var(--danger)" : "var(--success)";
  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold" style={{ color }}>
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <div className="divide-y divide-border/30">
        {rows.length === 0 && <div className="px-3 py-4 text-xs text-muted-foreground text-center">—</div>}
        {rows.map((m) => (
          <div key={m.ware_id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
            <span className="flex-1 truncate">{m.ware_name ?? m.ware_id}</span>
            {m.price_index != null && (
              <span className="text-[10px] tabular-nums text-muted-foreground" title="price vs reference">
                {m.price_index > 1 ? "+" : ""}{Math.round((m.price_index - 1) * 100)}%
              </span>
            )}
            <span className="tabular-nums text-xs w-16 text-right" style={{ color }}>
              {fmtShort(metric === "demand" ? m.net_demand : -m.net_demand)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketPulse({ shortages, surpluses }: { shortages: WareMarket[]; surpluses: WareMarket[] }) {
  return (
    <HUDCard className="rounded-lg border-border overflow-hidden">
      <CardHeader icon={Activity} title="Market Pulse"
        extra={<span className="text-xs text-muted-foreground">universe supply / demand</span>} />
      <div className="grid grid-cols-2 divide-x divide-border/40">
        <MarketColumn title="Top Shortages" icon={Flame} tone="bad" rows={shortages} metric="demand" />
        <MarketColumn title="Top Surpluses" icon={Boxes} tone="good" rows={surpluses} metric="supply" />
      </div>
    </HUDCard>
  );
}
