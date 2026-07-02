import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";
import { PageLoaderPreset } from "../../../components/layout/PageLoader";
import { apiGet } from "../../../lib/api";
import { NoSavePlaceholder } from "./NoSavePlaceholder";

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
  avg_relation: number; // game-scale -30..30
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

export function StandingsView({ onSelectFaction, hasSave }: { onSelectFaction: (id: string) => void; hasSave: boolean }) {
  const { data: strength = [], isLoading } = useQuery<FactionStrength[]>({
    queryKey: ["factions-strength"],
    queryFn: () => apiGet<FactionStrength[]>("/api/v1/factions/strength"),
    staleTime: 30_000,
    enabled: hasSave,
  });

  const byMetric = useMemo(
    () =>
      METRICS.map((m) => ({
        ...m,
        ranked: [...strength]
          .sort((a, b) => b[m.key] - a[m.key])
          .filter((f) => f[m.key] > 0)
          .slice(0, 8),
      })),
    [strength]
  );

  if (!hasSave) return <NoSavePlaceholder title="No save loaded" />;
  if (isLoading) return <PageLoaderPreset preset="factions" />;

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-2 gap-4">
        {byMetric.map((m) => (
          <div key={m.key} className="rounded-md border border-border overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/20 border-b border-border flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
              <span className="text-sm font-semibold" style={{ color: m.color }}>
                {m.label}
              </span>
            </div>
            <div className="divide-y divide-border/40">
              {m.ranked.map((f, i) => (
                <div
                  key={f.faction_id}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-muted/20 cursor-pointer transition-colors"
                  onClick={() => onSelectFaction(f.faction_id)}
                >
                  <span className="text-xs text-muted-foreground w-4 tabular-nums shrink-0">
                    {i + 1}
                  </span>
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: f.color_hex ?? "#888" }}
                  />
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm truncate flex-1 min-w-0 text-left">{f.name}</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {m.detail(f)}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${f[m.key]}%`, backgroundColor: m.color }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground w-6 text-right">
                      {f[m.key].toFixed(0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
