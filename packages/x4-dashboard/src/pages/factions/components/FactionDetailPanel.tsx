import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Info } from "lucide-react";

import { Currency } from "../../../components/game/Currency";
import { EntityIcon } from "../../../components/game/EntityIcon";
import { Reputation } from "../../../components/game/GameValues";
import { PageLoaderPreset } from "../../../components/layout/PageLoader";
import { Badge } from "../../../components/ui/badge";
import { PageTab, PageTabs } from "../../../components/ui/page-tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";
import { apiGet } from "../../../lib/api";
import { getReputationScore } from "../../../lib/formatters";
import type { FactionSummary } from "../../../lib/types";
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

type FactionLicence = {
  licence_type: string;
  faction_id: string;
  name: string | null;
  description: string | null;
  icon: string | null;
  precursor: string | null;
  price: number | null;
  min_relation: number | null;
};

type MetricKey = "military_score" | "economic_score" | "diplomatic_score" | "territory_score";

type FactionStrength = {
  faction_id: string;
  name: string;
  color_hex: string | null;
  military_score: number;
  economic_score: number;
  diplomatic_score: number;
  territory_score: number;
  fight_ship_count: number;
  trade_ship_count: number;
  mine_ship_count: number;
  military_station_count: number;
  economic_station_count: number;
  sector_count: number;
  cluster_count: number;
  avg_relation: number;
};

const METRICS: {
  key: MetricKey;
  label: string;
  color: string;
  detail: (f: FactionStrength) => string;
}[] = [
  {
    key: "military_score",
    label: "Military",
    color: "var(--destructive)",
    detail: (f) =>
      `${f.fight_ship_count} combat ships · ${f.military_station_count} military stations`,
  },
  {
    key: "economic_score",
    label: "Economic",
    color: "var(--success)",
    detail: (f) =>
      `${f.economic_station_count} stations · ${f.trade_ship_count} traders · ${f.mine_ship_count} miners`,
  },
  {
    key: "diplomatic_score",
    label: "Diplomatic",
    color: "var(--info)",
    detail: (f) => `avg relation ${f.avg_relation.toFixed(1)} / 30`,
  },
  {
    key: "territory_score",
    label: "Territory",
    color: "hsl(38 92% 50%)",
    detail: (f) => `${f.sector_count} sectors · ${f.cluster_count} clusters`,
  },
];

export function FactionDetailPanel({ factionId, onClose, hasSave }: { factionId: string; onClose: () => void; hasSave: boolean }) {
  const [activeTab, setActiveTab] = useState<"overview" | "diplomacy" | "licences">("overview");

  const { data: faction, isLoading: factionLoading } = useQuery<FactionDetail>({
    queryKey: ["faction", factionId],
    queryFn: () => apiGet<FactionDetail>(`/api/v1/factions/${factionId}`),
  });

  const { data: licences = [], isLoading: licencesLoading } = useQuery<FactionLicence[]>({
    queryKey: ["faction-licences", factionId],
    queryFn: () => apiGet<FactionLicence[]>(`/api/v1/licences?faction_id=${factionId}`),
  });

  const { data: allFactions = [] } = useQuery<FactionSummary[]>({
    queryKey: ["factions"],
    queryFn: () => apiGet<FactionSummary[]>("/api/v1/factions"),
  });

  const { data: relations = [] } = useQuery<FactionRelation[]>({
    queryKey: ["faction-relations", factionId],
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
    queryKey: ["factions-strength"],
    queryFn: () => apiGet<FactionStrength[]>("/api/v1/factions/strength"),
    staleTime: 30_000,
  });

  const strengthEntry = strengthData.find((f) => f.faction_id === factionId);

  const ranks = useMemo(() => {
    const result = {} as Record<MetricKey, number | null>;
    for (const m of METRICS) {
      const score = strengthData.find((f) => f.faction_id === factionId)?.[m.key] ?? 0;
      if (score === 0) { result[m.key] = null; continue; }
      const sorted = [...strengthData].filter((f) => f[m.key] > 0).sort((a, b) => b[m.key] - a[m.key]);
      const idx = sorted.findIndex((f) => f.faction_id === factionId);
      result[m.key] = idx >= 0 ? idx + 1 : null;
    }
    return result;
  }, [strengthData, factionId]);

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
          {licences.length > 0 && (
            <PageTab active={activeTab === "licences"} onClick={() => setActiveTab("licences")}>
              Licences <span className="text-xs text-muted-foreground ml-1">{licences.length}</span>
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
                <div className="grid grid-cols-4 gap-3">
                  {METRICS.map((m) => {
                    const rank = ranks[m.key];
                    const score = strengthEntry[m.key];
                    const medal =
                      rank === 1 ? "#FFD700" : rank === 2 ? "#C0C0C0" : rank === 3 ? "#CD7F32" : null;
                    return (
                      <div
                        key={m.key}
                        className="rounded-md border border-border bg-muted/10 p-3 flex flex-col gap-2"
                      >
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        <div className="flex items-baseline gap-2">
                          <p
                            className="text-2xl font-bold tabular-nums leading-none"
                            style={{ color: rank != null ? (medal ?? m.color) : undefined }}
                          >
                            {rank != null ? `#${rank}` : "—"}
                          </p>
                          {rank != null && (
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {score.toFixed(0)}/100
                            </span>
                          )}
                        </div>
                        <div className="h-1 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${score}%`, backgroundColor: score > 0 ? m.color : undefined }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{m.detail(strengthEntry)}</p>
                      </div>
                    );
                  })}
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
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: f.color_hex }}
                          />
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

        {licences.length > 0 && activeTab === "licences" && (
          <div className="flex-1 overflow-auto px-6 pb-6 pt-2">
            <div className="flex flex-col text-sm border-t border-b border-border/50 max-w-4xl">
              {licences.map((l, i) => {
                const displayName =
                  l.name ||
                  l.licence_type
                    .replace(/([A-Z])/g, " $1")
                    .replace(/_/g, " ")
                    .trim()
                    .replace(/\b\w/g, (c) => c.toUpperCase());

                return (
                  <div
                    key={l.licence_type}
                    className={`flex items-center px-6 py-3 ${i % 2 === 0 ? "bg-muted/5" : "bg-transparent"} border-b border-border/50 gap-4 last:border-b-0`}
                  >
                    <div className="flex-1 flex items-center gap-2">
                      <span className="font-medium text-foreground">{displayName}</span>
                      {l.description && (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">
                              <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-sm leading-relaxed p-3">
                              {l.description}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>

                    <div className="text-right w-28 shrink-0">
                      {l.price != null && <Currency value={l.price} />}
                    </div>

                    <div className="text-right w-20 shrink-0">
                      {l.min_relation != null && (
                        <span title="Required Relation" className="text-xs text-muted-foreground whitespace-nowrap">
                          Rep: <Reputation value={getReputationScore(l.min_relation)} />
                        </span>
                      )}
                    </div>

                    <div className="text-left w-48 shrink-0">
                      {l.precursor && (
                        <span title="Required Precursor Licence" className="text-xs text-muted-foreground whitespace-nowrap">
                          Requires: {l.precursor.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MatrixView ───────────────────────────────────────────────────────────────
