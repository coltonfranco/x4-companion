import { useQuery } from "@tanstack/react-query";

import { StatBar } from "../data-display/StatBar";
import { Currency } from "../game/Currency";
import { FactionBadge } from "../game/FactionBadge";
import { SizeBadge } from "../game/ShipBadges";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { apiGet } from "../../lib/api";
import { prettyId } from "../../lib/wareFormat";
import { stationCategoryLabel } from "../../lib/map/stations";
import { StationTypeIcon } from "../map/StationMapIcon";
import { KIND_COLORS, KIND_LABELS, moduleSizeToClassId } from "./ModuleDetailPanel";
import type { FactionSummary } from "../../lib/types";
import { cn } from "../../lib/utils";

export type StationSummary = {
  station_id: string;
  code: string | null;
  name: string | null;
  macro: string | null;
  owner_faction: string | null;
  sector_id: string | null;
  category: string | null;
  icon_group: string | null;
  is_player_owned: boolean;
  is_under_construction: boolean;
  build_pct: number | null;
  module_count: number | null;
  planned_module_count: number | null;
  account_amount: number | null;
  workforce_current: number | null;
  workforce_capacity: number | null;
  workforce_bonus: number | null;
  production_product: string | null;
  production_product_icon_url: string | null;
};

type StationModuleRow = {
  module_id: string;
  macro: string | null;
  name: string | null;
  kind: string | null;
  size: string | null;
  produces_ware_id: string | null;
  count: number;
  construction_pct: number | null;
};

type PlannedModule = { module_id: string; macro: string | null; name: string | null; kind: string | null; count: number };
type BuildMaterial = { ware_id: string; name: string | null; amount: number; price_avg: number | null; total: number | null };
type StationConstruction = {
  station_id: string;
  is_under_construction: boolean;
  build_pct: number | null;
  module_count: number | null;
  planned_module_count: number | null;
  planned_modules: PlannedModule[];
  bill_of_materials: BuildMaterial[];
};

type StationOffer = { ware_id: string; side: "buy" | "sell"; price: number; quantity: number };

function stationDisplayName(s: StationSummary): string {
  if (s.name && !s.name.startsWith("{")) return s.name;
  if (s.code) return s.code;
  return stationCategoryLabel(s.category);
}

const TabTrigger = (props: { value: string; children: React.ReactNode }) => (
  <TabsTrigger
    {...props}
    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3 pt-2 font-medium text-muted-foreground data-[state=active]:text-foreground transition-colors hover:text-foreground"
  />
);

export function StationDetailPanel({
  stationId,
  summary,
  factionMap,
  sectorName,
}: {
  stationId: string;
  summary?: StationSummary;
  factionMap?: Map<string, FactionSummary>;
  sectorName?: (id: string | null) => string;
}) {
  const { data: s } = useQuery<StationSummary>({
    queryKey: ["station", stationId],
    queryFn: () => apiGet<StationSummary>(`/api/v1/stations/${encodeURIComponent(stationId)}`),
    staleTime: 30_000,
    placeholderData: summary,
  });

  if (!s) {
    return <div className="p-6 text-sm text-muted-foreground">Loading station…</div>;
  }

  const faction = s.owner_faction ? factionMap?.get(s.owner_faction) : undefined;
  const sector = sectorName ? sectorName(s.sector_id) : s.sector_id;
  const hasWorkforce = (s.workforce_capacity ?? 0) > 0 || (s.workforce_current ?? 0) > 0;

  return (
    <div className="flex flex-col h-full -mx-6 -my-6">
      <div className="flex flex-col sm:flex-row gap-6 px-6 pt-6 pb-4">
        <div className="relative shrink-0 w-full sm:w-48 h-40 sm:h-48 flex items-center justify-center rounded-xl bg-muted/10 border border-border/60">
          <StationTypeIcon
            station={s}
            color={faction?.color_hex ?? "#8a97ad"}
            style={{ width: "68%", height: "68%" }}
          />
        </div>
        <div className="flex-1 flex flex-col justify-center min-w-0 py-1">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight truncate" title={stationDisplayName(s)}>
            {stationDisplayName(s)}
          </h2>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-medium border bg-muted text-muted-foreground border-border">
              {stationCategoryLabel(s.category)}
            </span>
            {faction && (
              <FactionBadge name={faction.name} color_hex={faction.color_hex} icon_url={faction.icon_url} faction_id={faction.faction_id} size="md" className="text-sm" />
            )}
            {s.is_under_construction ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-sm border bg-sky-500/10 text-sky-300 border-sky-500/30">Under Construction</span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-sm border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">Operational</span>
            )}
            {s.is_player_owned && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-sm border bg-amber-500/10 text-amber-300 border-amber-500/30">Player Owned</span>
            )}
          </div>
          <div className="mt-3 text-xs text-muted-foreground uppercase tracking-wide">
            {sector ?? "Unknown sector"}
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex-1 flex flex-col">
        <div className="border-b border-border/40 pb-px mt-2 px-6">
          <TabsList className="bg-transparent border-none p-0 h-auto space-x-6 w-full justify-start">
            <TabTrigger value="overview">Overview</TabTrigger>
            <TabTrigger value="modules">Modules</TabTrigger>
            {s.is_under_construction && <TabTrigger value="construction">Construction</TabTrigger>}
            <TabTrigger value="trade">Trade</TabTrigger>
            {hasWorkforce && <TabTrigger value="workforce">Workforce</TabTrigger>}
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6 pt-5 px-6 pb-6 outline-none">
          <div className="rounded-lg border border-border/50 bg-muted/5 px-6 py-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Status</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground uppercase">Account Budget</span>
                <div className="mt-1">
                  {s.account_amount != null ? <Currency value={s.account_amount} /> : <span className="text-muted-foreground">—</span>}
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase">Modules</span>
                <div className="font-mono text-sm font-semibold mt-1">
                  {s.is_under_construction
                    ? `${s.module_count ?? 0} / ${s.planned_module_count ?? "?"}`
                    : (s.module_count ?? 0)}
                </div>
              </div>
              {s.production_product && (
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Producing</span>
                  <div className="text-sm font-medium mt-1">{prettyId(s.production_product)}</div>
                </div>
              )}
            </div>
            {s.is_under_construction && s.build_pct != null && (
              <div className="mt-4">
                <StatBar value={s.build_pct} max={100} labelLeft="Build Progress" labelRight={`${Math.round(s.build_pct)}%`} height={8} />
              </div>
            )}
          </div>
          <div className="text-center text-[10px] text-muted-foreground/50 font-mono">{s.station_id}</div>
        </TabsContent>

        <TabsContent value="modules" className="pt-5 px-6 pb-6 outline-none">
          <ModulesTab stationId={stationId} />
        </TabsContent>

        {s.is_under_construction && (
          <TabsContent value="construction" className="pt-5 px-6 pb-6 outline-none">
            <ConstructionTab stationId={stationId} />
          </TabsContent>
        )}

        <TabsContent value="trade" className="pt-5 px-6 pb-6 outline-none">
          <TradeTab stationId={stationId} />
        </TabsContent>

        {hasWorkforce && (
          <TabsContent value="workforce" className="pt-5 px-6 pb-6 outline-none">
            <div className="rounded-lg border border-border/50 bg-muted/5 px-6 py-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Workforce</p>
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Current</span>
                  <div className="font-mono text-lg font-semibold">{(s.workforce_current ?? 0).toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Capacity</span>
                  <div className="font-mono text-lg font-semibold">{(s.workforce_capacity ?? 0).toLocaleString()}</div>
                </div>
                {s.workforce_bonus != null && (
                  <div>
                    <span className="text-xs text-muted-foreground uppercase">Productivity Bonus</span>
                    <div className="font-mono font-semibold text-emerald-400">+{Math.round(s.workforce_bonus * 100)}%</div>
                  </div>
                )}
              </div>
              {s.workforce_capacity != null && s.workforce_capacity > 0 && (
                <StatBar
                  value={s.workforce_current ?? 0}
                  max={s.workforce_capacity}
                  labelLeft="Utilization"
                  labelRight={`${Math.round(((s.workforce_current ?? 0) / s.workforce_capacity) * 100)}%`}
                  height={8}
                />
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function ModulesTab({ stationId }: { stationId: string }) {
  const { data: mods = [], isLoading } = useQuery<StationModuleRow[]>({
    queryKey: ["station-modules", stationId],
    queryFn: () => apiGet<StationModuleRow[]>(`/api/v1/stations/${encodeURIComponent(stationId)}/modules`),
    staleTime: 30_000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading modules…</p>;
  if (mods.length === 0) return <p className="text-sm text-muted-foreground italic">No modules recorded.</p>;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="text-left text-muted-foreground font-medium py-2 pl-4 text-xs">Module</th>
            <th className="text-left text-muted-foreground font-medium py-2 text-xs">Kind</th>
            <th className="text-left text-muted-foreground font-medium py-2 text-xs">Size</th>
            <th className="text-right text-muted-foreground font-medium py-2 w-16 text-xs">Count</th>
            <th className="text-right text-muted-foreground font-medium py-2 w-24 pr-4 text-xs">Build</th>
          </tr>
        </thead>
        <tbody>
          {mods.map((m) => (
            <tr key={m.module_id} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
              <td className="py-2 pl-4 text-xs">{m.name ?? prettyId(m.macro ?? m.module_id)}</td>
              <td className="py-2 text-xs">
                {m.kind && (
                  <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border", KIND_COLORS[m.kind] ?? "bg-muted text-muted-foreground border-border")}>
                    {KIND_LABELS[m.kind] ?? m.kind}
                  </span>
                )}
              </td>
              <td className="py-2 text-xs">{m.size && <SizeBadge size={moduleSizeToClassId(m.size)} className="text-[11px]" />}</td>
              <td className="py-2 text-right text-xs font-mono tabular-nums">×{m.count}</td>
              <td className="py-2 text-right pr-4 text-xs font-mono tabular-nums">
                {m.construction_pct != null && m.construction_pct < 100 ? `${Math.round(m.construction_pct)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConstructionTab({ stationId }: { stationId: string }) {
  const { data, isLoading } = useQuery<StationConstruction>({
    queryKey: ["station-construction", stationId],
    queryFn: () => apiGet<StationConstruction>(`/api/v1/stations/${encodeURIComponent(stationId)}/construction`),
    staleTime: 30_000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading construction data…</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Planned Modules</p>
        <div className="flex flex-col gap-1.5">
          {data.planned_modules.map((m) => (
            <div key={m.module_id} className="flex items-center justify-between rounded-md bg-muted/5 border border-border/30 px-3 py-2 text-sm">
              <span className="truncate">{m.name ?? prettyId(m.macro ?? m.module_id)}</span>
              <span className="font-mono text-xs text-muted-foreground">×{m.count}</span>
            </div>
          ))}
          {data.planned_modules.length === 0 && <p className="text-sm text-muted-foreground italic">No planned modules recorded.</p>}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Bill of Materials</p>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left text-muted-foreground font-medium py-2 pl-4 text-xs">Ware</th>
                <th className="text-right text-muted-foreground font-medium py-2 w-24 text-xs">Amount</th>
                <th className="text-right text-muted-foreground font-medium py-2 w-24 pr-4 text-xs">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.bill_of_materials.map((b) => (
                <tr key={b.ware_id} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                  <td className="py-2 pl-4 text-xs">{b.name ?? prettyId(b.ware_id)}</td>
                  <td className="py-2 text-right text-xs font-mono tabular-nums">{b.amount.toLocaleString()}</td>
                  <td className="py-2 text-right pr-4 text-xs font-mono tabular-nums">
                    {b.total != null ? <Currency value={b.total} icon={false} /> : "—"}
                  </td>
                </tr>
              ))}
              {data.bill_of_materials.length === 0 && (
                <tr><td colSpan={3} className="py-3 text-center text-xs text-muted-foreground italic">No recipe data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TradeTab({ stationId }: { stationId: string }) {
  const { data: offers = [], isLoading } = useQuery<StationOffer[]>({
    queryKey: ["station-offers", stationId],
    queryFn: () => apiGet<StationOffer[]>(`/api/v1/stations/${encodeURIComponent(stationId)}/offers`),
    staleTime: 15_000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading trade offers…</p>;

  const sells = offers.filter((o) => o.side === "sell");
  const buys = offers.filter((o) => o.side === "buy");
  if (sells.length === 0 && buys.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No live trade offers.</p>;
  }

  const OfferTable = ({ title, rows, color }: { title: string; rows: StationOffer[]; color: string }) => (
    <div>
      <p className={cn("text-xs font-semibold uppercase tracking-wide mb-3", color)}>{title}</p>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left text-muted-foreground font-medium py-2 pl-4 text-xs">Ware</th>
              <th className="text-right text-muted-foreground font-medium py-2 w-20 text-xs">Price</th>
              <th className="text-right text-muted-foreground font-medium py-2 w-20 pr-4 text-xs">Qty</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.ware_id} className={cn("border-t border-border/50 hover:bg-muted/10 transition-colors", o.quantity === 0 && "opacity-45")}>
                <td className="py-2 pl-4 text-xs">{prettyId(o.ware_id)}</td>
                <td className="py-2 text-right text-xs"><Currency value={o.price} icon={false} /></td>
                <td className="py-2 text-right pr-4 text-xs font-mono tabular-nums">{o.quantity.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {sells.length > 0 && <OfferTable title="Selling" rows={sells} color="text-success" />}
      {buys.length > 0 && <OfferTable title="Buying" rows={buys} color="text-destructive" />}
    </div>
  );
}
