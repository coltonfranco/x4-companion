import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Info } from "lucide-react";

import { Currency } from "../../../components/game/Currency";
import { EntityIcon } from "../../../components/game/EntityIcon";
import { FactionStrengthTooltip } from "../../../components/game/FactionStrengthTooltip";
import { Reputation } from "../../../components/game/GameValues";
import { LicenceTierBadge } from "../../../components/game/LicenceTierBadge";
import { PageLoaderPreset } from "../../../components/layout/PageLoader";
import { Badge } from "../../../components/ui/badge";
import { PageTab, PageTabs } from "../../../components/ui/page-tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";
import { apiGet } from "../../../lib/api";
import { VISIBLE_FACTIONS_PATH, VISIBLE_FACTIONS_QUERY_KEY } from "../../../lib/factionQueries";
import { getReputationScore } from "../../../lib/formatters";
import { breakdownKey, computeRankings, findRank, METRICS } from "../../../lib/factionStrength";
import type { FactionStrength, MetricKey } from "../../../lib/factionStrength";
import { groupFactionLicences } from "../../../lib/licenceTiers";
import { useFactionLicences } from "../../../lib/useFactionLicences";
import { usePlayerLicences } from "../../../lib/usePlayerLicences";
import type { FactionLicence, FactionSummary } from "../../../lib/types";
import { NoSavePlaceholder } from "./NoSavePlaceholder";

type FactionDetail = FactionSummary & {
  primary_race: string | null;
  description: string | null;
  tags: string | null;
};

type FactionRelation = {
  other_faction_id: string;
  initial_relation: number;
};

type MapSummary = { id: string; name: string | null };

export function FactionDetailPanel({ factionId, onClose, hasSave }: { factionId: string; onClose: () => void; hasSave: boolean }) {
  const [activeTab, setActiveTab] = useState<"overview" | "diplomacy" | "licences">("overview");

  const { data: faction, isLoading: factionLoading } = useQuery<FactionDetail>({
    queryKey: ["faction", factionId],
    queryFn: () => apiGet<FactionDetail>(`/api/v1/factions/${factionId}`),
  });

  const { data: licences = [], isLoading: licencesLoading } = useFactionLicences(factionId);

  const { data: playerLicences = [] } = usePlayerLicences();

  const { data: allFactions = [] } = useQuery<FactionSummary[]>({
    queryKey: VISIBLE_FACTIONS_QUERY_KEY,
    queryFn: () => apiGet<FactionSummary[]>(VISIBLE_FACTIONS_PATH),
  });

  const { data: relations = [] } = useQuery<FactionRelation[]>({
    queryKey: ["faction-relations", "visible", factionId],
    queryFn: () => apiGet<FactionRelation[]>(`/api/v1/factions/${factionId}/relations`),
  });

  const { data: sectors = [] } = useQuery<MapSummary[]>({
    queryKey: ["faction-sectors", factionId],
    queryFn: () => apiGet<MapSummary[]>(`/api/v1/map/sectors?owner_faction=${factionId}`),
  });

  const { data: clusters = [] } = useQuery<MapSummary[]>({
    queryKey: ["faction-clusters", factionId],
    queryFn: () => apiGet<MapSummary[]>(`/api/v1/map/clusters?owner_faction=${factionId}`),
  });

  const { data: strengthData = [] } = useQuery<FactionStrength[]>({
    queryKey: ["factions-strength", "visible"],
    queryFn: () => apiGet<FactionStrength[]>(`${VISIBLE_FACTIONS_PATH}/strength`),
    staleTime: 30_000,
  });

  const strengthEntry = strengthData.find((f) => f.faction_id === factionId);

  const rankings = useMemo(() => computeRankings(strengthData), [strengthData]);

  const ranks = useMemo(() => {
    const result = {} as Record<MetricKey, { rank: number; total: number } | null>;
    for (const m of rankings) {
      result[m.key] = findRank(m.ranked, factionId);
    }
    return result;
  }, [rankings, factionId]);

  const rankedRelations = useMemo(() => {
    return relations
      .map((r) => {
        const f = allFactions.find((x) => x.faction_id === r.other_faction_id);
        return {
          rel: r,
          f,
          label: f?.name || r.other_faction_id,
          score: getReputationScore(r.initial_relation),
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [relations, allFactions]);

  const licenceGrouping = useMemo(() => groupFactionLicences(licences), [licences]);
  const hasLicences = licenceGrouping.tiers.length > 0 || licenceGrouping.other.length > 0;
  const licenceCount =
    licenceGrouping.tiers.reduce((n, t) => n + t.items.length, 0) + licenceGrouping.other.length;

  const heldLicenceTypes = useMemo(() => {
    if (!hasSave) return new Set<string>();
    return new Set(playerLicences.filter((l) => l.faction_id === factionId).map((l) => l.licence_type));
  }, [playerLicences, factionId, hasSave]);

  if (factionLoading || licencesLoading) {
    return <div className="p-6 text-muted-foreground text-sm"><PageLoaderPreset preset="factions" /></div>;
  }
  if (!faction) return null;

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="px-6 pt-5 pb-0 shrink-0 border-b border-border/50">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div className="flex items-center gap-4">
          {faction.icon_url ? (
            <span
              style={{
                width: 56,
                height: 56,
                flexShrink: 0,
                backgroundColor: faction.color_hex ?? "var(--foreground)",
                WebkitMaskImage: `url(${faction.icon_url})`,
                WebkitMaskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskImage: `url(${faction.icon_url})`,
                maskSize: "contain",
                maskRepeat: "no-repeat",
                maskPosition: "center",
              }}
            />
          ) : (
            <EntityIcon src={null} alt={faction.name} size={56} />
          )}
          <div>
            <h2 className="text-xl font-bold" style={{ color: faction.color_hex ?? "inherit" }}>
              {faction.name}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {faction.short_name && <Badge variant="secondary">{faction.short_name}</Badge>}
              {faction.primary_race && (
                <Badge variant="outline" className="capitalize flex items-center gap-1.5">
                  <img
                    src={`/static/icons/races/race_${faction.primary_race}.png`}
                    alt={faction.primary_race}
                    className="w-4 h-4 object-contain"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                  {faction.primary_race}
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <PageTabs className="mt-6 gap-2 mb-[-1px]">
          <PageTab active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
            Overview
          </PageTab>
          <PageTab active={activeTab === "diplomacy"} onClick={() => setActiveTab("diplomacy")}>
            Diplomacy
          </PageTab>
          {hasLicences && (
            <PageTab active={activeTab === "licences"} onClick={() => setActiveTab("licences")}>
              Licences <span className="text-xs text-muted-foreground ml-1">{licenceCount}</span>
            </PageTab>
          )}
        </PageTabs>
      </div>

      <div className="flex flex-col flex-1 min-h-0 pt-4">
        {activeTab === "overview" && (
          <div className="flex-1 overflow-auto px-6 pb-6 pt-2">
            <div className="max-w-4xl space-y-6">
              {!hasSave && <NoSavePlaceholder title="No save loaded" />}
              {hasSave && strengthEntry && (
                <div>
                  <div className="grid grid-cols-4 gap-3">
                    {METRICS.map((m) => {
                      const rank = ranks[m.key];
                      const score = strengthEntry[m.key];
                      const leaderRatio = strengthEntry[breakdownKey(m.key)].leader_ratio;
                      return (
                        <FactionStrengthTooltip
                          key={m.key}
                          faction={strengthEntry}
                          metric={m}
                          rank={rank}
                          subjectLabel={faction.name}
                        >
                          <div className="relative rounded-md border border-border bg-muted/10 pt-3 px-3 pb-3 flex flex-col gap-2 overflow-hidden cursor-help transition-colors hover:border-border/80 hover:bg-muted/20">
                            <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: m.color }} />
                            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: m.color }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color }} />
                              {m.label}
                            </p>
                            <div className="flex items-baseline gap-1.5">
                              <p
                                className="text-2xl font-bold tabular-nums leading-none"
                                style={{ color: rank != null ? m.color : undefined }}
                              >
                                {rank != null ? `#${rank.rank}` : "—"}
                              </p>
                              {rank != null && (
                                <span className="text-xs tabular-nums text-muted-foreground">of {rank.total}</span>
                              )}
                            </div>
                            <div className="h-1 bg-border rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${leaderRatio}%`, backgroundColor: leaderRatio > 0 ? m.color : undefined }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span className="tabular-nums">Score {score.toFixed(0)}/100</span>
                              <span className="tabular-nums">{leaderRatio.toFixed(0)}% of leader</span>
                            </div>
                          </div>
                        </FactionStrengthTooltip>
                      );
                    })}
                  </div>
                </div>
              )}

              {faction.description && (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {faction.description.replace(/\\n/g, "\n")}
                </p>
              )}

              {hasSave && (clusters.length > 0 || sectors.length > 0) && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Territory Owned
                  </p>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="font-semibold">{clusters.length}</span> Clusters
                    </p>
                    <p>
                      <span className="font-semibold">{sectors.length}</span> Sectors
                    </p>
                    {sectors.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {sectors.map((s, i) => (
                          <Badge key={i} variant="secondary">
                            {s.name || "Unknown Sector"}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "diplomacy" && (
          <div className="flex-1 overflow-auto px-6 pb-6 pt-2">
            {!hasSave ? (
              <NoSavePlaceholder title="No save loaded" />
            ) : rankedRelations.length > 0 ? (
              <div className="max-w-lg space-y-2">
                {rankedRelations.map(({ rel, f, label, score }) => {
                  const tier =
                    score >= 10 ? "friendly" : score <= -10 ? "hostile" : "neutral";
                  return (
                    <div
                      key={rel.other_faction_id}
                      className={`flex items-center justify-between text-sm p-2 rounded ${
                        tier === "friendly"
                          ? "bg-emerald-500/5"
                          : tier === "hostile"
                          ? "bg-red-500/5"
                          : "bg-muted/10"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {f?.color_hex && (
                          f.icon_url ? (
                            <span
                              className="shrink-0"
                              style={{
                                width: 14,
                                height: 14,
                                backgroundColor: f.color_hex,
                                WebkitMaskImage: `url(${f.icon_url})`,
                                WebkitMaskSize: "contain",
                                WebkitMaskRepeat: "no-repeat",
                                WebkitMaskPosition: "center",
                                maskImage: `url(${f.icon_url})`,
                                maskSize: "contain",
                                maskRepeat: "no-repeat",
                                maskPosition: "center",
                              }}
                            />
                          ) : (
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: f.color_hex }}
                            />
                          )
                        )}
                        <span className="truncate">{label}</span>
                      </div>
                      <Reputation value={score} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No diplomatic relations found.</p>
            )}
          </div>
        )}

        {hasLicences && activeTab === "licences" && (
          <div className="flex-1 overflow-auto px-6 pb-6 pt-2">
            <div className="max-w-3xl space-y-4">
              {licenceGrouping.tiers.map((tier) => {
                const heldCount = tier.items.filter((i) => heldLicenceTypes.has(i.licence_type)).length;
                const gateUnlocked = tier.key === "__base__" || heldLicenceTypes.has(tier.key);
                return (
                  <div key={tier.key} className="rounded-md border border-border overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/20 border-b border-border/50">
                      <LicenceTierBadge unlocked={hasSave && gateUnlocked} label={tier.label} className="text-sm font-semibold" />
                      <div className="ml-auto flex items-center gap-3 shrink-0">
                        {hasSave && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {heldCount}/{tier.items.length}
                          </span>
                        )}
                        {tier.minRelation != null && <Reputation value={getReputationScore(tier.minRelation)} />}
                      </div>
                    </div>
                    <div className="divide-y divide-border/40">
                      {tier.items.map((item) => (
                        <LicenceItemRow key={item.licence_type} item={item} held={hasSave && heldLicenceTypes.has(item.licence_type)} showHeld={hasSave} />
                      ))}
                    </div>
                  </div>
                );
              })}

              {licenceGrouping.other.length > 0 && (
                <div className="rounded-md border border-border overflow-hidden">
                  <div className="px-4 py-2.5 bg-muted/20 border-b border-border/50">
                    <span className="text-sm font-semibold text-muted-foreground">Special Licences</span>
                  </div>
                  <div className="divide-y divide-border/40">
                    {licenceGrouping.other.map((item) => (
                      <LicenceItemRow key={item.licence_type} item={item} held={hasSave && heldLicenceTypes.has(item.licence_type)} showHeld={hasSave} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LicenceItemRow({ item, held, showHeld }: { item: FactionLicence; held: boolean; showHeld: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 text-sm ${showHeld && !held ? "opacity-60" : ""}`}>
      {showHeld && <Check className={`w-3.5 h-3.5 shrink-0 ${held ? "text-emerald-400" : "text-transparent"}`} />}
      <span className="flex-1 flex items-center gap-1.5 font-medium min-w-0">
        <span className="truncate">{item.name}</span>
        {item.description && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger className="cursor-help shrink-0">
                <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-sm leading-relaxed p-3">
                {item.description}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </span>
      {item.price != null && <Currency value={item.price} className="text-xs shrink-0" />}
    </div>
  );
}

// ─── MatrixView ───────────────────────────────────────────────────────────────
