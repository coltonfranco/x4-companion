import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { MapPin, Info } from "lucide-react";
import { cn } from "../../../lib/utils";
import { Currency } from "../../../components/game/Currency";
import { FactionBadge } from "../../../components/game/FactionBadge";
import { getWareGroupColor, RACE_COLORS, methodLabel } from "../../../lib/constants";
import { prettyId } from "../../../lib/wareFormat";
import { useFactionMap } from "../../../lib/useFactionMap";
import { usePlayerLicences } from "../../../lib/usePlayerLicences";
import type { FactionSummary } from "../../../lib/types";
import { ModuleDetailPanel, type ModuleSummary } from "../../../components/detail-panels/ModuleDetailPanel";
import { WareDetailPanel } from "../../../components/detail-panels/WareDetailPanel";
import { DetailDialog } from "../../../components/ui/detail-dialog";
import { apiGet, apiGetArray } from "../../../lib/api";
import type { ChainNode, Overlay, SectorRow, WareOfferRow } from "../lib/productionChainTypes";
import { DEPTH_LABEL, balanceColor, fmt, groupHex, hexA, overlayValue, tierHex } from "../lib/productionChainLayout";

function ConnectedWareDetailDialog({
  wareId,
  onClose,
}: {
  wareId: string | null;
  onClose: () => void;
}) {
  return (
    <DetailDialog
      open={wareId !== null}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Commodity Details"
      description="Detailed view of the selected commodity"
      contentClassName="sm:max-w-2xl md:max-w-4xl min-h-[60vh] max-h-[90vh] overflow-y-auto"
    >
      {wareId && <WareDetailPanel wareId={wareId} />}
    </DetailDialog>
  );
}

function ConnectedModuleDetailDialog({
  moduleId,
  moduleName,
  factions,
  onClose,
}: {
  moduleId: string | null;
  moduleName: string | null;
  factions: FactionSummary[];
  onClose: () => void;
}) {
  const { data: summary } = useQuery({
    queryKey: ["module", moduleId],
    queryFn: () => apiGet<ModuleSummary>(`/api/v1/modules/${moduleId}`),
    enabled: !!moduleId,
    staleTime: Infinity,
  });

  const { data: playerLicences = [] } = usePlayerLicences();

  const licenceSet = useMemo(
    () => new Set(playerLicences.map((l) => `${l.faction_id}:${l.licence_type}`)),
    [playerLicences]
  );
  const anyLicenceSet = useMemo(
    () => new Set(playerLicences.map((l) => l.licence_type)),
    [playerLicences]
  );

  return (
    <DetailDialog
      open={moduleId !== null}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={moduleName ?? "Module details"}
      description={`Detailed stats for ${moduleName}`}
      contentClassName="sm:max-w-2xl md:max-w-3xl min-h-[50vh] max-h-[90vh] overflow-y-auto"
    >
      {moduleId && summary && (
        <ModuleDetailPanel
          moduleId={moduleId}
          summary={summary}
          factions={factions}
          licenceSet={licenceSet}
          anyLicenceSet={anyLicenceSet}
        />
      )}
    </DetailDialog>
  );
}

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <div className="mb-2 mt-5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground first:mt-0">
    {children}
  </div>
);

const Row = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="flex items-center justify-between py-0.5">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-mono font-medium" style={{ color }}>
      {value}
    </span>
  </div>
);

export function ProductionDetailSidebar({
  node,
  consumers,
  byId,
  overlay,
  scale,
  hasMarket,
  hasEmpire,
  activeMethod,
  onMethodChange,
  onSelect,
  onClose,
}: {
  node: ChainNode;
  consumers: ChainNode[];
  byId: Map<string, ChainNode>;
  overlay: Overlay;
  scale: number;
  hasMarket: boolean;
  hasEmpire: boolean;
  activeMethod: string;
  onMethodChange: (m: string) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const ownMethods = Object.keys(node.recipes).sort((a, b) =>
    a === "default" ? -1 : b === "default" ? 1 : a.localeCompare(b)
  );

  const getModuleMethod = (mod: typeof node.producer_modules[0]) => {
    const isRecycler =
      mod.name?.toLowerCase().includes("recycl") ||
      mod.name?.toLowerCase().includes("scrap") ||
      mod.module_id.toLowerCase().includes("recycl") ||
      mod.module_id.toLowerCase().includes("scrap");

    if (isRecycler && node.recipes["terranrecycling"]) return "terranrecycling";
    if (isRecycler && node.recipes["recycling"]) return "recycling";
    if (isRecycler && node.recipes["processing"]) return "processing";

    const modMethod = mod.production_method || "default";
    if (node.recipes[modMethod]) return modMethod;
    if (modMethod.includes("recycling") && node.recipes["recycling"]) return "recycling";

    if (!node.recipes["default"] && ownMethods.length > 0) return ownMethods[0];
    return "default";
  };

  const methodToUse = node.recipes[activeMethod]
    ? activeMethod
    : node.recipes["default"]
    ? "default"
    : ownMethods[0] ?? "default";

  const recipe = node.recipes[methodToUse] ?? null;
  const [selectedModule, setSelectedModule] = useState<{ id: string; name: string } | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const { data: offers = [] } = useQuery<WareOfferRow[]>({
    queryKey: ["economy", "wares", node.ware_id, "stations"],
    queryFn: () =>
      apiGetArray<WareOfferRow>(`/api/v1/economy/wares/${encodeURIComponent(node.ware_id)}/stations`),
    enabled: hasMarket,
    staleTime: 60_000,
  });
  // Faction + sector lookups resolve the offer rows' ids to display names.
  const { data: factions = [] } = useQuery<FactionSummary[]>({
    queryKey: ["factions"],
    queryFn: () => apiGet<FactionSummary[]>("/api/v1/factions"),
    staleTime: Infinity,
  });
  const { data: sectors = [] } = useQuery<SectorRow[]>({
    queryKey: ["map-sectors"],
    queryFn: () => apiGetArray<SectorRow>("/api/v1/map/sectors?limit=2000"),
    staleTime: 10 * 60_000,
    enabled: hasMarket,
  });
  const factionMap = useFactionMap(factions);
  const sectorName = useMemo(() => {
    const m = new Map<string, string>();
    sectors.forEach((s) => s.name && m.set(s.sector_id.toLowerCase(), s.name));
    return (id: string | null) => (id ? m.get(id.toLowerCase()) ?? prettyId(id) : null);
  }, [sectors]);

  const gh = groupHex(node.group_id);
  const price = node.market_avg ?? node.price_avg;
  const v = overlayValue(node, overlay);
  const netLabel =
    overlay === "empire" ? "Empire Net /h" : overlay === "market" ? "Market Net" : "Net Demand";
  const netVal = overlay === "price" ? node.net_demand : v;
  const netColor =
    netVal == null
      ? "var(--text-faint)"
      : balanceColor(netVal, overlay === "price" ? 0 : scale);
  const sellers = offers
    .filter((o) => o.side === "sell")
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 6);

  const Ware = ({ id, qty, bold }: { id: string; qty?: number; bold?: boolean }) => {
    const w = byId.get(id);
    return (
      <button
        onClick={() => w && onSelect(id)}
        disabled={!w}
        className={cn(
          "flex w-full items-center gap-2 py-1.5 text-left",
          w && "hover:text-primary"
        )}
      >
        {w?.icon_url ? (
          <span
            className="h-3 w-3 shrink-0"
            style={{
              backgroundColor: groupHex(w.group_id),
              WebkitMask: `url(${w.icon_url}) center/contain no-repeat`,
              mask: `url(${w.icon_url}) center/contain no-repeat`,
            }}
          />
        ) : (
          <span
            className="h-2 w-2 shrink-0 rounded-sm"
            style={{ background: groupHex(w?.group_id ?? null) }}
          />
        )}
        <span className={cn("flex-1 truncate text-[13px]", bold && "font-semibold")}>
          {w?.name ?? id}
        </span>
        {qty != null && (
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">×{qty}</span>
        )}
      </button>
    );
  };

  return (
    <aside className="relative flex w-[388px] flex-none flex-col overflow-y-auto rounded-xl border border-border bg-[var(--surface-2)]">
      {/* header */}
      <div className="sticky top-0 z-10 border-b border-border bg-[var(--surface-2)] p-4">
        <div className="flex items-start gap-2">
          <span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ background: gh }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold leading-tight">{node.name}</div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide"
                style={{ background: hexA(tierHex(node.depth), 0.14), color: tierHex(node.depth) }}
              >
                {DEPTH_LABEL[node.depth] ?? `Tier ${node.depth}`}
              </span>
              {node.group_id && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border capitalize ${getWareGroupColor(node.group_id)}`}>
                  {node.group_id.replace("_", " ")}
                </span>
              )}
              {(() => {
                const hasProducer = node.producer_modules.length > 0;
                const uniqueRaces = new Set(node.producer_modules.map((m) => m.makerrace));
                const exclusiveRaceName = hasProducer && uniqueRaces.size === 1 ? [...uniqueRaces][0] : null;
                const exclusiveRace = exclusiveRaceName ? RACE_COLORS[exclusiveRaceName] : null;
                return exclusiveRace ? (
                  <span
                    className={cn("inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase", exclusiveRace.bg, exclusiveRace.color)}
                  >
                    {methodLabel(exclusiveRaceName!)} Exclusive
                  </span>
                ) : null;
              })()}
            </div>
          </div>
          <button
            onClick={() => setDetailModalOpen(true)}
            aria-label="Open detailed view"
            title="Open detailed view"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
          >
            <Info className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            aria-label="Close details"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-md border border-border bg-[var(--surface-1)] px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
              Avg Price
            </div>
            <div className="mt-0.5 flex items-center">
              {price != null ? <Currency value={price} className="text-base" /> : <span className="font-mono text-base font-semibold" style={{ color: "var(--gold)" }}>—</span>}
            </div>
          </div>
          <div className="rounded-md border border-border bg-[var(--surface-1)] px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
              {netLabel}
            </div>
            <div className="font-mono text-base font-semibold" style={{ color: netColor }}>
              {netVal == null ? "—" : (netVal >= 0 ? "+" : "") + fmt(netVal)}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* supply vs demand */}
        {(hasEmpire || hasMarket) && (
          <>
            <SectionTitle>Supply vs Demand</SectionTitle>
            <div className="space-y-2">
              {hasEmpire &&
                (node.empire_production != null || node.empire_consumption != null) && (
                  <div className="rounded-lg border border-border bg-[var(--surface-1)] px-3 py-2 text-[12px]">
                    <div className="mb-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                      Your empire
                    </div>
                    <Row label="Production" value={`${fmt(node.empire_production ?? 0)}/h`} color="var(--success)" />
                    <Row label="Consumption" value={`${fmt(node.empire_consumption ?? 0)}/h`} color="var(--danger)" />
                  </div>
                )}
              {hasMarket && (node.sell_qty != null || node.buy_qty != null) && (
                <div className="rounded-lg border border-border bg-[var(--surface-1)] px-3 py-2 text-[12px]">
                  <div className="mb-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                    Galaxy market
                  </div>
                  <Row label="Supply (for sale)" value={fmt(node.sell_qty ?? 0)} color="var(--success)" />
                  <Row label="Demand (wanted)" value={fmt(node.buy_qty ?? 0)} color="var(--danger)" />
                </div>
              )}
            </div>
          </>
        )}

        {/* recipe */}
        <SectionTitle>Recipe</SectionTitle>
        {ownMethods.length > 1 ? (
          <div className="mb-2 flex flex-wrap gap-1">
            {ownMethods.map((m) => {
              const modulesForMethod = node.producer_modules.filter(mod => getModuleMethod(mod) === m);

              const methodUniqueRaces = new Set(modulesForMethod.map((mod) => mod.makerrace));
              const methodExclusiveRace = modulesForMethod.length > 0 && methodUniqueRaces.size === 1 && modulesForMethod[0].makerrace ? [...methodUniqueRaces][0] : null;
              const labelStr = m === "default" ? (methodExclusiveRace || "Generic") : m;

              return (
                <button
                  key={m}
                  onClick={() => onMethodChange(m)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                    m === methodToUse
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {methodLabel(labelStr)}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mb-2 text-[11px] text-muted-foreground">
            {node.producer_modules.length > 0 && new Set(node.producer_modules.map((m) => m.makerrace)).size === 1 && node.producer_modules[0].makerrace
              ? `${methodLabel(node.producer_modules[0].makerrace)} Exclusive Blueprint`
              : "Universal Blueprint"}
          </div>
        )}
        {recipe ? (
          <div className="rounded-lg border border-border bg-[var(--surface-1)] px-3 py-2">
            {recipe.inputs.map((inp) => (
              <Ware key={inp.ware_id} id={inp.ware_id} qty={inp.amount} />
            ))}
            <div className="mt-1 flex items-center gap-2 border-t border-border/50 pt-2">
              <span className="text-muted-foreground">↳</span>
              {node.icon_url ? (
                <span
                  className="h-3 w-3 shrink-0"
                  style={{
                    backgroundColor: gh,
                    WebkitMask: `url(${node.icon_url}) center/contain no-repeat`,
                    mask: `url(${node.icon_url}) center/contain no-repeat`,
                  }}
                />
              ) : (
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: gh }} />
              )}
              <span className="flex-1 truncate text-[13px] font-semibold">{node.name}</span>
              <span className="font-mono text-[11px] text-muted-foreground">×{recipe.amount}</span>
            </div>
            <div className="mt-2 font-mono text-[10px] text-muted-foreground">
              Cycle {Math.round(recipe.time_sec)}s
              {recipe.workforce ? ` · ${recipe.workforce} workforce` : ""}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
            Raw resource — mined or collected directly, no production recipe.
          </div>
        )}

        {/* production modules */}
        {node.producer_modules.length > 0 && (() => {
          const filteredModules = node.producer_modules.filter(m => getModuleMethod(m) === methodToUse);

          if (filteredModules.length === 0) return null;

          return (
          <>
            <SectionTitle>Produced In · Station Modules</SectionTitle>
            <div className="space-y-1.5">
              {filteredModules.map((m) => {
                const f = m.makerrace ? factionMap.get(m.makerrace) : undefined;
                return (
                  <button
                    key={m.module_id}
                    onClick={() => setSelectedModule({ id: m.module_id, name: m.name ?? prettyId(m.module_id) })}
                    className="flex w-full items-center gap-2 rounded-md border border-border bg-[var(--surface-1)] px-3 py-1.5 hover:border-primary transition-colors text-left"
                  >
                    {f && f.icon_url ? (
                      <span
                        className="h-3 w-3 shrink-0"
                        style={{
                          backgroundColor: f.color_hex ?? gh,
                          WebkitMask: `url(${f.icon_url}) center/contain no-repeat`,
                          mask: `url(${f.icon_url}) center/contain no-repeat`,
                        }}
                      />
                    ) : (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-sm" style={{ background: f?.color_hex ?? gh }} />
                    )}
                    <span className="flex-1 truncate text-[12px]">{m.name ?? prettyId(m.module_id)}</span>
                    <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                      {f ? f.name : (m.makerrace ?? "Generic")}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
          );
        })()}

        {/* feeds into */}
        {consumers.length > 0 && (
          <>
            <SectionTitle>Feeds Into</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {consumers.map((c) => (
                <button
                  key={c.ware_id}
                  onClick={() => onSelect(c.ware_id)}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-[var(--surface-1)] px-2 py-1 text-[12px] hover:text-primary"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-sm"
                    style={{ background: groupHex(c.group_id) }}
                  />
                  {c.name}
                </button>
              ))}
            </div>
          </>
        )}

        {/* available from (sellers) */}
        {sellers.length > 0 && (
          <>
            <SectionTitle>Available From</SectionTitle>
            <div className="space-y-1.5">
              {sellers.map((o) => {
                const f = o.owner_faction ? factionMap.get(o.owner_faction) : undefined;
                const sec = sectorName(o.sector_id);
                return (
                  <div
                    key={o.station_id}
                    className="flex items-center gap-2 rounded-md border border-border bg-[var(--surface-1)] px-3 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-[13px] font-medium text-foreground">
                        <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{sec ?? "Unknown Sector"}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {f && (
                          <FactionBadge
                            size="sm"
                            name={f.name}
                            color_hex={f.color_hex}
                            icon_url={f.icon_url}
                            faction_id={f.faction_id}
                          />
                        )}
                        <span className="truncate text-[10.5px] text-muted-foreground">
                          {o.station_name ?? o.station_code ?? o.station_id}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-mono text-[11px]">
                      <div style={{ color: "var(--success)" }}>{fmt(o.quantity)}</div>
                      <div>
                        <Currency value={o.price} className="text-[11px]" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <ConnectedWareDetailDialog
        wareId={detailModalOpen ? node.ware_id : null}
        onClose={() => setDetailModalOpen(false)}
      />

      <ConnectedModuleDetailDialog
        moduleId={selectedModule?.id ?? null}
        moduleName={selectedModule?.name ?? null}
        factions={factions}
        onClose={() => setSelectedModule(null)}
      />
    </aside>
  );
}
