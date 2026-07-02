import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, Table2, Search, Hammer, Users, Factory, Boxes } from "lucide-react";
import { cn } from "../../lib/utils";
import { prettyId } from "../../lib/wareFormat";
import { PageLoaderPreset } from "../../components/layout/PageLoader";
import { apiGet } from "../../lib/api";
import { useLookupMap } from "../../lib/useLookupMap";
import type { Sector, Station, Ware } from "./types";
import { categoryLabel, fmtNum, statusOf, stationDisplayName } from "./lib/stationFormat";
import { StationCard } from "./components/StationCard";
import { StationDetail } from "./components/StationDetail";

// ── Page ────────────────────────────────────────────────────────────────────────
export default function MyStationsPage() {
  const [view, setView] = useState<"cards" | "console">("cards");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [buildingOnly, setBuildingOnly] = useState(false);

  const { data: stations, isLoading } = useQuery<Station[]>({
    queryKey: ["stations-overview"],
    queryFn: () => apiGet<Station[]>("/api/v1/stations?player_only=true&limit=2000"),
    staleTime: 15_000,
  });
  const { data: sectors = [] } = useQuery<Sector[]>({
    queryKey: ["map-sectors"],
    queryFn: () => apiGet<Sector[]>("/api/v1/map/sectors?limit=2000"),
    staleTime: 600_000,
  });
  const { data: wares = [] } = useQuery<Ware[]>({
    queryKey: ["wares-min"],
    queryFn: () => apiGet<Ware[]>("/api/v1/wares?limit=2000"),
    staleTime: 600_000,
  });

  const sectorName = useLookupMap(
    sectors,
    (s) => s.sector_id,
    (s) => s.name,
    { normalizeId: (id) => id.toLowerCase(), onMissing: prettyId, onEmpty: "Unknown" }
  );
  const wareName = useLookupMap(
    wares,
    (w) => w.ware_id,
    (w) => w.name,
    { onMissing: prettyId }
  );

  const all = stations ?? [];
  const types = useMemo(() => {
    const set = new Set<string>();
    for (const s of all) if (s.category) set.add(s.category);
    return [...set].sort();
  }, [all]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((s) => {
      if (buildingOnly && !s.is_under_construction) return false;
      if (typeFilter !== "all" && s.category !== typeFilter) return false;
      if (q && !stationDisplayName(s).toLowerCase().includes(q) && !sectorName(s.sector_id).toLowerCase().includes(q))
        return false;
      return true;
    });
    // sort: building first, then by module count desc
  }, [all, search, typeFilter, buildingOnly, sectorName]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (a.is_under_construction !== b.is_under_construction) return a.is_under_construction ? -1 : 1;
        return (b.module_count ?? 0) - (a.module_count ?? 0);
      }),
    [filtered],
  );

  // KPIs
  const kpi = useMemo(() => {
    const building = all.filter((s) => s.is_under_construction).length;
    const modules = all.reduce((n, s) => n + (s.module_count ?? 0), 0);
    const workforce = all.reduce((n, s) => n + (s.workforce_current ?? 0), 0);
    return { count: all.length, building, modules, workforce };
  }, [all]);

  if (isLoading) return <PageLoaderPreset preset="empire" />;

  if (all.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-dashed border-white/12 p-10 text-center">
          <Factory className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
          <div className="text-[15px] text-foreground">No player-owned stations</div>
          <div className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            Once you own or are building a station, it appears here with its modules, workforce,
            production and build status. Load a save with a player station to populate this view.
          </div>
        </div>
      </div>
    );
  }

  const selected = sorted.find((s) => s.station_id === selectedId) ?? sorted[0] ?? null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header + KPIs */}
      <div className="flex-none px-6 pt-5">
        <div className="mb-3.5 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[25px] font-semibold tracking-[0.3px]">Station Overview</h1>
            <div className="mt-1 font-mono text-[11px] tracking-[1.5px] text-muted-foreground">
              {kpi.count} STATION{kpi.count === 1 ? "" : "S"} · {kpi.building} BUILDING
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-[10px] border border-white/8 bg-[#0c1322] p-1">
            <ViewToggle active={view === "cards"} onClick={() => setView("cards")} icon={LayoutGrid} label="Fleet Cards" />
            <ViewToggle active={view === "console"} onClick={() => setView("console")} icon={Table2} label="Ops Console" />
          </div>
        </div>

        <div className="mb-3.5 grid grid-cols-4 gap-3">
          <Kpi label="STATIONS" value={`${kpi.count}`} color="#3b9ae1" icon={Boxes} />
          <Kpi label="UNDER CONSTRUCTION" value={`${kpi.building}`} color="#5cc8ec" icon={Hammer} />
          <Kpi label="MODULES" value={`${kpi.modules}`} color="#34d399" icon={Factory} />
          <Kpi label="WORKFORCE" value={fmtNum(kpi.workforce)} color="#f0d98a" icon={Users} />
        </div>

        {/* Filters */}
        <div className="mb-3 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/8 bg-[#0c1322] px-3 py-1.5 text-[12.5px] text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter stations…"
              className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-white/8 bg-[#0c1322] px-2.5 py-1.5 text-[12.5px] text-foreground outline-none"
          >
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {categoryLabel(t)}
              </option>
            ))}
          </select>
          <button
            onClick={() => setBuildingOnly((v) => !v)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors",
              buildingOnly
                ? "border-[#5cc8ec]/40 bg-[#5cc8ec]/10 text-[#8fdcf3]"
                : "border-white/8 bg-[#0c1322] text-muted-foreground hover:text-foreground",
            )}
          >
            Building only
          </button>
        </div>
      </div>

      {/* Body */}
      {view === "cards" ? (
        <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(386px,1fr))] gap-3.5">
            {sorted.map((s) => (
              <StationCard
                key={s.station_id}
                s={s}
                sectorName={sectorName}
                wareName={wareName}
                expanded={!!expanded[s.station_id]}
                onToggle={() => setExpanded((p) => ({ ...p, [s.station_id]: !p[s.station_id] }))}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3.5 px-6 pb-6">
          <div className="flex w-[340px] flex-none flex-col overflow-hidden rounded-xl border border-white/8 bg-[#090e1a]/50">
            <div className="grid flex-none grid-cols-[1fr_64px] gap-2 border-b border-white/8 bg-[#0c1322] px-3.5 py-2.5 font-mono text-[9.5px] tracking-[1.4px] text-[#46506a]">
              <span>STATION</span>
              <span className="text-right">MODULES</span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {sorted.map((s) => {
                const st = statusOf(s);
                const sel = selected?.station_id === s.station_id;
                return (
                  <button
                    key={s.station_id}
                    onClick={() => setSelectedId(s.station_id)}
                    className="grid w-full grid-cols-[1fr_64px] items-center gap-2 border-b border-white/[0.04] px-3.5 py-3 text-left transition-colors"
                    style={{
                      background: sel ? "rgba(59,154,225,0.1)" : "transparent",
                      borderLeft: `3px solid ${sel ? st.color : "transparent"}`,
                    }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 flex-none rounded-full" style={{ background: st.color }} />
                        <span className="truncate text-[13px] font-medium text-foreground">{stationDisplayName(s)}</span>
                      </div>
                      <div className="mt-1 pl-4 text-[10.5px] text-muted-foreground">
                        {categoryLabel(s.category)} · {sectorName(s.sector_id)}
                      </div>
                    </div>
                    <span className="text-right font-mono text-[11.5px] text-[#aab4c6]">
                      {s.is_under_construction ? `${s.module_count ?? 0}/${s.planned_module_count ?? "?"}` : (s.module_count ?? 0)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-white/8 bg-[#090e1a]/50">
            {selected && <StationDetail s={selected} sectorName={sectorName} wareName={wareName} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Header sub-components ──────────────────────────────────────────────────────
function ViewToggle({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof LayoutGrid; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-colors"
      style={{ background: active ? "#1d4f8a" : "transparent", color: active ? "#fff" : "#7a8499" }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function Kpi({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: typeof Boxes }) {
  return (
    <div className="relative overflow-hidden rounded-[11px] border border-white/8 bg-white/[0.02] px-4 py-3">
      <div className="absolute bottom-0 left-0 top-0 w-[3px]" style={{ background: color }} />
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] tracking-[1px] text-muted-foreground">{label}</div>
        <Icon className="h-3.5 w-3.5" style={{ color }} />
      </div>
      <div className="mt-1.5 font-mono text-[22px] font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
