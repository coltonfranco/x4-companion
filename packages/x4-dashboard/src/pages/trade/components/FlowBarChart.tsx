import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeftRight } from "lucide-react";
import { HUDCard } from "../../../components/layout/HUDCard";
import { EntityIcon } from "../../../components/game/EntityIcon";
import { formatCompactNumber } from "../../../lib/formatters";
import { CardHeader, Empty } from "./CardHeader";

/** One row of a two-directional flow (e.g. sales vs buys) for a single entity.
 *  `positiveQty`/`negativeQty` are optional companion unit counts — when every
 *  row supplies them, a quantity/credits metric toggle appears. */
export type FlowBarDatum = {
  key: string;
  label: string;
  iconUrl?: string | null;
  /** Rendered to the right, in the positive color. */
  positive: number;
  /** Rendered to the left, in the negative color. Always a non-negative magnitude. */
  negative: number;
  positiveQty?: number;
  negativeQty?: number;
};

type Mode = "net" | "gross";
type Metric = "credits" | "quantity";

export interface FlowBarChartProps {
  title: string;
  data: FlowBarDatum[];
  icon?: LucideIcon;
  positiveLabel?: string;
  negativeLabel?: string;
  netLabel?: string;
  formatValue?: (value: number) => string;
  formatQty?: (value: number) => string;
  emptyText?: string;
  className?: string;
  defaultMode?: Mode;
  /** Called with the row's `key` (e.g. a ware id) when a row is clicked — wire
   *  this up to open a detail view. Rows aren't clickable when omitted. */
  onRowClick?: (key: string) => void;
}

const GRID_STEPS = [-1, -0.5, 0, 0.5, 1];
const ROW_GRID = "grid grid-cols-[24px_8rem_1fr_8rem] items-center gap-3";
const VISIBLE_ROWS = 10;

const defaultFormatValue = (value: number) =>
  formatCompactNumber(value, { base: (v) => Math.round(v).toLocaleString() });

/**
 * Horizontal diverging bar chart: one row per entity. In "gross" mode a
 * positive-direction bar grows right and a negative-direction bar grows left
 * from a shared zero baseline; in "net" mode the two collapse into a single
 * bar colored by sign. Both bars in gross mode (and both signs in net mode)
 * share one linear scale so lengths stay comparable across rows. When every
 * row also carries a quantity pair, a credits/quantity metric toggle appears.
 * Rows beyond the 10th collapse behind a "Show all" control. Presentational
 * only — callers sort/limit/fetch the data.
 */
export function FlowBarChart({
  title,
  data,
  icon = ArrowLeftRight,
  positiveLabel = "Sales",
  negativeLabel = "Buys",
  netLabel = "Net",
  formatValue = defaultFormatValue,
  formatQty = defaultFormatValue,
  emptyText = "No trade data recorded.",
  className,
  defaultMode = "net",
  onRowClick,
}: FlowBarChartProps) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [metric, setMetric] = useState<Metric>("credits");
  const [expanded, setExpanded] = useState(false);

  const hasQty = data.length > 0 && data.every((d) => d.positiveQty != null && d.negativeQty != null);
  const useQty = metric === "quantity" && hasQty;
  const format = useQty ? formatQty : formatValue;

  const rows = useMemo(
    () => data
      .map((d) => ({
        ...d,
        pos: useQty ? d.positiveQty! : d.positive,
        neg: useQty ? d.negativeQty! : d.negative,
      }))
      // Ranked by total volume in the metric currently on screen (credits or
      // quantity), independent of the net/gross display mode.
      .sort((a, b) => (Math.abs(b.pos) + Math.abs(b.neg)) - (Math.abs(a.pos) + Math.abs(a.neg))),
    [data, useQty],
  );

  const grossMax = Math.max(1, ...rows.flatMap((r) => [r.pos, r.neg]));
  const netMax = Math.max(1, ...rows.map((r) => Math.abs(r.pos - r.neg)));
  const max = mode === "gross" ? grossMax : netMax;

  const visibleRows = expanded ? rows : rows.slice(0, VISIBLE_ROWS);

  return (
    <HUDCard className={`rounded-lg border-border overflow-hidden ${className ?? ""}`}>
      <CardHeader
        icon={icon}
        title={title}
        extra={
          <div className="flex items-center gap-3">
            {mode === "gross" ? (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <LegendSwatch color="var(--success)" label={positiveLabel} />
                <LegendSwatch color="var(--danger)" label={negativeLabel} />
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">{netLabel}</span>
            )}
            {hasQty && (
              <Pills value={metric} options={["credits", "quantity"]} labels={{ credits: "Cr", quantity: "Qty" }} onChange={setMetric} />
            )}
            <Pills value={mode} options={["net", "gross"]} labels={{ net: "Net", gross: "Gross" }} onChange={setMode} />
          </div>
        }
      />
      {data.length === 0 ? (
        <Empty text={emptyText} />
      ) : (
        <div className="divide-y divide-border/40">
          {visibleRows.map((d) => {
            const net = d.pos - d.neg;
            const netPositive = net >= 0;
            const posPct = (d.pos / max) * 50;
            const negPct = (d.neg / max) * 50;
            const netPct = (Math.abs(net) / max) * 50;
            return (
              <div
                key={d.key}
                className={`${ROW_GRID} px-4 py-2.5 hover:bg-muted/10 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                onClick={onRowClick ? () => onRowClick(d.key) : undefined}
              >
                <EntityIcon src={d.iconUrl} alt={d.label} size={24} />
                <div className="truncate text-sm">{d.label}</div>
                <div className="relative h-5">
                  {GRID_STEPS.map((t) => (
                    <div
                      key={t}
                      className={`absolute top-0 bottom-0 w-px ${t === 0 ? "bg-border" : "bg-border/30"}`}
                      style={{ left: `${50 + t * 50}%` }}
                    />
                  ))}
                  {mode === "gross" ? (
                    <>
                      {d.pos > 0 && (
                        <div
                          className="absolute h-3 top-1 rounded-r-[4px]"
                          style={{ left: "50%", width: `${posPct}%`, background: "var(--success)", opacity: 0.85 }}
                          title={`${positiveLabel}: ${format(d.pos)}`}
                        />
                      )}
                      {d.neg > 0 && (
                        <div
                          className="absolute h-3 top-1 rounded-l-[4px]"
                          style={{ right: "50%", width: `${negPct}%`, background: "var(--danger)", opacity: 0.85 }}
                          title={`${negativeLabel}: ${format(d.neg)}`}
                        />
                      )}
                    </>
                  ) : (
                    net !== 0 && (
                      <div
                        className={`absolute h-3 top-1 ${netPositive ? "rounded-r-[4px]" : "rounded-l-[4px]"}`}
                        style={netPositive
                          ? { left: "50%", width: `${netPct}%`, background: "var(--success)", opacity: 0.85 }
                          : { right: "50%", width: `${netPct}%`, background: "var(--danger)", opacity: 0.85 }}
                        title={`${netLabel}: ${format(net)}`}
                      />
                    )
                  )}
                </div>
                <div className="flex items-center justify-end gap-1.5 text-xs tabular-nums font-mono">
                  {mode === "gross" ? (
                    <>
                      <span style={{ color: "var(--success)" }}>{format(d.pos)}</span>
                      <span className="text-muted-foreground">/</span>
                      <span style={{ color: "var(--danger)" }}>{format(d.neg)}</span>
                    </>
                  ) : (
                    <span style={{ color: netPositive ? "var(--success)" : "var(--danger)" }}>{format(net)}</span>
                  )}
                </div>
              </div>
            );
          })}
          {rows.length > VISIBLE_ROWS && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 transition-colors"
            >
              {expanded ? "Show less" : `Show all ${rows.length}`}
            </button>
          )}
          <div className={`${ROW_GRID} px-4 py-1.5`}>
            <div />
            <div />
            <div className="relative h-3 text-[10px] text-muted-foreground">
              {GRID_STEPS.map((t) => (
                <span key={t} className="absolute -translate-x-1/2 tabular-nums" style={{ left: `${50 + t * 50}%` }}>
                  {t === 0 ? "0" : format(t * max)}
                </span>
              ))}
            </div>
            <div />
          </div>
        </div>
      )}
    </HUDCard>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function Pills<T extends string>({
  value, options, labels, onChange,
}: {
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-[4px] bg-muted/30 p-0.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`text-[11px] px-2 py-1 rounded-sm transition-colors ${
            value === o ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {labels[o]}
        </button>
      ))}
    </div>
  );
}
