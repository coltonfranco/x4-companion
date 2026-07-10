import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Building2, ChevronDown, FileText, Handshake, Rocket, ScrollText, Ship, Trophy, User, Upload } from "lucide-react";
import { Reputation } from "../../components/game/GameValues";
import { Currency } from "../../components/game/Currency";
import { FactionBadge } from "../../components/game/FactionBadge";
import { FactionStrengthTooltip } from "../../components/game/FactionStrengthTooltip";
import { LicenceTierBadge } from "../../components/game/LicenceTierBadge";
import { getReputationScore } from "../../lib/formatters";
import { prettyId } from "../../lib/wareFormat";
import { useFactionMap } from "../../lib/useFactionMap";
import { useLookupMap } from "../../lib/useLookupMap";
import { useFactionLicences } from "../../lib/useFactionLicences";
import { groupFactionLicences } from "../../lib/licenceTiers";
import { usePlayerLicences } from "../../lib/usePlayerLicences";
import { ShipDetailPanel } from "../../components/detail-panels/ShipDetailPanel";
import { DetailDialog } from "../../components/ui/detail-dialog";
import { PageLoaderPreset } from "../../components/layout/PageLoader";
import { PageSubtitle } from "../../components/ui/page-subtitle";
import { useHasSave } from "../../lib/useHasSave";
import { apiGet, apiGetOrNull } from "../../lib/api";
import { VISIBLE_FACTIONS_PATH, VISIBLE_FACTIONS_QUERY_KEY } from "../../lib/factionQueries";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { STATUS_COLORS } from "../../lib/map/constants";
import {
  computeRankings,
  breakdownKey,
  fieldTier,
  findRank,
  PLAYER_FACTION_ID,
  useFactionRankBaseline,
  type FactionStrength,
} from "../../lib/factionStrength";
import { CriticalAlertsWidget } from "./components/CriticalAlertsWidget";
import { StatCard, Panel } from "./components/EmpireStatCard";

type Player = { player_id: string | null; name: string | null; credits: number | null; current_ship_id: string | null; faction_name: string | null; logo_url: string | null };
type FleetShip = {
  ship_id: string;
  code: string | null;
  name: string | null;
  macro: string | null;
  catalog_name: string | null;
  class_id: string | null;
  sector_id: string | null;
  role: string | null;
  ship_type: string | null;
};
type Station = { station_id: string; code: string | null; name: string | null; sector_id: string | null; is_under_construction: boolean };
type PlayerRelation = { faction_id: string; faction_name: string | null; color_hex: string | null; relation: number; initial_relation: number | null };

type Health = {
  ok: boolean;
  api_version: string;
  save_age_sec: number | null;
  game_version: string | null;
};

type Faction = { faction_id: string; name: string; color_hex: string | null; icon_url?: string | null };
type Sector = { sector_id: string; name: string | null };

const ROLE_ORDER = ["fight", "trade", "mine", "build", "auxiliary"] as const;
const ROLE_META: Record<string, { label: string; color: string }> = {
  fight: { label: "Combat", color: "bg-red-500" },
  trade: { label: "Trade", color: "bg-sky-500" },
  mine: { label: "Mining", color: "bg-emerald-500" },
  build: { label: "Construction", color: "bg-violet-500" },
  auxiliary: { label: "Auxiliary", color: "bg-amber-500" },
  other: { label: "Other", color: "bg-muted-foreground" },
};
const roleKey = (r: string | null) => (r && ROLE_META[r] ? r : "other");
const CLASS_LABEL: Record<string, string> = { ship_xs: "XS", ship_s: "S", ship_m: "M", ship_l: "L", ship_xl: "XL" };

export default function EmpireOverviewPage() {
  const [showShips, setShowShips] = useState(false);
  const [selectedMacroId, setSelectedMacroId] = useState<string | null>(null);
  const [selectedMacroName, setSelectedMacroName] = useState<string | null>(null);

  const { hasSave } = useHasSave();

  const { data: health, isLoading: isHealthLoading, error: healthError } = useQuery<Health>({
    queryKey: ["health"],
    queryFn: () => apiGet<Health>("/api/v1/health"),
  });

  const { data: player, isLoading: isPlayerLoading } = useQuery<Player | null>({
    queryKey: ["player"],
    queryFn: () => apiGetOrNull<Player>("/api/v1/player"),
  });
  const { data: blueprints = [] } = useQuery<{ ware_id: string }[]>({
    queryKey: ["player-blueprints"], queryFn: () => apiGet<{ ware_id: string }[]>("/api/v1/player/blueprints"),
  });
  const { data: licences = [] } = usePlayerLicences();
  const { data: licenceCatalog = [] } = useFactionLicences();
  const { data: fleet = [] } = useQuery<FleetShip[]>({
    queryKey: ["fleet-player"], queryFn: () => apiGet<FleetShip[]>("/api/v1/fleet?player_only=true&limit=2000"),
  });
  const { data: stations = [] } = useQuery<Station[]>({
    queryKey: ["stations-player"], queryFn: () => apiGet<Station[]>("/api/v1/stations?player_only=true&limit=2000"),
  });
  const { data: factions = [] } = useQuery<Faction[]>({
    queryKey: VISIBLE_FACTIONS_QUERY_KEY, queryFn: () => apiGet<Faction[]>(VISIBLE_FACTIONS_PATH),
  });
  const { data: reputation = [] } = useQuery<PlayerRelation[]>({
    queryKey: ["player-reputation"], queryFn: () => apiGet<PlayerRelation[]>("/api/v1/player/reputation"),
  });
  const { data: strength = [] } = useQuery<FactionStrength[]>({
    queryKey: ["factions-strength", "visible"], queryFn: () => apiGet<FactionStrength[]>(`${VISIBLE_FACTIONS_PATH}/strength`), staleTime: 30_000,
  });
  const factionMap = useFactionMap(factions);

  const rankings = useMemo(() => computeRankings(strength), [strength]);
  const rankDelta = useFactionRankBaseline(rankings);

  const standing = useMemo(
    () =>
      rankings.map((r) => {
        const found = findRank(r.ranked, PLAYER_FACTION_ID);
        const me = found?.faction;
        return {
          key: r.key,
          label: r.label,
          color: r.color,
          rank: found?.rank ?? null,
          total: found?.total ?? r.ranked.length,
          leaderRatio: me ? me[breakdownKey(r.key)].leader_ratio : 0,
          faction: me ?? null,
        };
      }),
    [rankings, strength]
  );

  const bestStanding = useMemo(() => {
    const ranked = standing.filter((c): c is typeof c & { rank: number } => c.rank != null);
    if (ranked.length === 0) return null;
    return ranked.reduce((best, c) => {
      const pct = (c.rank - 1) / Math.max(1, c.total - 1);
      const bestPct = (best.rank - 1) / Math.max(1, best.total - 1);
      return pct < bestPct ? c : best;
    });
  }, [standing]);
  const { data: sectors = [] } = useQuery<Sector[]>({
    queryKey: ["map-sectors"], queryFn: () => apiGet<Sector[]>("/api/v1/map/sectors?limit=2000"), staleTime: 600_000,
  });

  const sectorName = useLookupMap(
    sectors,
    (s) => s.sector_id,
    (s) => s.name,
    { normalizeId: (id) => id.toLowerCase(), onMissing: prettyId, onEmpty: "Unknown" }
  );

  const fleetByRole = useMemo(() => {
    const c = new Map<string, number>();
    for (const s of fleet) c.set(roleKey(s.role), (c.get(roleKey(s.role)) ?? 0) + 1);
    return [...ROLE_ORDER, "other"].map((r) => ({ r, n: c.get(r) ?? 0 })).filter((x) => x.n > 0);
  }, [fleet]);

  const heldLicenceTypes = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of licences) {
      if (!m.has(l.faction_id)) m.set(l.faction_id, new Set());
      m.get(l.faction_id)!.add(l.licence_type);
    }
    return m;
  }, [licences]);

  const licenceTiersByFaction = useMemo(() => {
    const catalogByFaction = new Map<string, typeof licenceCatalog>();
    for (const l of licenceCatalog) {
      if (!catalogByFaction.has(l.faction_id)) catalogByFaction.set(l.faction_id, []);
      catalogByFaction.get(l.faction_id)!.push(l);
    }
    return [...heldLicenceTypes.keys()]
      .map((fid) => ({ fid, grouping: groupFactionLicences(catalogByFaction.get(fid) ?? []) }))
      .filter(({ grouping }) => grouping.tiers.length > 0 || grouping.other.length > 0)
      .sort((a, b) => {
        const heldA = heldLicenceTypes.get(a.fid)!.size;
        const heldB = heldLicenceTypes.get(b.fid)!.size;
        return heldB - heldA;
      });
  }, [licenceCatalog, heldLicenceTypes]);

  if (isPlayerLoading) return <PageLoaderPreset preset="empire" />;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-5 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
            <User className="h-6 w-6 text-primary" /> {player?.faction_name || player?.name || "Pilot"}
          </h1>
          <PageSubtitle>Your empire at a glance</PageSubtitle>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-6 pb-6 pt-4 flex flex-col">
        <div className="flex-1 overflow-auto p-2">
          <div className="max-w-[1400px] mx-auto w-full space-y-6">
            {!hasSave && (
              <div className="flex items-start gap-4 p-5 rounded-lg border border-amber-500/30 bg-amber-500/5 mb-6">
                <Upload className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-semibold text-amber-200">No save loaded</p>
                  <p className="text-xs text-amber-300/70 mt-1 leading-relaxed">
                    Load a save file from the sidebar to unlock live game data — faction relations,
                    trade routes, conflict zones, empire stats, and more.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left Column */}
              <div className="space-y-6 flex flex-col">
                {player && (
                  <StatCard tone="text-gold" big value={<Currency value={player.credits} abbreviate />} label="Credits" />
                )}

                {/* API status */}
                <Card className="w-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">API Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isHealthLoading ? (
                      <p className="text-sm text-muted-foreground">Connecting…</p>
                    ) : healthError ? (
                      <p className="text-sm text-destructive">API unreachable</p>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: health?.ok ? STATUS_COLORS.success : STATUS_COLORS.danger }}
                          />
                          <span className="text-sm font-medium">{health?.ok ? "Online" : "Degraded"}</span>
                          <span className="text-xs text-muted-foreground ml-auto">v{health?.api_version}</span>
                        </div>
                        {health?.game_version && (
                          <p className="text-xs text-muted-foreground">Game {health.game_version}</p>
                        )}
                        {health?.save_age_sec != null && (
                          <p className="text-xs text-muted-foreground">
                            Save {Math.floor(health.save_age_sec)}s old
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Fleet by role */}
                {player && (
                  <Panel title={`Fleet · ${fleet.length} ships`} icon={Rocket}>
                    {fleet.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No player-owned ships.</p>
                    ) : (
                      <>
                        <div className="flex h-3 w-full rounded-full overflow-hidden bg-border">
                          {fleetByRole.map(({ r, n }) => (
                            <div key={r} className={ROLE_META[r].color} style={{ width: `${(n / fleet.length) * 100}%` }} title={`${ROLE_META[r].label}: ${n}`} />
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
                          {fleetByRole.map(({ r, n }) => (
                            <div key={r} className="flex items-center gap-1.5 text-sm">
                              <span className={`h-2.5 w-2.5 rounded-sm ${ROLE_META[r].color}`} />
                              <span className="font-medium">{ROLE_META[r].label}</span>
                              <span className="text-muted-foreground tabular-nums">{n}</span>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => setShowShips((v) => !v)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-3 transition-colors"
                        >
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showShips ? "rotate-180" : ""}`} />
                          {showShips ? "Hide" : "Show all ships"}
                        </button>
                        {showShips && (
                          <div className="mt-2 max-h-80 overflow-auto rounded-md border border-border divide-y divide-border/40">
                            {[...fleet]
                              .sort((a, b) => roleKey(a.role).localeCompare(roleKey(b.role)))
                              .map((s) => (
                                <div
                                  key={s.ship_id}
                                  className="flex items-center gap-3 px-3 py-1.5 text-xs hover:bg-muted/20 cursor-pointer"
                                  onClick={() => {
                                    if (s.macro) {
                                      setSelectedMacroId(s.macro);
                                      setSelectedMacroName(s.name || s.catalog_name || s.ship_type || "Ship");
                                    }
                                  }}
                                >
                                  <span className={`h-2 w-2 rounded-sm shrink-0 ${ROLE_META[roleKey(s.role)].color}`} />
                                  <span className="font-medium truncate w-40">{s.name || s.catalog_name || s.ship_type || "Ship"}</span>
                                  <span className="text-muted-foreground w-8 tabular-nums">{CLASS_LABEL[s.class_id ?? ""] ?? ""}</span>
                                  <span className="text-muted-foreground capitalize w-16 truncate">{s.ship_type ?? ""}</span>
                                  <span className="text-muted-foreground/80 truncate flex-1">{sectorName(s.sector_id)}</span>
                                </div>
                              ))}
                          </div>
                        )}
                      </>
                    )}
                  </Panel>
                )}
              </div>

              {/* Center Column */}
              <div className="space-y-6 flex flex-col">
                {player && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <StatCard icon={Ship} tone="text-sky-400" value={fleet.length.toString()} label="Ships" />
                      <StatCard icon={Building2} tone="text-violet-400" value={stations.length.toString()} label="Stations" />
                      <StatCard icon={FileText} tone="text-emerald-400" value={blueprints.length.toString()} label="Blueprints" />
                    </div>

                    {stations.length > 0 && (
                      <Panel title={`Stations · ${stations.length}`} icon={Building2}>
                        <div className="flex flex-wrap gap-2">
                          {stations.map((st) => (
                            <div key={st.station_id} className="rounded-md border border-border bg-muted/20 px-3 py-1.5 text-xs">
                              <div className="font-medium">{st.name || st.code || "Station"}</div>
                              <div className="text-muted-foreground">
                                {sectorName(st.sector_id)}
                                {st.is_under_construction && <span className="text-warning"> · building</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </Panel>
                    )}

                    <Panel title={`Licences · ${licences.length}`} icon={ScrollText}>
                      <p className="text-xs text-muted-foreground mb-3">Access tiers unlocked with each faction, plus one-off contracts like Envoy or Hyperion sale licences.</p>
                      {licenceTiersByFaction.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No licences held.</p>
                      ) : (
                        <div className="space-y-3">
                          {licenceTiersByFaction.map(({ fid, grouping }) => {
                            const f = factionMap.get(fid);
                            const held = heldLicenceTypes.get(fid) ?? new Set<string>();
                            const allItems = [...grouping.tiers.flatMap((t) => t.items), ...grouping.other];
                            const heldCount = allItems.filter((i) => held.has(i.licence_type)).length;
                            return (
                              <div key={fid}>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Link to="/factions/list" search={{ faction: fid }} className="flex items-center gap-2 transition-opacity hover:opacity-80">
                                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: f?.color_hex ?? "#888" }} />
                                    <span className="text-sm font-semibold" style={{ color: f?.color_hex ?? undefined }}>{f?.name ?? prettyId(fid)}</span>
                                  </Link>
                                  <span className="text-xs text-muted-foreground ml-auto tabular-nums">{heldCount}/{allItems.length}</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 pl-4">
                                  {grouping.tiers.map((tier) => {
                                    const gateUnlocked = tier.key === "__base__" || held.has(tier.key);
                                    const score = tier.minRelation != null ? getReputationScore(tier.minRelation) : null;
                                    return (
                                      <LicenceTierBadge
                                        key={tier.key}
                                        unlocked={gateUnlocked}
                                        label={tier.label}
                                        className="rounded-full border border-border bg-muted/20 px-2 py-0.5 text-xs"
                                        title={score != null ? `${tier.label} · ${score > 0 ? "+" : ""}${score} relation` : tier.label}
                                      />
                                    );
                                  })}
                                  {grouping.other.length > 0 && (
                                    <span className="rounded-full border border-border bg-muted/20 px-2 py-0.5 text-xs text-muted-foreground">
                                      +{grouping.other.length} special
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Panel>
                  </>
                )}
              </div>

              {/* Right Column */}
              <div className="space-y-6 flex flex-col">
                {player && (
                  <>
                    <CriticalAlertsWidget />

                    {strength.length > 0 && (
                      <Panel
                        title="Standing among factions"
                        icon={Trophy}
                        headerRight={
                          bestStanding && (
                            <span className="text-muted-foreground">
                              Best · <span style={{ color: bestStanding.color }}>{bestStanding.label} #{bestStanding.rank}</span>
                            </span>
                          )
                        }
                      >
                        <div className="grid grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                          {standing.map((c) => {
                            if (c.rank == null) {
                              return (
                                <div key={c.key} className="rounded-md border border-border bg-muted/10 p-3">
                                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} /> {c.label}
                                  </p>
                                  <p className="text-sm text-muted-foreground mt-2">Not yet ranked</p>
                                </div>
                              );
                            }
                            if (c.faction == null) {
                              return (
                                <div key={c.key} className="rounded-md border border-border bg-muted/10 p-3">
                                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} /> {c.label}
                                  </p>
                                  <p className="text-sm text-muted-foreground mt-2">Not yet ranked</p>
                                </div>
                              );
                            }
                            const tier = fieldTier(c.rank, c.total);
                            const delta = rankDelta(c.key, PLAYER_FACTION_ID, c.rank);
                            return (
                              <FactionStrengthTooltip
                                key={c.key}
                                faction={c.faction}
                                metric={c}
                                rank={{ rank: c.rank, total: c.total }}
                                subjectLabel="You"
                              >
                                <div
                                  className="relative rounded-md border bg-muted/10 p-3 overflow-hidden cursor-help transition-colors hover:bg-muted/20"
                                  style={{
                                    borderColor: tier.isPodium ? c.color : undefined,
                                    boxShadow: tier.isPodium
                                      ? `0 0 14px 1px color-mix(in srgb, ${c.color} 35%, transparent)`
                                      : undefined,
                                  }}
                                >
                                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} /> {c.label}
                                  </p>

                                  <div className="flex items-baseline gap-1.5 mt-1">
                                    <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: c.color }}>
                                      #{c.rank}
                                    </p>
                                    <span className="text-xs text-muted-foreground tabular-nums">of {c.total}</span>
                                    {delta != null && delta !== 0 && (
                                      <span
                                        className={`ml-auto text-[10px] font-semibold tabular-nums ${
                                          delta > 0 ? "text-success" : "text-danger"
                                        }`}
                                      >
                                        {delta > 0 ? "▲" : "▼"}
                                        {Math.abs(delta)}
                                      </span>
                                    )}
                                  </div>

                                  <div className="h-1.5 bg-border rounded-full overflow-hidden mt-2">
                                    <div className="h-full rounded-full" style={{ width: `${c.leaderRatio}%`, backgroundColor: c.color }} />
                                  </div>

                                  <div className="flex items-center justify-between mt-1">
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                      Leader
                                    </span>
                                    <span className="text-xs text-muted-foreground tabular-nums">{c.leaderRatio.toFixed(0)}%</span>
                                  </div>
                                </div>
                              </FactionStrengthTooltip>
                            );
                          })}
                        </div>
                      </Panel>
                    )}

                    {reputation.length > 0 && (
                      <Panel title={`Reputation · ${reputation.length} factions`} icon={Handshake}>
                        <div className="grid grid-cols-1 gap-x-6 gap-y-1">
                          {reputation.map((r) => {
                            const cur = getReputationScore(r.relation);
                            const init = r.initial_relation != null ? getReputationScore(r.initial_relation) : null;
                            const drift = init != null ? cur - init : 0;
                            return (
                              <div key={r.faction_id} className="flex items-center justify-between gap-2 text-sm py-0.5">
                                <FactionBadge name={r.faction_name ?? prettyId(r.faction_id)} color_hex={r.color_hex} icon_url={factionMap.get(r.faction_id)?.icon_url} faction_id={r.faction_id} />
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {Math.abs(drift) >= 1 && (
                                    <span className={`text-xs tabular-nums ${drift > 0 ? "text-success" : "text-danger"}`}>
                                      {drift > 0 ? "▲" : "▼"}
                                      {Math.abs(drift).toFixed(0)}
                                    </span>
                                  )}
                                  <Reputation value={cur} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Panel>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DetailDialog
        open={selectedMacroId !== null}
        onOpenChange={(open) => { if (!open) setSelectedMacroId(null); }}
        title={selectedMacroName ?? "Ship details"}
        description={`Detailed stats for ${selectedMacroName}`}
      >
        {selectedMacroId && <ShipDetailPanel shipId={selectedMacroId} factions={factions} />}
      </DetailDialog>
    </div>
  );
}
