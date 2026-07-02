import { ArrowLeftRight, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { HUDCard } from "../../../components/layout/HUDCard";
import { Currency } from "../../../components/game/Currency";
import { formatTimeAgo } from "../../../lib/formatters";
import type { Trade } from "../types";
import { CardHeader, Empty } from "./CardHeader";

export function RecentTrades({ trades, currentTime }: { trades: Trade[]; currentTime: number }) {
  return (
    <HUDCard className="rounded-lg border-border overflow-hidden">
      <CardHeader icon={ArrowLeftRight} title="Recent Trades"
        extra={<span className="text-xs text-muted-foreground tabular-nums">{trades.length}</span>} />
      <div className="divide-y divide-border/40 max-h-96 overflow-auto">
        {trades.length === 0 && <Empty text="No player trades recorded yet." />}
        {trades.map((t, i) => {
          const sell = t.seller_is_player && !t.buyer_is_player;
          const buy = t.buyer_is_player && !t.seller_is_player;
          const internal = t.seller_is_player && t.buyer_is_player;
          const total = (t.price ?? 0) * (t.quantity ?? 0);
          const asset = t.seller_is_player ? t.seller_name : t.buyer_name;
          return (
            <div key={i} className="flex items-center gap-2 px-4 py-1.5 text-sm">
              <span className={`flex items-center gap-1 w-16 shrink-0 text-xs font-semibold ${sell ? "text-[var(--success)]" : buy ? "text-[var(--danger)]" : "text-muted-foreground"}`}>
                {sell ? <ArrowUpRight className="h-3.5 w-3.5" /> : buy ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowLeftRight className="h-3 w-3" />}
                {internal ? "MOVE" : sell ? "SELL" : "BUY"}
              </span>
              <span className="w-32 truncate">{t.ware_name ?? t.ware}</span>
              <span className="flex-1 truncate text-muted-foreground text-xs">{asset}</span>
              <span className="tabular-nums text-muted-foreground text-xs">×{(t.quantity ?? 0).toLocaleString()}</span>
              <Currency value={internal ? null : sell ? total : -total} dynamicColor icon={false} abbreviate className="w-20 text-right" />
              <span className="w-10 text-right tabular-nums text-muted-foreground text-xs" title="Age">{formatTimeAgo(t.time, currentTime)}</span>
            </div>
          );
        })}
      </div>
    </HUDCard>
  );
}
