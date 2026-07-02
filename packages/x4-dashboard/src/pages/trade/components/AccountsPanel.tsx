import { Landmark, Building2, Rocket } from "lucide-react";
import { HUDCard } from "../../../components/layout/HUDCard";
import { Currency } from "../../../components/game/Currency";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";
import type { Account } from "../types";
import { CardHeader, Empty } from "./CardHeader";
import { BudgetBar } from "./BudgetBar";

const KIND_ICON = { station: Building2, ship: Rocket, account: Landmark } as const;

function AccountGroupRenderer({ title, accounts, valueTooltip }: { title: string; accounts: Account[]; valueTooltip: string }) {
  if (accounts.length === 0) return null;
  const isStation = accounts[0]?.kind === "station";
  const valueLabel = isStation ? "Balance" : "Est. Value";

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-1.5 text-[10px] uppercase font-bold text-muted-foreground tracking-wider bg-muted/20 sticky top-0 backdrop-blur z-10 border-y border-border/40 first:border-t-0">
        <span className="flex-1 shrink-0">{title}</span>
        <span className="w-14 text-center shrink-0">Traffic</span>
        <TooltipProvider>
          <UiTooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <span className="w-20 text-right shrink-0 cursor-help underline decoration-dotted underline-offset-2">{valueLabel}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[250px] text-xs font-normal">
              {valueTooltip}
            </TooltipContent>
          </UiTooltip>
        </TooltipProvider>
      </div>
      <div className="divide-y divide-border/40">
        {accounts.map((a) => {
          const Icon = KIND_ICON[a.kind];
          const displayValue = isStation ? a.account_amount : a.net_worth;
          const hasBudget = isStation && a.account_amount != null && a.account_max != null && a.account_max > 0;

          let trafficLabel = "Low";
          let trafficColor = "text-muted-foreground bg-muted/30";
          if (a.event_count > 50) {
            trafficLabel = "High";
            trafficColor = "text-[var(--success)] bg-[var(--success)]/10";
          } else if (a.event_count > 10) {
            trafficLabel = "Med";
            trafficColor = "text-gold bg-gold/10";
          }

          return (
            <div key={a.owner} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/10 transition-colors relative">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{a.name ?? a.owner}</span>

              <div className="w-14 flex justify-center shrink-0">
                <TooltipProvider>
                  <UiTooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <div className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold cursor-help ${trafficColor}`}>
                        {trafficLabel}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs font-normal">
                      {a.event_count} transaction events recorded
                    </TooltipContent>
                  </UiTooltip>
                </TooltipProvider>
              </div>

              <TooltipProvider>
                <UiTooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <span className="w-20 text-right shrink-0 cursor-default">
                      <Currency value={displayValue} icon={false} abbreviate className="w-20 text-right shrink-0" />
                    </span>
                  </TooltipTrigger>
                  {hasBudget && (
                    <TooltipContent side="top" align="end" className="text-xs font-normal space-y-1 p-2 bg-popover text-popover-foreground border border-border shadow-lg">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Current</span>
                        <span className="tabular-nums font-mono">{(a.account_amount ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Budget</span>
                        <span className="tabular-nums font-mono">{(a.account_max ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-4 font-medium pt-0.5 border-t border-border/40">
                        <span>{a.account_amount != null && a.account_max != null && a.account_amount >= a.account_max ? "Fully funded" : "Under-funded"}</span>
                        <span className="tabular-nums font-mono">
                          {a.account_min != null ? `${((a.account_amount ?? 0) / (a.account_max || 1) * 100).toFixed(0)}%` : "—"}
                        </span>
                      </div>
                    </TooltipContent>
                  )}
                </UiTooltip>
              </TooltipProvider>

              {hasBudget && <BudgetBar current={a.account_amount!} max={a.account_max!} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AccountsPanel({
  stationAccounts,
  shipAccounts,
  otherAccounts,
  totalVisibleAccounts,
}: {
  stationAccounts: Account[];
  shipAccounts: Account[];
  otherAccounts: Account[];
  totalVisibleAccounts: number;
}) {
  return (
    <HUDCard className="rounded-lg border-border flex flex-col overflow-hidden max-h-96">
      <CardHeader icon={Landmark} title="Accounts"
        extra={<span className="text-xs text-muted-foreground tabular-nums">{totalVisibleAccounts}</span>} />
      <div className="flex-1 overflow-auto bg-muted/5 relative">
        <AccountGroupRenderer
          title="Stations"
          accounts={stationAccounts}
          valueTooltip="Station account balance vs. operating budget target. The bar shows current / manager-requested budget."
        />
        <AccountGroupRenderer
          title="Ships (with value)"
          accounts={shipAccounts}
          valueTooltip="Total estimated value of the trade cargo currently held by this ship."
        />
        <AccountGroupRenderer
          title="Master Accounts"
          accounts={otherAccounts}
          valueTooltip="Your empire's overall net worth (total liquid cash + total value of all empire assets)."
        />
        {totalVisibleAccounts === 0 && <Empty text="No accounts match criteria." />}
      </div>
    </HUDCard>
  );
}
