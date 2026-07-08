import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Minus } from "lucide-react";
import { FactionStrengthTooltip } from "../../../components/game/FactionStrengthTooltip";
import { PageLoaderPreset } from "../../../components/layout/PageLoader";
import { apiGet } from "../../../lib/api";
import { VISIBLE_FACTIONS_PATH } from "../../../lib/factionQueries";
import { cn } from "../../../lib/utils";
import { useFactionMap } from "../../../lib/useFactionMap";
import {
  computeRankings,
  METRICS,
  PLAYER_FACTION_ID,
  useFactionRankBaseline,
  type FactionStrength,
  type MetricKey,
} from "../../../lib/factionStrength";
import type { FactionSummary } from "../../../lib/types";
import { NoSavePlaceholder } from "./NoSavePlaceholder";

const TOP_N = 5;

export function StandingsView({
  onSelectFaction,
  hasSave,
  factions,
}: {
  onSelectFaction: (id: string) => void;
  hasSave: boolean;
  factions: FactionSummary[];
}) {
  const { data: strength = [], isLoading } = useQuery<FactionStrength[]>({
    queryKey: ["factions-strength", "visible"],
    queryFn: () => apiGet<FactionStrength[]>(`${VISIBLE_FACTIONS_PATH}/strength`),
    staleTime: 30_000,
    enabled: hasSave,
  });

  const factionInfo = useFactionMap(factions);
  const [expanded, setExpanded] = useState<Record<MetricKey, boolean>>({
    military_score: false,
    economic_score: false,
    diplomatic_score: false,
    territory_score: false,
  });

  const byMetric = useMemo(() => computeRankings(strength), [strength]);
  const rankDelta = useFactionRankBaseline(byMetric);

  if (!hasSave) return <NoSavePlaceholder title="No save loaded" />;
  if (isLoading) return <PageLoaderPreset preset="factions" />;

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-2 gap-4">
        {byMetric.map((m) => {
          const isExpanded = expanded[m.key];
          const visible = isExpanded ? m.ranked : m.ranked.slice(0, TOP_N);
          const playerIdx = m.ranked.findIndex((f) => f.faction_id === PLAYER_FACTION_ID);
          const playerVisible = visible.some((f) => f.faction_id === PLAYER_FACTION_ID);

          return (
            <div key={m.key} className="rounded-md border border-border overflow-hidden flex flex-col">
              <div className="px-4 py-2.5 bg-muted/20 border-b border-border flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                <span className="text-sm font-semibold" style={{ color: m.color }}>
                  {m.label}
                </span>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
                  {m.ranked.length} ranked
                </span>
              </div>

              <div className="divide-y divide-border/40">
                {visible.map((f, i) => (
                  <StandingRow
                    key={f.faction_id}
                    faction={f}
                    rank={i + 1}
                    total={m.ranked.length}
                    metric={m}
                    info={factionInfo.get(f.faction_id)}
                    delta={rankDelta(m.key, f.faction_id, i + 1)}
                    onSelect={() => onSelectFaction(f.faction_id)}
                  />
                ))}
              </div>

              {m.ranked.length > TOP_N && (
                <button
                  onClick={() => setExpanded((prev) => ({ ...prev, [m.key]: !prev[m.key] }))}
                  className="flex items-center gap-1 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors border-t border-border/40"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  {isExpanded ? "Show top 5" : `Show all ${m.ranked.length} factions`}
                </button>
              )}

              {playerIdx >= 0 && !playerVisible && (
                <StandingRow
                  faction={m.ranked[playerIdx]}
                  rank={playerIdx + 1}
                  total={m.ranked.length}
                  metric={m}
                  info={factionInfo.get(PLAYER_FACTION_ID)}
                  delta={null}
                  pinned
                  onSelect={() => onSelectFaction(PLAYER_FACTION_ID)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StandingRow({
  faction,
  rank,
  total,
  metric,
  info,
  delta,
  pinned = false,
  onSelect,
}: {
  faction: FactionStrength;
  rank: number;
  total: number;
  metric: (typeof METRICS)[number];
  info: FactionSummary | undefined;
  delta: number | null;
  pinned?: boolean;
  onSelect: () => void;
}) {
  const isPlayer = faction.faction_id === PLAYER_FACTION_ID;
  const name = isPlayer ? (info?.name ?? "Your Empire") : faction.name;
  const color = faction.color_hex ?? "#888888";
  const score = faction[metric.key];
  const isTop = rank === 1 && !pinned;

  return (
    <FactionStrengthTooltip
      faction={faction}
      metric={metric}
      rank={{ rank, total }}
      subjectLabel={name}
    >
      <div
        className={cn(
          "relative flex items-center gap-3 px-4 cursor-pointer transition-colors hover:brightness-125",
          isTop ? "py-3" : "py-2",
          pinned && "border-t border-border/60 bg-primary/10 hover:bg-primary/15"
        )}
        onClick={onSelect}
      >
      {!pinned && (
        <div
          className="absolute inset-y-0 left-0 pointer-events-none"
          style={{ width: `${Math.min(100, score)}%`, backgroundColor: metric.color, opacity: isTop ? 0.22 : 0.12 }}
        />
      )}

      <span
        className={cn(
          "relative z-10 tabular-nums shrink-0 text-right",
          isTop ? "text-lg font-bold w-5" : "text-xs text-muted-foreground w-4"
        )}
        style={isTop ? { color: metric.color } : undefined}
      >
        {rank}
      </span>

      {info?.icon_url ? (
        <span
          className="relative z-10 shrink-0"
          style={{
            width: isTop ? 16 : 14,
            height: isTop ? 16 : 14,
            backgroundColor: color,
            WebkitMaskImage: `url(${info.icon_url})`,
            WebkitMaskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskImage: `url(${info.icon_url})`,
            maskSize: "contain",
            maskRepeat: "no-repeat",
            maskPosition: "center",
          }}
        />
      ) : (
        <div className="relative z-10 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      )}

      {info?.short_name && (
        <span
          className="relative z-10 shrink-0 rounded-sm border px-1 text-[10px] font-semibold leading-4"
          style={{ backgroundColor: `${color}22`, borderColor: `${color}55`, color }}
        >
          {info.short_name}
        </span>
      )}

      <span className={cn("relative z-10 truncate flex-1 min-w-0 text-left", isTop && "font-semibold")}>
        {name}
      </span>

      {pinned ? null : isPlayer ? (
        <span className="relative z-10 shrink-0 rounded-sm border border-primary/40 bg-primary/15 px-1 text-[10px] font-semibold text-primary">
          YOU
        </span>
      ) : (
        <RankDelta delta={delta} />
      )}

      <span
        className={cn("relative z-10 tabular-nums shrink-0 text-right", isTop ? "text-lg font-bold w-10" : "text-sm w-8")}
        style={isTop ? { color: metric.color } : undefined}
      >
        {score.toFixed(0)}
      </span>
      </div>
    </FactionStrengthTooltip>
  );
}

function RankDelta({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) {
    return <Minus className="relative z-10 h-3 w-3 text-muted-foreground shrink-0" />;
  }
  if (delta > 0) {
    return (
      <span className="relative z-10 flex items-center gap-0.5 text-[10px] font-semibold text-emerald-400 shrink-0">
        <ArrowUp className="h-3 w-3" />
        {delta}
      </span>
    );
  }
  return (
    <span className="relative z-10 flex items-center gap-0.5 text-[10px] font-semibold text-red-400 shrink-0">
      <ArrowDown className="h-3 w-3" />
      {Math.abs(delta)}
    </span>
  );
}
