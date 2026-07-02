import { Boxes } from "lucide-react";
import { HUDCard } from "../../../components/layout/HUDCard";
import { Currency } from "../../../components/game/Currency";
import { EntityIcon } from "../../../components/game/EntityIcon";
import type { WarePnl } from "../types";
import { CardHeader, Empty } from "./CardHeader";

export function PnlByCommodity({ pnl, maxAbsNet }: { pnl: WarePnl[]; maxAbsNet: number }) {
  return (
    <HUDCard className="rounded-lg border-border overflow-hidden">
      <CardHeader icon={Boxes} title="Profit & Loss by Commodity"
        extra={<span className="text-xs text-muted-foreground">external trades</span>} />
      <div className="divide-y divide-border/40">
        {pnl.length === 0 && <Empty text="No external trades recorded." />}
        {pnl.map((p) => {
          const pos = p.net >= 0;
          const pct = (Math.abs(p.net) / maxAbsNet) * 100;
          return (
            <div key={p.ware ?? "?"} className="flex items-center gap-3 px-4 py-2.5">
              <EntityIcon src={p.icon_url} alt={p.ware_name ?? ""} size={26} />
              <div className="w-32 shrink-0 truncate text-sm">{p.ware_name ?? p.ware}</div>
              {/* diverging bar */}
              <div className="relative flex-1 h-5 flex items-center">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
                <div
                  className="absolute h-3 rounded-sm"
                  style={pos
                    ? { left: "50%", width: `${pct / 2}%`, background: "var(--success)", opacity: 0.85 }
                    : { right: "50%", width: `${pct / 2}%`, background: "var(--danger)", opacity: 0.85 }}
                />
              </div>
              <Currency value={p.net} dynamicColor icon={false} abbreviate className="w-24 text-right text-sm" />
            </div>
          );
        })}
      </div>
    </HUDCard>
  );
}
