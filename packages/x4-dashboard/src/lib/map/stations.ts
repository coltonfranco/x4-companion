// Station display + classification helpers shared by the map layer and popover.

import type { MapStation } from "./types";

// Function categories the map keeps visible when zoomed out.
export const MAJOR_CATEGORIES = new Set([
  "shipyard", "wharf", "equipmentdock", "tradestation", "headquarters",
]);

const CATEGORY_LABELS: Record<string, string> = {
  shipyard: "Shipyard",
  wharf: "Wharf",
  equipmentdock: "Equipment Dock",
  tradestation: "Trading Station",
  headquarters: "Headquarters",
  defence: "Defence Station",
  piratebase: "Pirate Base",
  factory: "Factory",
};

// A "main facility" is a key economic hub (shipyard / wharf / equipment dock /
// trading station) or the player HQ — regardless of owner.
export function isMainFacility(st: MapStation): boolean {
  return st.is_hq || (st.category != null && MAJOR_CATEGORIES.has(st.category));
}

// Anything the player owns (incl. the HQ).
export function isPlayerStation(st: MapStation): boolean {
  return st.is_player_owned || st.is_hq;
}

// On-screen sector-hex radius (px) thresholds for the map's zoom-tiered station reveal
// (see StationLayer's revealOpacity). Shared here so "jump to station" can compute the
// minimum zoom that actually makes the target station visible, instead of landing on an
// arbitrary fixed scale that might leave it faded out.
export const STATION_ALL_SCREEN_RADIUS = 520;
export const STATION_MAJOR_SCREEN_RADIUS = 110;

// Minimum map `transform.scale` at which `st` is fully revealed, given the universe's
// hex size. Player-owned/HQ stations are always visible, so this returns 0 for them.
export function minScaleForStationReveal(st: MapStation, hexSize: number): number {
  if (isPlayerStation(st) || hexSize <= 0) return 0;
  const radius = isMainFacility(st) ? STATION_MAJOR_SCREEN_RADIUS : STATION_ALL_SCREEN_RADIUS;
  return radius / hexSize;
}

export function stationCategoryLabel(category: string | null): string {
  if (!category) return "Station";
  return CATEGORY_LABELS[category] ?? category.replace(/_/g, " ");
}

export function stationDisplayName(st: MapStation): string {
  if (st.name && !st.name.startsWith("{")) return st.name;
  if (st.code) return st.code;
  return stationCategoryLabel(st.category);
}
