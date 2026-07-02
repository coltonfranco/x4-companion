import type { ReactNode } from "react";
import { TrendingUp, TrendingDown, Wallet, Landmark, ArrowLeftRight } from "lucide-react";
import { HUDCard } from "../../../components/layout/HUDCard";
import { Currency } from "../../../components/game/Currency";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";
import type { NetWorthBreakdown, Player } from "../types";

const TONE: Record<string, string> = {
  gold: "text-gold", good: "text-[var(--success)]", bad: "text-[var(--danger)]", neutral: "text-foreground",
};

function Kpi({ icon: Icon, label, tone, children }: { icon: typeof Wallet; label: string; tone: string; children: ReactNode }) {
  return (
    <HUDCard className="rounded-lg border-border p-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
        <Icon className={`h-3.5 w-3.5 ${TONE[tone]}`} /> {label}
      </div>
      {children}
    </HUDCard>
  );
}

export function TradeKpiRow({
  player,
  empireValue,
  netWorthBreakdown,
  totals,
}: {
  player: Player | undefined;
  empireValue: number;
  netWorthBreakdown: NetWorthBreakdown | undefined;
  totals: { income: number; spend: number; net: number; volume: number; tradeCount: number };
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Kpi icon={Wallet} label="Global Credits" tone="gold">
        <Currency value={player?.credits ?? null} icon={false} className="text-2xl" />
      </Kpi>
      <TooltipProvider>
        <UiTooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <div className="cursor-help">
              <Kpi icon={Landmark} label="Empire Value" tone="gold">
                <Currency value={empireValue} icon={false} className="text-2xl" />
              </Kpi>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" className="w-[320px] p-3 text-sm space-y-2 bg-popover text-popover-foreground border border-border shadow-lg">
            <div className="flex justify-between items-center font-medium border-b border-border pb-1">
              <span>Empire Value</span>
              <Currency value={empireValue} icon={false} />
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Global Credits</span>
              <Currency value={netWorthBreakdown?.cash ?? null} icon={false} />
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Station Accounts</span>
              <Currency value={netWorthBreakdown?.station_accounts ?? null} icon={false} />
            </div>
            <div className="flex justify-between items-center text-muted-foreground mt-2">
              <span>Total Value of Ships</span>
              <Currency value={(netWorthBreakdown?.ship_hulls ?? 0) + (netWorthBreakdown?.ship_equipment ?? 0)} icon={false} />
            </div>
            <div className="flex justify-between items-center text-muted-foreground pl-3 text-xs border-l-2 border-border ml-1">
              <span>Ship Hulls</span>
              <Currency value={netWorthBreakdown?.ship_hulls ?? null} icon={false} />
            </div>
            <div className="flex justify-between items-center text-muted-foreground pl-3 text-xs border-l-2 border-border ml-1">
              <span>Ship Equipment</span>
              <Currency value={netWorthBreakdown?.ship_equipment ?? null} icon={false} />
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Total Value of Stations</span>
              <Currency value={netWorthBreakdown?.station_modules ?? null} icon={false} />
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Inventory</span>
              <Currency value={netWorthBreakdown?.inventory ?? null} icon={false} />
            </div>
            <div className="text-[11px] text-muted-foreground/80 mt-2 pt-2 border-t border-border">
              Estimated valuation matching the in-game Player Information menu.
            </div>
          </TooltipContent>
        </UiTooltip>
      </TooltipProvider>
      <Kpi icon={totals.net >= 0 ? TrendingUp : TrendingDown} label="Net Profit · all time" tone={totals.net >= 0 ? "good" : "bad"}>
        <Currency value={totals.net} icon={false} dynamicColor className="text-2xl" />
      </Kpi>
      <Kpi icon={ArrowLeftRight} label="Trade Volume · all time" tone="neutral">
        <div className="flex items-baseline gap-2">
          <Currency value={totals.volume} icon={false} abbreviate className="text-2xl" />
          <span className="text-xs text-muted-foreground tabular-nums">{totals.tradeCount} trades</span>
        </div>
      </Kpi>
    </div>
  );
}
