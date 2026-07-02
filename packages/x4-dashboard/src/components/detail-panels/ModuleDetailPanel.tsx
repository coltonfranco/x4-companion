import { useQuery } from "@tanstack/react-query";
import { Database } from "lucide-react";

import { ProductionChain } from "../commerce/ProductionChain";
import { StatBar } from "../data-display/StatBar";
import { Currency } from "../game/Currency";
import { EntityIcon } from "../game/EntityIcon";
import { FactionBadge } from "../game/FactionBadge";
import { SizeBadge } from "../game/ShipBadges";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { apiGet } from "../../lib/api";
import { formatDlc, formatLicence } from "../../lib/formatters";
import type { FactionSummary } from "../../lib/types";
import { cn } from "../../lib/utils";

export type ModuleSummary = {
  module_id: string;
  name: string;
  dlc: string | null;
  kind: string | null;
  size: string | null;
  makerrace: string | null;
  description: string | null;
  shortname: string | null;
  produces_ware_id: string | null;
  storage_capacity: number | null;
  storage_type: string | null;
  drone_capacity: number | null;
  workforce_capacity: number | null;
  workforce_race: string | null;
  workforce_growthrate: number | null;
  build_sets: string | null;
  blueprint_price_min: number | null;
  blueprint_price_avg: number | null;
  blueprint_price_max: number | null;
  restriction_licence: string | null;
  has_blueprint: boolean;
  hull: number | null;
  hull_integrated?: boolean | null;
  explosiondamage: number | null;
  explosion_shield_damage: number | null;
  secrecy_level: number | null;
  turrets_s: number;
  turrets_m: number;
  turrets_l: number;
  turrets_xl: number;
  shields_s: number;
  shields_m: number;
  shields_l: number;
  shields_xl: number;
  dock_s: number;
  dock_m: number;
  dock_l: number;
  dock_xl: number;
  hangar_s: number;
  hangar_m: number;
  snap_points: number;
  production_method: string | null;
  build_time_sec: number | null;
  est_cost: number | null;
  production_rate: number | null;
  is_obtainable: boolean;
  produces_ware_name: string | null;
  consumes_ware_name: string | null;
  consumption_rate: number | null;
  icon_url: string | null;
};

export type ModuleDetail = ModuleSummary & {
  construction_resources: Array<{
    ware_id: string;
    name: string;
    amount: number;
    price_avg: number;
    total: number;
  }> | null;
  production_inputs: Array<{
    ware_id: string;
    name: string;
    amount: number;
    output_amount: number;
    time_sec: number;
    rate_per_hour: number;
  }> | null;
};

export const KIND_LABELS: Record<string, string> = {
  storage: "Storage",
  dock: "Dock",
  connectionmodule: "Connection",
  production: "Production",
  defence: "Defence",
  habitation: "Habitation",
  buildmodule: "Build Module",
  welfaremodule: "Welfare",
  processingmodule: "Processing",
};

export const KIND_COLORS: Record<string, string> = {
  storage: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  dock: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  connectionmodule: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
  production: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  defence: "bg-red-500/20 text-red-300 border-red-500/30",
  habitation: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  buildmodule: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  welfaremodule: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  processingmodule: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

/** Map module size string to ship class_id for reuse of ShipClassBadge. */
export function moduleSizeToClassId(size: string | null): string {
  switch (size) {
    case "small": return "s";
    case "medium": return "m";
    case "large": return "l";
    case "extralarge": return "xl";
    default: return "";
  }
}

/** Check whether a module's licence is locked. When makerrace is null, the licence
 *  may be obtainable from any faction (or via research) — check the factionless set. */
export function isModuleLicenceLocked(
  makerrace: string | null,
  restriction_licence: string | null,
  licenceSet: Set<string>,
  anyLicenceSet: Set<string>,
): boolean {
  if (!restriction_licence) return false;
  if (makerrace) return !licenceSet.has(`${makerrace}:${restriction_licence}`);
  return !anyLicenceSet.has(restriction_licence);
}

/** Human-readable source for a licence tooltip. */
export function licenceSourceLabel(makerrace: string | null): string {
  return makerrace ?? "any faction";
}

function buildSetColor(ref: string): string {
  if (ref === "factory" || ref === "headquarters_player") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (ref.startsWith("tradestation_")) return "bg-amber-500/10 text-amber-300 border-amber-500/20";
  if (ref.includes("xenon")) return "bg-red-500/10 text-red-400 border-red-500/20";
  return "bg-primary/10 text-primary border-primary/20";
}

function formatBuildSetTag(ref: string): string {
  const tags: Record<string, string> = {
    factory: "Factory", headquarters_player: "Player HQ", piratebase: "Pirate Base",
    defence_xenon: "Xenon Defence", factory_xenon: "Xenon Factory", shipyard_xenon: "Xenon Shipyard",
    tradestation_argon: "Argon Trade Station", tradestation_teladi: "Teladi Trade Station",
    tradestation_paranid: "Paranid Trade Station", tradestation_split: "Split Trade Station",
    tradestation_boron: "Boron Trade Station", tradestation_terran: "Terran Trade Station",
    station_yaki: "Yaki Base",
  };
  return tags[ref] ?? ref.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ModuleStatRow({ label, value, maxVal, unit }: { label: string; value: number | null; maxVal: number; unit?: string }) {
  if (value == null || value === 0) {
    return (
      <div className="flex items-center gap-3 py-1 group">
        <span className="w-[110px] shrink-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="flex-1" />
        <span className="w-[80px] text-right text-xs text-muted-foreground">—</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 py-1 group">
      <span className="w-[110px] shrink-0 text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
      <div className="flex-1 min-w-[40px]">
        <StatBar value={value} max={maxVal} width={100} height={6} className="w-full" />
      </div>
      <div className="w-[80px] shrink-0 flex justify-end items-baseline gap-1 text-right">
        <span className="font-mono text-xs text-foreground font-medium whitespace-nowrap">{value.toLocaleString()}</span>
        {unit && <span className="text-[9px] text-muted-foreground shrink-0">{unit}</span>}
      </div>
    </div>
  );
}

function UnlockGuide({ d, faction, licenceLocked }: {
  d: ModuleDetail;
  faction: FactionSummary | undefined;
  licenceLocked: boolean;
}) {
  const lic = d.restriction_licence;

  return (
    <div className="space-y-5">
      {/* Status header */}
      <div className="flex items-center gap-3">
        {d.has_blueprint ? (
          <>
            <span className="text-emerald-400 text-lg">✓</span>
            <div>
              <p className="text-sm font-semibold text-emerald-400">Blueprint Owned</p>
              <p className="text-xs text-muted-foreground">You already have this blueprint.</p>
            </div>
          </>
        ) : !d.is_obtainable ? (
          <>
            <span className="text-red-400/80 text-lg">✗</span>
            <div>
              <p className="text-sm font-semibold text-red-400/80">Unobtainable</p>
              <p className="text-xs text-muted-foreground">This module cannot be acquired by the player.</p>
            </div>
          </>
        ) : (
          <>
            <span className="text-amber-400/80 text-lg">⊕</span>
            <div>
              <p className="text-sm font-semibold text-amber-400/80">Blueprint Available</p>
              <p className="text-xs text-muted-foreground">
                {d.blueprint_price_avg != null
                  ? <>Purchase for <Currency value={d.blueprint_price_avg} /></>
                  : "No cost — default blueprint"}
              </p>
            </div>
          </>
        )}
      </div>

      {/* How to get it (only when not owned and obtainable) */}
      {!d.has_blueprint && d.is_obtainable && (
        <div className="rounded-lg border border-border/50 bg-muted/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How to Acquire</p>

          {/* Faction purchase */}
          {d.makerrace ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Purchase from</span>
              {faction ? (
                <FactionBadge name={faction.name} color_hex={faction.color_hex} icon_url={faction.icon_url} faction_id={faction.faction_id} />
              ) : (
                <span className="text-xs capitalize">{d.makerrace}</span>
              )}
              <span className="text-xs text-muted-foreground">representative</span>
            </div>
          ) : d.blueprint_price_avg != null ? (
            <p className="text-xs text-muted-foreground">
              Available from any faction representative with the required licence.
            </p>
          ) : null}

          {/* Licence requirement */}
          {lic ? (
            <div className="flex items-center gap-2 pt-1 border-t border-border/30">
              <span className="text-xs text-muted-foreground">Requires licence:</span>
              <span className={cn(
                "text-xs font-medium",
                !licenceLocked ? "text-emerald-400" : "text-red-400/80"
              )}>
                {formatLicence(lic)}
              </span>
              {!licenceLocked ? (
                <span className="text-xs text-emerald-400/70">✓ Owned</span>
              ) : (
                <span className="text-xs text-red-400/70">
                  ✗ from {licenceSourceLabel(d.makerrace)}
                </span>
              )}
            </div>
          ) : d.blueprint_price_avg != null ? (
            <p className="text-xs text-muted-foreground pt-1 border-t border-border/30">
              No faction licence required — purchase directly from the representative.
            </p>
          ) : null}
        </div>
      )}

      {/* Price range */}
      {d.blueprint_price_min != null && d.blueprint_price_max != null && !d.has_blueprint && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Price range: <Currency value={d.blueprint_price_min} /> – <Currency value={d.blueprint_price_max} /></p>
        </div>
      )}
    </div>
  );
}

export function ModuleDetailPanel({ moduleId, summary, factions, licenceSet, anyLicenceSet }: { moduleId: string; summary: ModuleSummary; factions: FactionSummary[]; licenceSet: Set<string>; anyLicenceSet: Set<string> }) {
  const { data: m } = useQuery<ModuleDetail>({
    queryKey: ["module", moduleId],
    queryFn: () => apiGet<ModuleDetail>(`/api/v1/modules/${moduleId}`),
    staleTime: 5 * 60_000,
    placeholderData: summary as ModuleDetail,
  });
  const d = m ?? (summary as ModuleDetail);
  const slotSizes = ["s", "m", "l", "xl"] as const;
  const hasDescription = d.description && d.description !== "No information available";
  const hasBuildResources = d.construction_resources && d.construction_resources.length > 0;
  const faction = d.makerrace ? factions.find((f) => f.faction_id === d.makerrace) : undefined;
  const hasDocks = d.dock_s > 0 || d.dock_m > 0 || d.dock_l > 0 || d.dock_xl > 0;
  const hasHangar = d.hangar_s > 0 || d.hangar_m > 0;
  const licenceLocked = isModuleLicenceLocked(d.makerrace, d.restriction_licence, licenceSet, anyLicenceSet);

  return (
    <div className="flex flex-col h-full -mx-6 -my-6">
      <div className="flex flex-col sm:flex-row gap-6 px-6 pt-6 pb-4">
        <div className="shrink-0 w-full sm:w-48 h-40 sm:h-48 flex items-center justify-center rounded-xl bg-muted/10 border border-border/60">
          {d.icon_url ? (
            <img src={d.icon_url} alt={d.name} className="w-32 h-32 object-contain transition-transform hover:scale-105 duration-500" />
          ) : (
            <Database className="w-16 h-16 text-muted-foreground/30" />
          )}
        </div>
        <div className="flex-1 flex flex-col justify-center min-w-0 py-1">
          <div className="flex items-center gap-3 min-w-0">
            {d.icon_url && <EntityIcon src={d.icon_url} alt={d.name} size={28} className="opacity-70 shrink-0" />}
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight truncate" title={d.name}>{d.name}</h2>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-sm font-medium border", KIND_COLORS[d.kind ?? ""] ?? "bg-muted text-muted-foreground border-border")}>
              {KIND_LABELS[d.kind ?? ""] ?? d.kind ?? "Module"}
            </span>
            {d.size && <SizeBadge size={moduleSizeToClassId(d.size)} className="text-sm" />}
            {faction && <FactionBadge name={faction.name} color_hex={faction.color_hex} icon_url={faction.icon_url} faction_id={faction.faction_id} size="md" className="text-sm" />}
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-sm border", d.dlc ? "bg-amber-500/10 text-amber-300 border-amber-500/30" : "bg-muted/50 text-muted-foreground border-border")}>
              {formatDlc(d.dlc)}
            </span>
          </div>
          <div className="mt-3 space-y-1.5">
            {/* Blueprint */}
            {d.has_blueprint ? (
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Blueprint</span>
                <span className="text-xs text-emerald-400 font-medium">Owned</span>
                {d.blueprint_price_avg && <span className="text-xs text-muted-foreground">· <Currency value={d.blueprint_price_avg} /></span>}
              </div>
            ) : d.blueprint_price_avg ? (
              licenceLocked ? (
                <div className="flex items-center gap-2">
                  <span className="text-red-400/80">✗</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Blueprint</span>
                  <Currency value={d.blueprint_price_avg} />
                  <span className="text-xs text-red-400/80">· Locked behind licence</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-amber-400/80">⊕</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Blueprint</span>
                  <Currency value={d.blueprint_price_avg} />
                  <span className="text-xs text-amber-400/80">· Available for purchase</span>
                </div>
              )
            ) : d.is_obtainable ? (
              <div className="flex items-center gap-2">
                <span className="text-emerald-400/60">—</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Blueprint</span>
                <span className="text-xs text-muted-foreground">No blueprint required</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-red-400/80">✗</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Blueprint</span>
                <span className="text-xs text-muted-foreground">Unobtainable</span>
              </div>
            )}
            {/* Licence */}
            <div className="flex items-center gap-2">
              {d.restriction_licence ? (
                !isModuleLicenceLocked(d.makerrace, d.restriction_licence, licenceSet, anyLicenceSet) ? (
                  <>
                    <span className="text-emerald-400">✓</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Licence</span>
                    <span className="text-xs text-emerald-400 font-medium">{formatLicence(d.restriction_licence)}</span>
                    <span className="text-xs text-muted-foreground">· Owned</span>
                  </>
                ) : (
                  <>
                    <span className="text-red-400/80">✗</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Licence</span>
                    <span className="text-xs text-red-400/80 font-medium">{formatLicence(d.restriction_licence)}</span>
                    <span className="text-xs text-muted-foreground">· Required from {d.makerrace}</span>
                  </>
                )
              ) : (
                <>
                  <span className="text-emerald-400/60">—</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Licence</span>
                  <span className="text-xs text-muted-foreground">None required</span>
                </>
              )}
            </div>
          </div>
          {d.build_sets && (
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1">Buildable at:</span>
              {d.build_sets.split(" ").map((s) => (
                <span key={s} className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border", buildSetColor(s))}>{formatBuildSetTag(s)}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex-1 flex flex-col">
        <div className="border-b border-border/40 pb-px mt-2 px-6">
          <TabsList className="bg-transparent border-none p-0 h-auto space-x-6 w-full justify-start">
            <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3 pt-2 font-medium text-muted-foreground data-[state=active]:text-foreground transition-colors hover:text-foreground">Overview</TabsTrigger>
            {d.storage_capacity != null && d.storage_capacity > 0 && (
              <TabsTrigger value="storage" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3 pt-2 font-medium text-muted-foreground data-[state=active]:text-foreground transition-colors hover:text-foreground">Storage</TabsTrigger>
            )}
            {d.kind === "production" && (
              <TabsTrigger value="production" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3 pt-2 font-medium text-muted-foreground data-[state=active]:text-foreground transition-colors hover:text-foreground">Production</TabsTrigger>
            )}
            {(hasDocks || hasHangar) && (
              <TabsTrigger value="docking" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3 pt-2 font-medium text-muted-foreground data-[state=active]:text-foreground transition-colors hover:text-foreground">Docking</TabsTrigger>
            )}
            {hasBuildResources && (
              <TabsTrigger value="build" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3 pt-2 font-medium text-muted-foreground data-[state=active]:text-foreground transition-colors hover:text-foreground">Build</TabsTrigger>
            )}
            {!d.has_blueprint && (
              <TabsTrigger value="unlock" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3 pt-2 font-medium text-muted-foreground data-[state=active]:text-foreground transition-colors hover:text-foreground">How to Unlock</TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* ── Overview tab ── */}
        <TabsContent value="overview" className="space-y-6 pt-5 px-6 pb-6 outline-none">
          <div className="bg-muted/10 border border-border/50 rounded-lg overflow-hidden">
            <div className="px-4 pt-3 pb-1 border-b border-border/30">
              <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Global Stats</span>
            </div>
            <div className="p-5 pt-4">
              <div className="flex flex-col gap-2 max-w-md">
                <ModuleStatRow label="Hull" value={d.hull} maxVal={5000000} unit="HP" />
                <ModuleStatRow label="Explosion Dmg" value={d.explosiondamage} maxVal={20000} unit="" />
                <ModuleStatRow label="Expl. Shield Dmg" value={d.explosion_shield_damage} maxVal={50000} unit="" />
                {d.secrecy_level != null && (
                  <div className="flex items-center gap-3 py-1">
                    <span className="w-[110px] shrink-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">Secrecy Level</span>
                    <span className="font-mono text-xs text-foreground font-medium">{d.secrecy_level}</span>
                  </div>
                )}
                {d.snap_points > 0 && (
                  <div className="flex items-center gap-3 py-1">
                    <span className="w-[110px] shrink-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">Snap Points</span>
                    <span className="font-mono text-xs text-foreground font-medium">{d.snap_points}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Workforce — cross-kind (production, habitation, buildmodule) */}
          {(d.workforce_capacity != null && d.workforce_capacity > 0) && (
            <div className="rounded-lg border border-border/50 bg-muted/5 px-6 py-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Workforce</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Capacity</span>
                  <div className="font-mono text-lg font-semibold">{d.workforce_capacity.toLocaleString()}</div>
                </div>
                {d.workforce_race && (
                  <div>
                    <span className="text-xs text-muted-foreground uppercase">Race</span>
                    <div className="font-semibold capitalize">{d.workforce_race}</div>
                  </div>
                )}
                {d.workforce_growthrate != null && (
                  <div>
                    <span className="text-xs text-muted-foreground uppercase">Growth Rate</span>
                    <div className="font-mono font-semibold text-emerald-400">+{((d.workforce_growthrate ?? 0) * 100).toFixed(0)}%</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {(d.turrets_s > 0 || d.turrets_m > 0 || d.turrets_l > 0 || d.turrets_xl > 0 ||
            d.shields_s > 0 || d.shields_m > 0 || d.shields_l > 0 || d.shields_xl > 0) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Equipment Slots</p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left text-muted-foreground font-medium py-2 pl-4 text-xs">Type</th>
                      {slotSizes.map((s) => (<th key={s} className="text-center text-muted-foreground font-medium py-2 w-12 text-xs">{s.toUpperCase()}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                      <td className="py-2 pl-4 text-muted-foreground text-xs">Turrets</td>
                      {slotSizes.map((s) => { const val = (d as Record<string, unknown>)[`turrets_${s}`] as number; return (<td key={s} className="py-2 text-center text-sm">{val > 0 ? <span className="font-medium">{val}</span> : <span className="text-muted-foreground/40 text-xs">—</span>}</td>); })}
                    </tr>
                    <tr className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                      <td className="py-2 pl-4 text-muted-foreground text-xs">Shields</td>
                      {slotSizes.map((s) => { const val = (d as Record<string, unknown>)[`shields_${s}`] as number; return (<td key={s} className="py-2 text-center text-sm">{val > 0 ? <span className="font-medium">{val}</span> : <span className="text-muted-foreground/40 text-xs">—</span>}</td>); })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Description */}
          {hasDescription && (
            <div className="rounded-lg border border-border/50 bg-muted/5 px-6 py-5">
              <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{d.description}</p>
            </div>
          )}

          <div className="text-center text-[10px] text-muted-foreground/50 font-mono">{d.module_id}</div>
        </TabsContent>

        {/* ── Storage tab ── */}
        {d.storage_capacity != null && d.storage_capacity > 0 && (
          <TabsContent value="storage" className="space-y-6 pt-5 px-6 pb-6 outline-none">
            <div className="rounded-lg border border-border/50 bg-muted/5 px-6 py-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Storage</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Capacity</span>
                  <div className="font-mono text-lg font-semibold">{d.storage_capacity.toLocaleString()} m³</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Type</span>
                  <div className="font-semibold capitalize">{d.storage_type ?? "—"}</div>
                </div>
              </div>
              {d.hull_integrated && (
                <div className="mt-3 text-xs text-muted-foreground">Hull is integrated (no standalone hull value).</div>
              )}
            </div>
          </TabsContent>
        )}

        {/* ── Production tab ── */}
        {d.kind === "production" && d.produces_ware_id && (
          <TabsContent value="production" className="pt-5 px-6 pb-6 outline-none">
            <ProductionChain wareId={d.produces_ware_id} filterMethod={d.production_method ?? undefined} />
          </TabsContent>
        )}

        {/* ── Docking tab ── */}
        {(hasDocks || hasHangar) && (
          <TabsContent value="docking" className="space-y-6 pt-5 px-6 pb-6 outline-none">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dock Pads</p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>{slotSizes.map((s) => (<th key={s} className="text-center text-muted-foreground font-medium py-2 w-14 text-xs">{s.toUpperCase()}</th>))}</tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-muted/10 transition-colors">
                      {slotSizes.map((s) => { const v = (d as Record<string,unknown>)[`dock_${s}`] as number; return (<td key={s} className="py-2 text-center text-sm">{v > 0 ? <span className="font-mono font-medium">{v}</span> : <span className="text-muted-foreground/40 text-xs">—</span>}</td>); })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {hasHangar && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Internal Ship Storage</p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>{["S","M"].map((s) => (<th key={s} className="text-center text-muted-foreground font-medium py-2 w-14 text-xs">{s}</th>))}</tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-muted/10 transition-colors">
                        {(["hangar_s","hangar_m"] as const).map((k) => { const v = (d as Record<string,unknown>)[k] as number; return (<td key={k} className="py-2 text-center text-sm">{v > 0 ? <span className="font-mono font-medium">{v}</span> : <span className="text-muted-foreground/40 text-xs">—</span>}</td>); })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {d.drone_capacity != null && d.drone_capacity > 0 && (
              <div className="rounded-lg border border-border/50 bg-muted/5 px-6 py-4">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Drone Capacity</span>
                <div className="mt-1 font-mono text-sm font-semibold">{d.drone_capacity.toLocaleString()}</div>
              </div>
            )}
          </TabsContent>
        )}

        {/* ── Build tab ── */}
        {hasBuildResources && (
          <TabsContent value="build" className="pt-5 px-6 pb-6 outline-none space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {d.est_cost != null && (
                <div className="rounded-lg border border-border/50 bg-muted/5 px-4 py-3">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Est. Construction Cost</span>
                  <div className="mt-1"><Currency value={d.est_cost} /></div>
                </div>
              )}
              {d.build_time_sec != null && (
                <div className="rounded-lg border border-border/50 bg-muted/5 px-4 py-3">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Build Time</span>
                  <div className="mt-1 text-sm font-mono font-medium">
                    {d.build_time_sec >= 60
                      ? `${Math.floor(d.build_time_sec / 60)}m ${Math.round(d.build_time_sec % 60)}s`
                      : `${d.build_time_sec.toFixed(0)}s`}
                  </div>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Required Resources</p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left text-muted-foreground font-medium py-2 pl-4 text-xs">Ware</th>
                      <th className="text-right text-muted-foreground font-medium py-2 w-20 text-xs">Amount</th>
                      <th className="text-right text-muted-foreground font-medium py-2 w-24 text-xs">Unit Price</th>
                      <th className="text-right text-muted-foreground font-medium py-2 w-24 pr-4 text-xs">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.construction_resources!.map((r, i) => (
                      <tr key={r.ware_id} className={cn("border-t border-border/50 hover:bg-muted/10 transition-colors", i === d.construction_resources!.length - 1 && "font-semibold")}>
                        <td className="py-2 pl-4 text-xs">{r.name}</td>
                        <td className="py-2 text-right text-xs font-mono tabular-nums">{r.amount.toLocaleString()}</td>
                        <td className="py-2 text-right text-xs font-mono tabular-nums text-muted-foreground"><Currency value={r.price_avg} icon={false} /></td>
                        <td className="py-2 text-right text-xs font-mono tabular-nums pr-4"><Currency value={r.total} icon={false} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        )}

        <TabsContent value="unlock" className="pt-5 px-6 pb-6 outline-none">
          <UnlockGuide d={d} faction={faction} licenceLocked={licenceLocked} />
        </TabsContent>

        {hasDescription && (
          <TabsContent value="description" className="pt-4 px-6 pb-6 outline-none flex-1">
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed max-w-4xl">{d.description}</p>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
