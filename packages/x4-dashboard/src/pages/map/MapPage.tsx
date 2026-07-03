import { useCallback, useEffect, useMemo, useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layers, Maximize, Minimize, MapIcon, Upload } from "lucide-react";

import { AnalysisPanel } from "./components/AnalysisPanel";
import { MapLayersPanel } from "./components/MapLayersPanel";
import { MapCanvas, type MapToggles } from "./components/MapCanvas";
import { MapLegend } from "./components/MapLegend";
import { NavPanel } from "./components/NavPanel";
import { SectorDetailPanel } from "./components/SectorDetailPanel";
import { SectorSearch } from "./components/SectorSearch";
import { sectorDisplayName } from "../../lib/map/names";
import { useMapData } from "../../lib/map/useMapData";
import { useMapLayout } from "../../lib/map/useMapLayout";
import { usePanZoom } from "./hooks/usePanZoom";
import { useSectorIndex } from "./hooks/useSectorIndex";
import type { FillMode } from "../../lib/map/overlays/types";
import type { MapStation } from "../../lib/map/types";
import { useEconomyWares } from "../../lib/map/overlays/useAnalysisData";
import { useAnalysisOverlay, type ConflictToggles } from "../../lib/map/overlays/useAnalysisOverlay";
import type { ConflictEntry, SectorForceEntry } from "../../lib/map/overlays/useAnalysisData";
import { useSettings } from "../../lib/settingsStore";
import { useHasSave } from "../../lib/useHasSave";
import { useLocalStorageState } from "../../lib/useLocalStorageState";
import { apiGet, apiGetOrNull } from "../../lib/api";

const DEFAULT_TOGGLES: MapToggles = {
  showGates: true, showHighways: true, showLocalHighways: true, showGrid: true,
  showStations: true, showFactionLogos: true, showSectorNames: true, showPlayer: true,
  bgStyle: "nebula",
};

const mapApi = getRouteApi("/map");

export default function MapPage() {
  const search = mapApi.useSearch();
  const data = useMapData();
  const { settings } = useSettings();

  // Per-sector detail data — ungated so the detail panel always has it.
  const { data: player } = useQuery<{
    current_sector: string | null;
    sector_id: string | null;
    zone_id: string | null;
  } | null>({
    queryKey: ["player"],
    queryFn: () =>
      apiGetOrNull<{
        current_sector: string | null;
        sector_id: string | null;
        zone_id: string | null;
      }>("/api/v1/player"),
    staleTime: 30_000,
  });
  const { data: forcesData } = useQuery<SectorForceEntry[]>({
    queryKey: ["map-forces"],
    queryFn: () => apiGet<SectorForceEntry[]>("/api/v1/map/forces"),
    staleTime: 30_000,
  });
  const { data: conflictsData } = useQuery<ConflictEntry[]>({
    queryKey: ["map-conflicts"],
    queryFn: () => apiGet<ConflictEntry[]>("/api/v1/map/conflicts"),
    staleTime: 30_000,
  });

  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [hoveredSectorId, setHoveredSectorId] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<MapStation | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const [toggles, setToggles] = useLocalStorageState<MapToggles>("x4map:toggles", DEFAULT_TOGGLES, {
    deserialize: (raw) => ({ ...DEFAULT_TOGGLES, ...JSON.parse(raw) }),
  });

  const [conflictToggles, setConflictToggles] = useState<ConflictToggles>({
    showConflicts: true,
    showTensions: true,
    showDanger: true,
    showPlayer: true,
  });
  const [activeDlcs, setActiveDlcs] = useLocalStorageState<Set<string> | null>("x4map:activeDlcs", null, {
    serialize: (v) => (v === null ? null : JSON.stringify([...v])),
    deserialize: (raw) => {
      const parsed = JSON.parse(raw);
      // null means "all enabled" — don't create an empty Set
      return parsed === null || !Array.isArray(parsed) ? null : new Set<string>(parsed);
    },
  });

  // Overlay state.
  const [fillMode, setFillMode] = useState<FillMode>(search.ware || search.routes ? "trade" : "faction");
  const [resource, setResource] = useState<string | null>(null);
  const [wareId, setWareId] = useState<string | null>(search.ware ?? null);
  const [maxJumps, setMaxJumps] = useState<number | null>(null);
  const [navFrom, setNavFrom] = useState<string | null>(search.from ?? null);
  const [navTo, setNavTo] = useState<string | null>(search.to ?? null);
  const [navFromPos, setNavFromPos] = useState<[number, number] | null>(null);
  const [navToPos, setNavToPos] = useState<[number, number] | null>(null);

  // Re-apply deep-link params if they change while the map is already mounted.
  useEffect(() => {
    if (search.ware) { setFillMode("trade"); setWareId(search.ware); }
    else if (search.routes) setFillMode("trade");
    if (search.from) setNavFrom(search.from);
    if (search.to) setNavTo(search.to);
  }, [search.ware, search.routes, search.from, search.to]);

  const layout = useMapLayout(data, activeDlcs, settings.fogOfWar);
  const { sectorCoords, hexSize, visibleSectors, clusterMap, resourcesByCluster, factionMap, allDlcs, enabledDlcs, visibleGates, visibleHighways } = layout;

  const visibleStations = useMemo(() => {
    if (!settings.fogOfWar) return data.stations;
    // Live stations carry save-file macro casing (lowercase); visibleSectorIds comes from
    // the static catalog (mixed case) — compare case-insensitively like computeStationScreenPos does.
    const visibleLower = new Set(Array.from(layout.visibleSectorIds, (id) => id.toLowerCase()));
    return data.stations.filter(s => s.sector_id && visibleLower.has(s.sector_id.toLowerCase()));
  }, [data.stations, settings.fogOfWar, layout.visibleSectorIds]);

  // ── Per-sector lookup maps for the detail panel ──
  const { zoneCountBySector, stationCatsBySector, connectionsBySector, forcesBySector, conflictsBySector } =
    useSectorIndex(data, forcesData, conflictsData);

  const panZoom = usePanZoom(sectorCoords, visibleSectors, hexSize);

  const economyWaresQuery = useEconomyWares(fillMode === "trade");
  const wareName = useMemo(
    () => economyWaresQuery.data?.find((w) => w.ware_id === wareId)?.ware_name ?? null,
    [economyWaresQuery.data, wareId]
  );

  const overlay = useAnalysisOverlay({
    fillMode, resource, wareId, maxJumps, navFrom, navTo, navFromPos, navToPos,
    sectorCoords, gates: visibleGates, highways: visibleHighways,
    zoneMap: layout.zoneMap, zoneScreenPos: layout.zoneScreenPos,
    sectors: visibleSectors, clusterMap: layout.clusterMap, zoneScaleMap: layout.zoneScaleMap,
    conflictToggles,
  });

  const sectorName = useCallback((id: string) => {
    const s = data.sectors.find((x) => x.sector_id.toLowerCase() === id.toLowerCase());
    return s ? sectorDisplayName(s) : id;
  }, [data.sectors]);

  const selectedSector = useMemo(
    () => data.sectors.find((s) => s.sector_id === selectedSectorId) ?? null,
    [data.sectors, selectedSectorId]
  );

  const setToggle = <K extends keyof MapToggles>(key: K) => (v: MapToggles[K]) =>
    setToggles((t) => ({ ...t, [key]: v }));

  // Left-click: select (highlighted bounds) and set the nav origin, clearing any plotted
  // route so plain browsing never draws one. In trade-routes view it also highlights the
  // clicked sector's best route — the whole hex is the click target, not a tiny dot.
  const handleSelectSector = useCallback((id: string | null, mapPos?: [number, number]) => {
    setSelectedSectorId(id);
    if (id) {
      if (id !== navFrom) {
        setNavTo(null);
        setNavToPos(null);
      }
      setNavFrom(id);
      setNavFromPos(mapPos ?? null);
    }
  }, [fillMode, wareId, navFrom]);

  // Selecting a station opens its popover and drops any sector selection.
  const handleSelectStation = useCallback((st: MapStation | null) => {
    setSelectedStation(st);
    if (st) setSelectedSectorId(null);
  }, []);

  // Right-click: set the navigation destination (origin stays sticky for repeat probing).
  const handleContextSector = useCallback((id: string, mapPos?: [number, number]) => {
    setNavTo(id);
    setNavToPos(mapPos ?? null);
  }, []);

  const clearNav = useCallback(() => {
    setNavFrom(null); setNavTo(null);
    setNavFromPos(null); setNavToPos(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { clearNav(); setSelectedStation(null); setLayersOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearNav]);

  const handleFillMode = useCallback((m: FillMode) => {
    setFillMode(m);
  }, []);

  const { hasSave } = useHasSave();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#070b14] text-[#e7edf6] relative font-['Space_Grotesk',sans-serif]">
      <MapCanvas
        data={{ ...data, stations: visibleStations, gates: visibleGates, highways: visibleHighways }}
        layout={layout}
        toggles={toggles}
        overlay={overlay}
        transform={panZoom.transform}
        viewport={panZoom.viewport}
        isPanning={panZoom.isPanning}
        containerRef={panZoom.containerRef}
        handlers={panZoom.handlers}
        selectedSectorId={selectedSectorId}
        hoveredSectorId={hoveredSectorId}
        onSelectSector={handleSelectSector}
        onHoverSector={setHoveredSectorId}
        onContextSector={handleContextSector}
        navFrom={navFrom}
        navTo={navTo}
        onClearNav={clearNav}
        sectorName={sectorName}
        selectedStation={selectedStation}
        onSelectStation={handleSelectStation}
        showFactionLabels={toggles.showFactionLogos}
        playerSectorId={player?.sector_id ?? player?.current_sector ?? null}
        playerZoneId={player?.zone_id ?? null}
      />

      {/* No-save banner */}
      {!hasSave && (
        <div className="absolute top-[18px] left-1/2 -translate-x-1/2 pointer-events-auto z-30 flex items-center gap-3 px-[16px] py-[10px] bg-amber-500/10 backdrop-blur-[16px] border border-amber-500/30 rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          <Upload className="w-[15px] h-[15px] text-amber-400 shrink-0" strokeWidth={1.5} />
          <span className="text-[12px] text-amber-200 font-medium whitespace-nowrap font-['Space_Grotesk',sans-serif]">
            Load a save to unlock overlays, faction colors, and live data
          </span>
        </div>
      )}

      {/* Top Left Title Overlay — shows Universe Map by default, swaps to selected sector name */}
      <div className="absolute top-[18px] left-[20px] pointer-events-none z-10 bg-[#070b14]/70 backdrop-blur-[10px] rounded-[10px] px-[12px] py-[8px]">
        {selectedSector ? (
          <>
            <div className="flex items-center gap-[9px]">
              <MapIcon className="w-4 h-4 text-[#9fb0cc]" strokeWidth={1.6} />
              <div className="text-[17px] font-semibold tracking-[0.3px] truncate max-w-[260px]">{sectorName(selectedSector.sector_id)}</div>
            </div>
            <div className="text-[11px] text-[#6b7890] mt-[2px] pl-[25px] font-mono">
              {(() => {
                const owner = selectedSector.owner_faction ? factionMap.get(selectedSector.owner_faction) : null;
                const cluster = selectedSector.cluster_id ? clusterMap.get(selectedSector.cluster_id) : null;
                const parts = [owner?.name, cluster?.name].filter(Boolean);
                return parts.length > 0 ? parts.join(" · ") : "Unknown region";
              })()}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-[9px]">
              <MapIcon className="w-4 h-4 text-[#9fb0cc]" strokeWidth={1.6} />
              <div className="text-[17px] font-semibold tracking-[0.3px]">Universe Map</div>
            </div>
            <div className="text-[11px] text-[#6b7890] mt-[2px] pl-[25px] font-mono">
              {visibleSectors.length} sectors · {visibleGates.length} gates · {visibleHighways.length} highways
            </div>
          </>
        )}
      </div>

      {/* Top Right Search & Layers Overlay */}
      <div className="absolute top-[18px] right-[20px] flex items-start gap-[10px] z-20">
        <SectorSearch
          sectors={visibleSectors}
          sectorName={sectorName}
          factionMap={layout.factionMap}
          clusterMap={layout.clusterMap}
          onSelectSector={(id) => {
            handleSelectSector(id);
            panZoom.zoomToSector(id);
          }}
        />

        <button
          onClick={() => setLayersOpen(!layersOpen)}
          className={`flex items-center gap-[7px] px-[13px] py-[9px] backdrop-blur-[12px] rounded-[11px] font-['Space_Grotesk',sans-serif] text-[13px] cursor-pointer transition-colors ${
            layersOpen
              ? 'bg-[#0d121e]/95 border border-white/[0.18] text-[#eef3fa]'
              : 'bg-[#0a0f1a]/85 border border-white/10 text-[#aeb7c8] hover:bg-[#0d121e]/95 hover:text-[#eef3fa]'
          }`}
        >
          <Layers className="w-[15px] h-[15px]" strokeWidth={1.7} />
          Layers
        </button>
      </div>

      {/* Map Layers Panel */}
      {layersOpen && (
        <MapLayersPanel
          allDlcs={allDlcs}
          activeDlcs={enabledDlcs}
          showGates={toggles.showGates}
          showHighways={toggles.showHighways}
          showLocalHighways={toggles.showLocalHighways}
          showGrid={toggles.showGrid}
          showStations={toggles.showStations}
          showFactionLogos={toggles.showFactionLogos}
          onToggleGates={setToggle("showGates")}
          onToggleHighways={setToggle("showHighways")}
          onToggleLocalHighways={setToggle("showLocalHighways")}
          onToggleGrid={setToggle("showGrid")}
          onToggleStations={setToggle("showStations")}
          onToggleFactionLogos={setToggle("showFactionLogos")}
          showSectorNames={toggles.showSectorNames}
          onToggleSectorNames={setToggle("showSectorNames")}
          showPlayer={toggles.showPlayer}
          onTogglePlayer={setToggle("showPlayer")}
          bgStyle={toggles.bgStyle}
          onBgStyleChange={setToggle("bgStyle")}
          onToggleDlc={(dlc, on) => {
            setActiveDlcs((prev) => {
              const current = new Set(prev ?? allDlcs);
              if (on) current.add(dlc); else current.delete(dlc);
              return current.size === allDlcs.length ? null : current;
            });
          }}
        />
      )}

      {/* Phase 2: Analysis Panel (Mode Buttons & Contexts) */}
      <div className="absolute top-[90px] left-[20px] pointer-events-none z-10">
        <AnalysisPanel
          fillMode={fillMode}
          onFillModeChange={handleFillMode}
          resource={resource}
          onResourceChange={setResource}
          onClearResource={() => setResource(null)}
          resourceSource={overlay.resourceSource}
          wareId={wareId}
          wareName={wareName}
          onWareChange={(w) => { setWareId(w); }}
          onClearWare={() => setWareId(null)}
          economyWares={economyWaresQuery.data ?? []}
          waresLoading={economyWaresQuery.isLoading}
          maxJumps={maxJumps}
          onMaxJumpsChange={setMaxJumps}
          overlayLoading={overlay.isLoading}
          conflictToggles={conflictToggles}
          onToggleConflict={(k, v) => setConflictToggles(prev => ({ ...prev, [k]: v }))}
        />
      </div>

      {/* Phase 3: Details Panel */}
      {selectedSector && (() => {
        const sid = selectedSector.sector_id.toLowerCase();
        const forceEntry = forcesBySector.get(sid) ?? null;
        const conflictEntry = conflictsBySector.get(sid) ?? null;
        const stationCats = stationCatsBySector.get(sid);
        const catList = stationCats
          ? [...stationCats.entries()].map(([category, count]) => ({ category, count }))
          : [];

        return (
          <div className="absolute top-[64px] right-[20px] pointer-events-auto z-10">
            <SectorDetailPanel
              sector={selectedSector}
              cluster={selectedSector.cluster_id ? clusterMap.get(selectedSector.cluster_id) ?? null : null}
              resources={selectedSector.cluster_id ? (resourcesByCluster.get(selectedSector.cluster_id) ?? new Set()) : new Set()}
              factionMap={factionMap}
              onClose={() => setSelectedSectorId(null)}
              connections={connectionsBySector.get(sid) ?? []}
              zoneCount={zoneCountBySector.get(sid) ?? 0}
              stationCategories={catList}
              forces={forceEntry?.factions.map((f: any) => ({
                factionId: f.faction_id,
                factionName: f.faction_name,
                fighterCount: f.fighter_count,
                minerCount: f.miner_count,
                traderCount: f.trader_count,
                otherCount: f.other_count,
              })) ?? null}
              conflict={conflictEntry ? {
                type: conflictEntry.type,
                intensity: conflictEntry.intensity,
                invaderName: conflictEntry.invader_name ?? undefined,
                sectorOwnerName: conflictEntry.sector_owner_name ?? undefined,
              } : null}
              playerCurrentSector={player?.current_sector ?? null}
              liveResources={null}
              onNavigate={(targetId) => {
                handleSelectSector(targetId);
                panZoom.zoomToSector(targetId);
              }}
            />
          </div>
        );
      })()}

      {/* Nav Panel */}
      <div className="absolute bottom-[20px] right-[64px] pointer-events-auto z-10">
        <NavPanel navFrom={navFrom} navTo={navTo} onClear={clearNav} sectorName={sectorName} />
      </div>

      {/* Zoom + Fullscreen Controls */}
      <div className="absolute bottom-[20px] right-[20px] flex flex-col gap-[5px] pointer-events-auto z-10">
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="flex items-center justify-center w-[34px] h-[34px] bg-[#0a0f1a]/85 backdrop-blur-[12px] border border-white/10 rounded-[8px] text-[#aeb7c8] hover:text-white hover:bg-[#0d121e]/95 transition-colors cursor-pointer"
        >
          {isFullscreen
            ? <Minimize className="w-[15px] h-[15px]" strokeWidth={1.8} />
            : <Maximize className="w-[15px] h-[15px]" strokeWidth={1.8} />}
        </button>
        <div className="h-[1px] bg-white/[0.07] mx-[4px]" />
        <button onClick={panZoom.zoomIn} title="Zoom in" className="flex items-center justify-center w-[34px] h-[34px] bg-[#0a0f1a]/85 backdrop-blur-[12px] border border-white/10 rounded-[8px] text-[#aeb7c8] hover:text-white hover:bg-[#0d121e]/95 transition-colors cursor-pointer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <button onClick={panZoom.zoomOut} title="Zoom out" className="flex items-center justify-center w-[34px] h-[34px] bg-[#0a0f1a]/85 backdrop-blur-[12px] border border-white/10 rounded-[8px] text-[#aeb7c8] hover:text-white hover:bg-[#0d121e]/95 transition-colors cursor-pointer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <button onClick={panZoom.resetView} title="Fit all sectors" className="flex items-center justify-center w-[34px] h-[34px] bg-[#0a0f1a]/85 backdrop-blur-[12px] border border-white/10 rounded-[8px] text-[#aeb7c8] hover:text-white hover:bg-[#0d121e]/95 transition-colors cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <line x1="12" y1="2" x2="12" y2="6"></line>
            <line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="2" y1="12" x2="6" y2="12"></line>
            <line x1="18" y1="12" x2="22" y2="12"></line>
          </svg>
        </button>
      </div>

      {/* Temporarily reposition MapLegend until Phase 3 */}
      <div className="absolute bottom-[20px] left-[20px] pointer-events-auto z-10">
        <MapLegend
          fillMode={fillMode}
          factionMap={layout.factionMap}
          resource={resource}
        />
      </div>

    </div>
  );
}
