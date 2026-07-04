// Secondary geometry derived from the sector layout: the background hex grid,
// per-zone screen positions, and overlap detection for parallel gate/highway links.

import { MAP_H, MAP_W, SQRT3 } from "./constants";
import { axialToPixel } from "./geometry";
import type { Cluster, Gate, Highway, MapStation, Sector, Transform, Zone } from "./types";

// Once zoomed in this far, a single sector effectively fills the screen — treat it as
// "active" the same as an explicit hover/select, since deep zoom can make hovering the
// actual hex unreliable (it may render with a transparent fill once the build grid takes
// over) and shouldn't force a click just to look up wares for the sector you're already
// looking at.
const DOMINANT_SECTOR_MIN_SCALE = 1.2;

// The sector nearest the viewport center, once zoomed in enough that it dominates the
// screen. Returns null if zoomed out further than that, or if no sector is close enough
// to center to count as "the one you're looking at".
export function computeDominantSectorId(
  transform: Transform,
  viewport: { w: number; h: number },
  sectorCoords: Map<string, [number, number]>,
  hexSize: number,
): string | null {
  if (transform.scale < DOMINANT_SECTOR_MIN_SCALE || viewport.w === 0 || hexSize === 0) return null;
  const centerMapX = (viewport.w / 2 - transform.x) / transform.scale;
  const centerMapY = (viewport.h / 2 - transform.y) / transform.scale;

  let centerSectorId: string | null = null;
  let minDist = Infinity;
  for (const [sid, [cx, cy]] of sectorCoords.entries()) {
    const dx = cx - centerMapX;
    const dy = cy - centerMapY;
    const distSq = dx * dx + dy * dy;
    if (distSq < minDist && distSq < hexSize * hexSize * 1.5) {
      minDist = distSq;
      centerSectorId = sid;
    }
  }
  return centerSectorId;
}

// A double-clicked sector's on-screen hex radius should reach this fraction of the
// shorter viewport dimension — big enough to dominate the view without depending on
// window/monitor size the way a fixed pixel or fixed-scale target would.
const SECTOR_FILL_FRACTION = 0.85;

// The map scale at which `sectorId`'s hex radius fills most of the current viewport.
// Callers combine this with a "never zoom out" cap (see usePanZoom's panToWorldPos) so
// double-clicking a sector zooms in when needed but just pans/recenters if the user is
// already zoomed in further than this.
export function computeSectorFillScale(
  hexSize: number,
  isSubSector: boolean,
  viewport: { w: number; h: number },
): number {
  const effectiveHexSize = isSubSector ? hexSize * 0.5 : hexSize;
  if (effectiveHexSize <= 0 || viewport.w === 0 || viewport.h === 0) return 3.0;
  const targetOnScreenR = SECTOR_FILL_FRACTION * Math.min(viewport.w, viewport.h) * 0.5;
  return targetOnScreenR / effectiveHexSize;
}

// Sectors that share a cluster with other sectors render at half hex size.
export function computeSubSectorSet(clusters: Cluster[], sectors: Sector[]): Set<string> {
  const set = new Set<string>();
  clusters.forEach((c) => {
    const clusterSecs = sectors.filter((s) => s.cluster_id === c.cluster_id);
    if (clusterSecs.length > 1) {
      clusterSecs.forEach((s) => set.add(s.sector_id));
    }
  });
  return set;
}

// Tile flat-top hexes over the canvas, anchored to gridOrigin so they align with
// placed sectors. Capped to avoid generating too many SVG elements.
export function computeBgGrid(hexSize: number, gridOrigin: [number, number]): [number, number][] {
  if (hexSize === 0) return [];
  const [gox, goy] = gridOrigin;
  const qMax = Math.min(55, Math.ceil(MAP_W / (hexSize * 1.5)) + 3);
  const rMax = Math.min(45, Math.ceil(MAP_H / (hexSize * SQRT3)) + 3);
  const cells: [number, number][] = [];
  for (let q = -qMax; q <= qMax; q++) {
    for (let r = -rMax; r <= rMax; r++) {
      const [px, py] = axialToPixel(q, r, hexSize);
      cells.push([gox + px, goy + (-py)]); // Y-flip matches sector coordinate system
    }
  }
  return cells;
}

export function computeZoneScaleMap(hexSize: number, stations: MapStation[]): Map<string, number> {
  const m = new Map<string, number>();
  if (hexSize === 0) return m;

  // Find the required radius for each sector to contain all its stations
  const sectorMaxR = new Map<string, number>();
  stations.forEach(st => {
    if (!st.sector_id) return;
    const px = Math.abs(st.x ?? 0);
    const pz = Math.abs(st.z ?? 0);
    const r1 = pz * 2 / Math.sqrt(3);
    const r2 = px + pz / Math.sqrt(3);
    const requiredR = Math.max(r1, r2);
    
    const current = sectorMaxR.get(st.sector_id) ?? 0;
    if (requiredR > current) sectorMaxR.set(st.sector_id, requiredR);
  });

  const defaultScale = (hexSize * Math.sqrt(3) / 2) / 300000;
  
  sectorMaxR.forEach((maxR, sectorId) => {
    if (maxR > 250000) {
      // Scale it down so the farthest station fits at 85% of the hex boundary
      const customScale = (hexSize * Math.sqrt(3) / 2) / (maxR * 1.15);
      m.set(sectorId, customScale);
    }
  });

  // Provide a getter-like interface via a Proxy or just return the map and we will use a helper
  // Wait, the map might not have all sectors. We'll just return the map and fall back to defaultScale.
  m.set("__default", defaultScale);
  return m;
}

export function computeZoneScreenPos(
  zones: Zone[],
  sectorCoords: Map<string, [number, number]>,
  zoneScaleMap: Map<string, number>,
  subSectorSet: Set<string>,
): Map<string, [number, number]> {
  const m = new Map<string, [number, number]>();
  if (!zoneScaleMap.has("__default")) return m;
  const defaultScale = zoneScaleMap.get("__default")!;
  
  zones.forEach((z) => {
    if (!z.sector_id) return;
    const sp = sectorCoords.get(z.sector_id);
    if (!sp) return;

    const baseScale = zoneScaleMap.get(z.sector_id) ?? defaultScale;
    const isSubSector = subSectorSet.has(z.sector_id);
    const scale = isSubSector ? baseScale * 0.5 : baseScale;

    const dx = (z.x ?? 0) * scale;
    const dz = (z.z ?? 0) * scale;

    m.set(z.zone_id, [sp[0] + dx, sp[1] - dz]);
  });
  return m;
}

// Map each station to a screen position inside its sector hex, using the same
// game-units→canvas scale as zones (halved for sub-sectors). Save-derived station ids
// are lowercase while the static sector keys are PascalCase, so match case-insensitively.
// Stations with no known offset fall back to the sector centre rather than vanishing.
export function computeStationScreenPos(
  stations: MapStation[],
  sectorCoords: Map<string, [number, number]>,
  zoneScaleMap: Map<string, number>,
  subSectorSet: Set<string>,
): Map<string, [number, number]> {
  const m = new Map<string, [number, number]>();
  if (!zoneScaleMap.has("__default")) return m;
  const defaultScale = zoneScaleMap.get("__default")!;
  
  const sectorCI = new Map<string, [number, number]>();
  sectorCoords.forEach((v, k) => sectorCI.set(k.toLowerCase(), v));
  const subCI = new Set<string>();
  subSectorSet.forEach((s) => subCI.add(s.toLowerCase()));
  
  stations.forEach((st) => {
    if (!st.sector_id) return;
    const key = st.sector_id.toLowerCase();
    const sp = sectorCI.get(key);
    if (!sp) return;
    
    // Find the original case sector_id for map lookup
    const originalSectorId = Array.from(sectorCoords.keys()).find(k => k.toLowerCase() === key) ?? st.sector_id;
    const baseScale = zoneScaleMap.get(originalSectorId) ?? defaultScale;
    
    const scale = subCI.has(key) ? baseScale * 0.5 : baseScale;
    m.set(st.station_id, [sp[0] + (st.x ?? 0) * scale, sp[1] - (st.z ?? 0) * scale]);
  });
  return m;
}

export type OverlappingPaths = {
  counts: Map<string, number>;
  getSig: (p1: [number, number], p2: [number, number]) => string;
};

export function computeOverlappingPaths(
  highways: Highway[],
  gates: Gate[],
  zoneMap: Map<string, Zone>,
  zoneScreenPos: Map<string, [number, number]>,
  sectorCoords: Map<string, [number, number]>,
): OverlappingPaths {
  const counts = new Map<string, number>();
  const getSig = (p1: [number, number], p2: [number, number]) => {
    const s1 = `${Math.round(p1[0]/10)},${Math.round(p1[1]/10)}`;
    const s2 = `${Math.round(p2[0]/10)},${Math.round(p2[1]/10)}`;
    return s1 < s2 ? `${s1}-${s2}` : `${s2}-${s1}`;
  };

  const addConnection = (z1Id: string, z2Id: string) => {
    const z1 = zoneMap.get(z1Id), z2 = zoneMap.get(z2Id);
    if (!z1?.sector_id || !z2?.sector_id) return;
    const p1 = zoneScreenPos.get(z1Id) ?? sectorCoords.get(z1.sector_id);
    const p2 = zoneScreenPos.get(z2Id) ?? sectorCoords.get(z2.sector_id);
    if (p1 && p2) {
      const sig = getSig(p1, p2);
      counts.set(sig, (counts.get(sig) ?? 0) + 1);
    }
  };

  highways.forEach(hw => addConnection(hw.from_zone_id, hw.to_zone_id));
  gates.forEach(g => addConnection(g.from_zone_id, g.to_zone_id));

  return { counts, getSig };
}
