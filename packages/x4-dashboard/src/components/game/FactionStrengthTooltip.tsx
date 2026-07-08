import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { ordinal } from "../../lib/formatters";
import { breakdownKey, rankBarPct } from "../../lib/factionStrength";
import type { FactionStrength, MetricKey } from "../../lib/factionStrength";

type Metric = {
  key: MetricKey;
  label: string;
  color: string;
};

const INDEX_LABEL: Record<string, string> = {
  military_score: "Raw Power Index",
  economic_score: "Raw Capacity Index",
  diplomatic_score: "Diplomatic Posture",
  territory_score: "Territory Index",
};

const FORMULA_LABEL: Record<string, string> = {
  military_score: "combat ships + defensive stations + shipbuilding",
  economic_score: "production + trade + economic ships + sectors",
  diplomatic_score: "relationship tiers mapped to posture",
  territory_score: "sector presence + cluster presence",
};

export function FactionStrengthTooltip({
  children,
  faction,
  metric,
  rank,
  subjectLabel = "Faction",
}: {
  children: ReactNode;
  faction: FactionStrength;
  metric: Metric;
  rank: { rank: number; total: number } | null;
  subjectLabel?: string;
}) {
  const breakdown = faction[breakdownKey(metric.key)];
  const percentile = rank ? rankBarPct(rank.rank, rank.total) : 0;
  const maxComponent = Math.max(...breakdown.components.map((c) => c.value), 1);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="w-[300px] overflow-visible rounded-none border border-blue-500/50 bg-[#050914] p-4 text-foreground shadow-[0_0_24px_rgba(30,90,180,0.25)]"
        >
          <div className="pointer-events-none absolute left-2 top-2 h-3 w-3 border-l border-t border-blue-400" />
          <div className="pointer-events-none absolute bottom-2 right-2 h-3 w-3 border-b border-r border-blue-400" />

          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full shadow-[0_0_10px_currentColor]" style={{ color: metric.color, backgroundColor: metric.color }} />
                <span className="text-sm font-bold" style={{ color: "white" }}>{metric.label}</span>
              </div>
              <div className="mt-3 text-3xl font-bold leading-none tabular-nums" style={{ color: metric.color }}>
                {formatIndex(breakdown.raw)}
              </div>
              <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-blue-300/60">
                {INDEX_LABEL[metric.key]}
              </div>
            </div>

            <div className="text-right">
              {rank && (
                <div className="inline-flex bg-slate-900/80 px-2 py-1 text-[10px] font-bold tabular-nums text-slate-200">
                  #{rank.rank} of {rank.total}
                </div>
              )}
              <div className="mt-4 inline-flex bg-slate-900/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider tabular-nums" style={{ color: metric.color }}>
                {ordinal(percentile)} pct
              </div>
              <div className="mt-1 text-[10px] tabular-nums text-blue-200/70">
                {breakdown.leader_ratio.toFixed(0)}% of leader
              </div>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex justify-between text-[9px] uppercase tracking-[0.3em] text-blue-300/45">
              <span>{subjectLabel}</span>
              <span>Leader</span>
            </div>
            <div className="mt-1 h-1.5 bg-slate-800">
              <div className="h-full" style={{ width: `${Math.min(100, breakdown.leader_ratio)}%`, backgroundColor: metric.color }} />
            </div>
          </div>

          <div className="mt-5 border-t border-blue-300/10 pt-3">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-blue-300">
              &gt; Score breakdown
            </div>
            <div className="space-y-3">
              {breakdown.components.map((component) => (
                <div key={component.label}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="text-xs text-slate-100">{component.label}</span>
                    <span className="font-mono text-xs font-bold tabular-nums text-white">
                      {formatIndex(component.value)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.max(4, Math.min(100, (component.value / maxComponent) * 100))}%`,
                        backgroundColor: metric.color,
                      }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-blue-200/50">{component.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 border-t border-blue-300/10 pt-3 text-[10px] text-blue-200/35">
            = {FORMULA_LABEL[metric.key]}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatIndex(value: number): string {
  return Math.round(value).toLocaleString();
}
