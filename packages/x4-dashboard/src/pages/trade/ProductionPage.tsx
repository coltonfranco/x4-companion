import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useHasSave } from "../../lib/useHasSave";
import { cn } from "../../lib/utils";
import { PageLoaderPreset } from "../../components/layout/PageLoader";
import { Currency } from "../../components/game/Currency";
import { RACE_COLORS, methodLabel } from "../../lib/constants";
import { Recycle } from "lucide-react";
import { apiGet } from "../../lib/api";
import type { ChainNode, ChainResponse, Overlay } from "./lib/productionChainTypes";
import { DEPTH_LABEL, LAY, balanceColor, buildProductionLayout, fmt, groupHex, hexA, overlayValue, tierHex } from "./lib/productionChainLayout";
import { ProductionDetailSidebar } from "./components/ProductionDetailSidebar";

export default function ProductionChainsPage() {
  const { hasSave } = useHasSave();
  const { data, isLoading } = useQuery<ChainResponse>({
    queryKey: ["production-chain"],
    queryFn: () => apiGet<ChainResponse>("/api/v1/economy/production-chain"),
    staleTime: 5 * 60_000,
  });

  const [overlay, setOverlay] = useState<Overlay>("price");
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [nodeMethods, setNodeMethods] = useState<Record<string, string>>({});

  // Default the overlay to the richest available signal once data loads.
  const effectiveOverlay: Overlay =
    overlay === "market" && !data?.has_market
      ? "price"
      : overlay === "empire" && !data?.has_empire
      ? "price"
      : overlay;

  const layout = useMemo(
    () => buildProductionLayout(data?.nodes ?? [], nodeMethods),
    [data, nodeMethods]
  );

  // The active highlight set + whether it's a locked selection.
  //  • locked selection → the node's full upstream (what makes it) + downstream
  //    (what it feeds) chain, everything else dimmed.
  //  • hover only (nothing locked) → a light preview of direct neighbours.
  const { highlight, locked } = useMemo(() => {
    const util = layout.utility;
    // Walk the chain but never step through a utility ware (it would drag in half the
    // grid). Utilities only join the highlight when they are themselves the focus.
    const collect = (start: string, adj: Map<string, string[]>) => {
      const seen = new Set<string>();
      const stack = [...(adj.get(start) ?? [])];
      while (stack.length) {
        const x = stack.pop()!;
        if (seen.has(x)) continue;
        seen.add(x);
        if (util.has(x)) continue;
        (adj.get(x) ?? []).forEach((n) => !seen.has(n) && stack.push(n));
      }
      return seen;
    };
    const neighbours = (id: string) =>
      [...(layout.inputsOf.get(id) ?? []), ...(layout.consumersOf.get(id) ?? [])];
    if (selected) {
      // Locked: the node's full upstream + downstream chain.
      const set = new Set<string>([
        selected,
        ...collect(selected, layout.inputsOf),
        ...collect(selected, layout.consumersOf),
      ]);
      return { highlight: set, locked: true };
    }
    if (hover) {
      // Preview: just direct producers/consumers.
      return { highlight: new Set<string>([hover, ...neighbours(hover)]), locked: false };
    }
    return { highlight: null as Set<string> | null, locked: false };
  }, [selected, hover, layout.inputsOf, layout.consumersOf, layout.utility]);

  const byId = layout.byId;

  if (isLoading) return <PageLoaderPreset preset="trade" />;
  if (!data) return null;

  const selectedNode = selected ? byId.get(selected) ?? null : null;

  // Scale for balance coloring — overlay-relative so colours stay meaningful.
  const scale = effectiveOverlay === "empire" ? 50 : effectiveOverlay === "market" ? 200 : 0;

  // Deficit banner: worst by the active overlay (price overlay has no deficit notion).
  const deficits =
    effectiveOverlay === "price"
      ? []
      : data.nodes
          .map((n) => ({ n, v: overlayValue(n, effectiveOverlay) }))
          .filter((x) => x.v != null && x.v < -scale)
          .sort((a, b) => (a.v ?? 0) - (b.v ?? 0))
          .slice(0, 6);

  const overlayChips: { k: Overlay; label: string; disabled: boolean; reason?: string }[] = [
    { k: "price", label: "Price", disabled: false },
    {
      k: "market",
      label: "Market Demand",
      disabled: !data.has_market,
      reason: "Load a save to see live galaxy supply/demand",
    },
    {
      k: "empire",
      label: "Empire Balance",
      disabled: !data.has_empire,
      reason: "Build production stations to see your empire's balance",
    },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Production Chains</h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {data.nodes.length} wares · {data.methods.length} recipe methods · production
            complexity left → right
          </p>
        </div>

        <div className="flex items-center gap-4">
          {effectiveOverlay !== "price" && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mr-2">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--success)" }} />Surplus
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--warning)" }} />Balanced
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--danger)" }} />Deficit
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Overlay
            </span>
            <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
              {overlayChips.map((c) => (
                <button
                  key={c.k}
                  disabled={c.disabled}
                  title={c.disabled ? c.reason : undefined}
                  onClick={() => setOverlay(c.k)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    c.disabled
                      ? "cursor-not-allowed text-muted-foreground/40"
                      : effectiveOverlay === c.k
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* deficit banner */}
      {deficits.length > 0 && (
        <div className="mx-6 mb-3 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-destructive">
            ⚠ {effectiveOverlay === "empire" ? "Empire deficit" : "Under-supplied"}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {deficits.map(({ n, v }) => (
              <button
                key={n.ware_id}
                onClick={() => setSelected(n.ware_id)}
                className="flex items-center gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-2.5 py-1 hover:bg-destructive/20"
              >
                <span className="text-xs text-foreground">{n.name}</span>
                <span className="font-mono text-[11px] font-semibold text-destructive">
                  {fmt(v ?? 0)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!hasSave && (
        <p className="px-6 pb-2 text-xs text-amber-300/60">
          Showing static recipes &amp; reference prices. Load a save to unlock Market Demand
          and Empire Balance overlays.
        </p>
      )}

      {/* chart + detail sidebar */}
      <div className="mx-6 mb-6 flex min-h-0 flex-1 gap-3">
        {/* clicking empty chart space clears the locked selection */}
        <div
          className="min-w-0 flex-1 overflow-auto rounded-xl border border-border bg-[var(--surface-1)]"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative"
            style={{ width: layout.chartW, height: layout.chartH }}
            onMouseLeave={() => setHover(null)}
          >
            {/* column headers */}
            {layout.cols.map((c, d) => (
              <div
                key={d}
                className="absolute flex items-baseline gap-2 px-1 pb-2.5 pt-4"
                style={{
                  left: LAY.PADX + d * (LAY.COLW + LAY.GAP),
                  top: 0,
                  width: LAY.COLW,
                  borderBottom: `2px solid ${hexA(tierHex(d), 0.55)}`,
                }}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 self-center rounded-sm"
                  style={{ background: tierHex(d) }}
                />
                <span className="text-[17px] font-semibold" style={{ color: tierHex(d) }}>
                  {DEPTH_LABEL[d] ?? `Tier ${d}`}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">{c.length}</span>
              </div>
            ))}

            {/* edges — hidden until a node is hovered or locked */}
            <svg
              className="pointer-events-none absolute left-0 top-0 overflow-visible"
              style={{ width: layout.chartW, height: layout.chartH }}
            >
              {highlight &&
                layout.edges.map((e, i) => {
                  if (!highlight.has(e.a) || !highlight.has(e.b)) return null;
                  // When locked, foreground the selected node's own connections and let the
                  // rest of the chain recede so the focus reads clearly.
                  const direct = !locked || e.a === selected || e.b === selected;
                  const sw = direct ? Math.max(e.width, 2.2) : e.width;
                  const op = direct ? 0.95 : 0.28;

                  if (e.util) {
                    return (
                      <g key={i} opacity={op}>
                        <path
                          d={`M ${e.x1} ${e.y1} h 12`}
                          fill="none"
                          stroke={e.stroke}
                          strokeWidth={sw}
                          strokeLinecap="round"
                        />
                        <circle cx={e.x1 + 12} cy={e.y1} r={sw * 1.2} fill={e.stroke} />
                        <path
                          d={`M ${e.x2} ${e.y2} h -12`}
                          fill="none"
                          stroke={e.stroke}
                          strokeWidth={sw}
                          strokeLinecap="round"
                        />
                        <circle cx={e.x2 - 12} cy={e.y2} r={sw * 1.2} fill={e.stroke} />
                      </g>
                    );
                  }

                  return (
                    <path
                      key={i}
                      d={e.d}
                      fill="none"
                      stroke={e.stroke}
                      strokeWidth={sw}
                      strokeLinecap="round"
                      opacity={op}
                    />
                  );
                })}
            </svg>

            {/* nodes */}
            {data.nodes.map((n) => {
              const p = layout.pos.get(n.ware_id)!;
              const v = overlayValue(n, effectiveOverlay);
              const isSel = locked && n.ware_id === selected;
              const dim = highlight ? !highlight.has(n.ware_id) : false;
              const active = highlight?.has(n.ware_id) ?? false;
              const gh = groupHex(n.group_id);
              const valColor =
                v == null
                  ? "var(--text-faint)"
                  : effectiveOverlay === "price"
                  ? "var(--gold)"
                  : balanceColor(v, scale);
              const valText =
                v == null
                  ? "—"
                  : effectiveOverlay === "price"
                  ? fmt(v)
                  : (v >= 0 ? "+" : "") + fmt(v);
              const alts = Object.keys(n.recipes).filter((m) => m !== "default");
              const displayAlts = alts.filter((m) => !m.toLowerCase().includes("recycling"));

              const isRecyclable = Object.keys(n.recipes).some(m => m.toLowerCase().includes("recycling"));
              const hasProducer = n.producer_modules.length > 0;
              const uniqueRaces = new Set(n.producer_modules.map((m) => m.makerrace));
              const exclusiveRaceName = hasProducer && uniqueRaces.size === 1 ? [...uniqueRaces][0] : null;
              const exclusiveRace = exclusiveRaceName ? RACE_COLORS[exclusiveRaceName] : null;
              const borderColor = isSel
                ? hexA(gh, 0.9)
                : active || hover === n.ware_id
                ? hexA(gh, 0.55)
                : "var(--border)";
              return (
                <div
                  key={n.ware_id}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setSelected((cur) => (cur === n.ware_id ? null : n.ware_id));
                  }}
                  onMouseEnter={() => setHover(n.ware_id)}
                  className="absolute flex cursor-pointer items-center gap-2.5 rounded-md border px-3 transition-opacity"
                  style={{
                    left: p.x,
                    top: p.y,
                    width: LAY.COLW,
                    height: LAY.NODEH,
                    background: isSel
                      ? hexA(gh, 0.2)
                      : active || hover === n.ware_id
                      ? hexA(gh, 0.12)
                      : "var(--surface-2)",
                    borderTopColor: borderColor,
                    borderRightColor: borderColor,
                    borderBottomColor: borderColor,
                    borderLeftColor: gh,
                    borderLeftWidth: "3px",
                    opacity: dim ? 0.28 : 1,
                    boxShadow: isSel ? `0 0 0 1px ${hexA(gh, 0.5)}` : undefined,
                  }}
                >
                  {n.icon_url ? (
                    <span
                      className="h-[18px] w-[18px] shrink-0"
                      style={{
                        backgroundColor: gh,
                        WebkitMask: `url(${n.icon_url}) center/contain no-repeat`,
                        mask: `url(${n.icon_url}) center/contain no-repeat`,
                      }}
                    />
                  ) : (
                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: gh }} />
                  )}
                  <span className="truncate text-[13.5px] text-foreground">{n.name}</span>
                  <span className="flex-1" />

                  <div className="flex shrink-0 items-center gap-1.5 mr-1">

                    {isRecyclable && (
                      <span title="Can be produced via recycling">
                        <Recycle className="shrink-0 w-3.5 h-3.5 text-muted-foreground" />
                      </span>
                    )}
                    {exclusiveRace && (
                      <span
                        className={cn("shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase", exclusiveRace.bg, exclusiveRace.color)}
                        title={`${methodLabel(exclusiveRaceName!)} Exclusive`}
                      >
                        {exclusiveRace.abbr}
                      </span>
                    )}
                    {displayAlts.length > 0 && (
                      <span
                        className="shrink-0 rounded px-1 py-0.5 font-mono text-[9px] font-semibold uppercase text-muted-foreground"
                        style={{ background: hexA(gh, 0.16) }}
                        title={`Alternate recipes: ${displayAlts.map(methodLabel).join(", ")}`}
                      >
                        {displayAlts.length} alt
                      </span>
                    )}
                  </div>

                  <div className="min-w-[2.5rem] shrink-0 flex justify-end">
                    {effectiveOverlay === "price" && v != null ? (
                      <Currency value={v} className="text-[12px]" abbreviate />
                    ) : (
                      <span
                        className="shrink-0 font-mono text-[12px] font-semibold text-right"
                        style={{ color: valColor }}
                      >
                        {valText}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* detail sidebar — compact, purpose-built */}
        {selectedNode && (
          <ProductionDetailSidebar
            node={selectedNode}
            consumers={(layout.allConsumersOf.get(selectedNode.ware_id) ?? [])
              .map((id) => byId.get(id))
              .filter((x): x is ChainNode => !!x)}
            byId={byId}
            overlay={effectiveOverlay}
            scale={scale}
            hasMarket={data.has_market}
            hasEmpire={data?.has_empire ?? false}
            activeMethod={nodeMethods[selectedNode.ware_id] ?? "default"}
            onMethodChange={(m) => setNodeMethods((prev) => ({ ...prev, [selectedNode.ware_id]: m }))}
            onSelect={setSelected}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}
