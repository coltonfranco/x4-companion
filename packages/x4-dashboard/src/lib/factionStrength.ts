import { useEffect } from "react";
import { useLocalStorageState } from "./useLocalStorageState";

export type MetricKey = "military_score" | "economic_score" | "diplomatic_score" | "territory_score";
export type StrengthBreakdownKey = "military" | "economic" | "diplomacy" | "territory";

export type StrengthComponent = {
  label: string;
  value: number;
  detail: string;
};

export type StrengthBreakdown = {
  raw: number;
  leader_raw: number;
  leader_ratio: number;
  components: StrengthComponent[];
};

export type FactionStrength = {
  faction_id: string;
  name: string;
  color_hex: string | null;
  military_score: number;
  economic_score: number;
  diplomatic_score: number;
  territory_score: number;
  military: StrengthBreakdown;
  economic: StrengthBreakdown;
  diplomacy: StrengthBreakdown;
  territory: StrengthBreakdown;
  fight_ship_count: number;
  trade_ship_count: number;
  mine_ship_count: number;
  military_station_count: number;
  economic_station_count: number;
  sector_count: number;
  cluster_count: number;
  avg_relation: number; // game-scale -30..30
};

export const PLAYER_FACTION_ID = "player";

/** Mirrors the backend's `_diplomacy_tier` bucketing (x4_api routes/factions.py) so the
 *  label always matches what actually drives diplomatic_score — a tier-weighted average,
 *  not the raw relation number. */
export function diplomaticTierLabel(reputationScore: number): string {
  if (reputationScore <= -20) return "Hostile";
  if (reputationScore <= -10) return "Unfriendly";
  if (reputationScore < 10) return "Neutral";
  if (reputationScore < 20) return "Friendly";
  return "Allied";
}

export const METRICS: {
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
    // Generic fallback for views that only have the aggregate avg_relation (not the
    // per-relationship breakdown) — e.g. every AI faction in the standings grid.
    detail: (f) => `Mostly ${diplomaticTierLabel(f.avg_relation)} (avg relation ${f.avg_relation.toFixed(1)})`,
  },
  {
    key: "territory_score",
    label: "Territory",
    color: "hsl(38 92% 50%)",
    detail: (f) => `${f.sector_count} sectors · ${f.cluster_count} clusters`,
  },
];

export type MetricRanking = (typeof METRICS)[number] & { ranked: FactionStrength[] };

export function breakdownKey(metric: MetricKey): StrengthBreakdownKey {
  if (metric === "military_score") return "military";
  if (metric === "economic_score") return "economic";
  if (metric === "diplomatic_score") return "diplomacy";
  return "territory";
}

/** Per-metric leaderboards: highest score first, zero-score factions excluded (not
 *  meaningfully ranked in that category yet). */
export function computeRankings(strength: FactionStrength[]): MetricRanking[] {
  return METRICS.map((m) => {
    const ranked = [...strength].filter((f) => f[m.key] > 0).sort((a, b) => b[m.key] - a[m.key]);
    const leaderScore = ranked[0]?.[m.key] ?? 0;
    const key = breakdownKey(m.key);
    return {
      ...m,
      ranked: ranked.map((f) => ({
        ...f,
        [key]: {
          ...f[key],
          leader_ratio: leaderScore > 0 ? Math.round((f[m.key] / leaderScore) * 1000) / 10 : 0,
        },
      })),
    };
  });
}

export function findRank(ranked: FactionStrength[], factionId: string): { rank: number; total: number; faction: FactionStrength } | null {
  const idx = ranked.findIndex((f) => f.faction_id === factionId);
  if (idx < 0) return null;
  return { rank: idx + 1, total: ranked.length, faction: ranked[idx] };
}

/** Buckets a rank's percentile-in-field into a human tier label; top-3 (or top ~15%
 *  of a larger field) always reads as "Podium" regardless of field size. */
export function fieldTier(rank: number, total: number): { label: string; isPodium: boolean } {
  if (total <= 1 || rank <= 3) return { label: "Podium", isPodium: true };
  const pct = (rank - 1) / (total - 1);
  if (pct < 0.15) return { label: "Podium", isPodium: true };
  if (pct < 0.5) return { label: "Upper Tier", isPodium: false };
  if (pct < 0.75) return { label: "Mid-Table", isPodium: false };
  return { label: "Lower Tier", isPodium: false };
}

/** Bar width as *position in the field* (1st = 100%, last = ~0%) rather than the raw
 *  0-100 score — a #2-of-30 diplomatic rank should read as a near-win, not a 26/100. */
export function rankBarPct(rank: number, total: number): number {
  if (total <= 1) return 100;
  return Math.round((1 - (rank - 1) / (total - 1)) * 100);
}

const BASELINE_TTL_MS = 10 * 60 * 1000;
type RankSnapshot = { ts: number; ranks: Partial<Record<MetricKey, Record<string, number>>> };

/** Rank-change arrows ("since last check"), backed by a localStorage snapshot shared by
 *  every standings view so they agree with each other. The baseline is rebased every 10
 *  minutes rather than on every poll, so a reload seconds later still shows meaningful
 *  deltas instead of comparing against itself. */
export function useFactionRankBaseline(rankings: MetricRanking[]) {
  const [snapshot, setSnapshot] = useLocalStorageState<RankSnapshot | null>(
    "factions-standings-rank-baseline",
    null
  );

  useEffect(() => {
    if (rankings.every((m) => m.ranked.length === 0)) return;
    const now = Date.now();
    if (snapshot && now - snapshot.ts <= BASELINE_TTL_MS) return;
    const ranks: RankSnapshot["ranks"] = {};
    for (const m of rankings) {
      ranks[m.key] = {};
      m.ranked.forEach((f, i) => {
        ranks[m.key]![f.faction_id] = i + 1;
      });
    }
    setSnapshot({ ts: now, ranks });
    // Baseline only needs to (re)seed when missing/stale; re-running on every
    // snapshot/setSnapshot identity change would fight the TTL check above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankings]);

  return (metric: MetricKey, factionId: string, currentRank: number): number | null => {
    const prev = snapshot?.ranks[metric]?.[factionId];
    if (prev == null) return null;
    return prev - currentRank;
  };
}
