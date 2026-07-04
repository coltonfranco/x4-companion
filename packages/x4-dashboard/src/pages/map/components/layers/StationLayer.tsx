// Station markers inside their sector hexes, drawn with the in-game map-object icon for
// the station's function and tinted to the owning faction. Visibility is tiered by zoom:
// fully zoomed out shows only the player's own stations, mid zoom adds every faction's
// main facilities, and zooming into a sector (grid territory) reveals every station —
// each tier fades in gradually rather than popping in. Markers grow with zoom too, in
// the same log-ratio-smoothed way, so there's no size "jump" to go with the reveal.

import { MAP_THEME } from "../../../../lib/map/constants";
import type { MapStation, Transform } from "../../../../lib/map/types";
import type { FactionSummary } from "../../../../lib/types";
import {
  isMainFacility,
  isPlayerStation,
  STATION_ALL_SCREEN_RADIUS,
  STATION_MAJOR_SCREEN_RADIUS,
} from "../../../../lib/map/stations";
import { StationMapIcon } from "../../../../components/map/StationMapIcon";

// Fade bands are defined as a zoom RATIO, not a fixed pixel width. Scroll-wheel zoom
// changes onScreenHexR multiplicatively (~15% per notch), so a fixed-px band gets
// crossed in a single click once the hex is already large on screen — it reads as a
// hard pop-in even though the opacity math is technically continuous. A ratio-based
// band takes a consistent number of zoom clicks to cross no matter where the
// threshold falls in absolute px.
const FADE_RATIO = 1.7;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Interpolates in log space so equal zoom ratios (not equal pixel distances) produce
// equal progress — see FADE_RATIO above.
function logSmoothstep(threshold: number, ratio: number, x: number): number {
  if (x <= 0) return 0;
  const logX = Math.log(x);
  const logEdge1 = Math.log(threshold);
  const logEdge0 = logEdge1 - Math.log(ratio);
  return smoothstep(logEdge0, logEdge1, logX);
}

// How visible a station is at the current zoom: player stations always show; main
// facilities (shipyards, wharves...) fade in around the "major" threshold; everything
// else fades in around the "all" threshold. Continuous, so there's no hard pop-in.
function revealOpacity(st: MapStation, onScreenHexR: number): number {
  if (isPlayerStation(st)) return 1;
  const threshold = isMainFacility(st) ? STATION_MAJOR_SCREEN_RADIUS : STATION_ALL_SCREEN_RADIUS;
  return logSmoothstep(threshold, FADE_RATIO, onScreenHexR);
}

// Icon screen size ramps in log space for the same reason as the fade bands above — a
// linear ramp between two fixed px bounds still has hard "corners" where growth
// abruptly starts and stops, which is exactly as perceptible as a pop-in once the ramp
// saturates right where a batch of stations is fading into view.
const SIZE_MIN_PX = 16;
const SIZE_MAX_PX = 54;
const SIZE_RAMP_LOW = 90;
const SIZE_RAMP_HIGH = 620;

function stationScreenSize(onScreenHexR: number): number {
  if (onScreenHexR <= 0) return SIZE_MIN_PX;
  const logX = Math.log(onScreenHexR);
  const t = smoothstep(Math.log(SIZE_RAMP_LOW), Math.log(SIZE_RAMP_HIGH), logX);
  return SIZE_MIN_PX + (SIZE_MAX_PX - SIZE_MIN_PX) * t;
}

// Extra world-space margin (in screen px, converted per-frame) added around the
// viewport so stations don't pop in/out right at the screen edge while panning.
const CULL_MARGIN_PX = 100;

export function StationLayer({
  stations, stationScreenPos, factionMap, hexSize, transform, viewport,
  selectedStationId, onSelect, onHover, onOpenDetail,
}: {
  stations: MapStation[];
  stationScreenPos: Map<string, [number, number]>;
  factionMap: Map<string, FactionSummary>;
  hexSize: number;
  transform: Transform;
  viewport: { w: number; h: number };
  selectedStationId: string | null;
  onSelect: (st: MapStation) => void;
  onHover: (st: MapStation | null) => void;
  onOpenDetail?: (stationId: string) => void;
}) {
  const onScreenHexR = hexSize * transform.scale;

  // Visible world-space rect (mirrors HexBuildGridLayer's viewport culling) so we only
  // ever build DOM nodes for stations that could actually be on screen — the reveal-tier
  // opacity above only decides *which categories* show, not how many are drawn.
  const margin = CULL_MARGIN_PX / transform.scale;
  const vMinX = (0 - transform.x) / transform.scale - margin;
  const vMaxX = (viewport.w - transform.x) / transform.scale + margin;
  const vMinY = (0 - transform.y) / transform.scale - margin;
  const vMaxY = (viewport.h - transform.y) / transform.scale + margin;
  const cullingActive = viewport.w > 0 && viewport.h > 0;

  return (
    <>
      {stations.map((st) => {
        const pos = stationScreenPos.get(st.station_id);
        if (!pos) return null;
        const [cx, cy] = pos;
        if (cullingActive && (cx < vMinX || cx > vMaxX || cy < vMinY || cy > vMaxY)) {
          return null;
        }
        const opacity = revealOpacity(st, onScreenHexR);
        if (opacity <= 0.02) return null;

        // Icon grows with how large the sector reads on screen (so it gets bigger as you
        // zoom in), clamped to a readable range; HQ a touch larger.
        const screenPx = stationScreenSize(onScreenHexR) * (st.is_hq ? 1.3 : 1);
        const sizeWorld = screenPx / transform.scale;

        const faction = st.owner_faction ? factionMap.get(st.owner_faction) : null;
        const color = st.is_hq ? MAP_THEME.stationPlayer : (faction?.color_hex ?? MAP_THEME.station);
        const isSelected = st.station_id === selectedStationId;

        return (
          <g key={st.station_id} transform={`translate(${cx},${cy})`}
            style={{ cursor: "pointer", opacity, pointerEvents: opacity < 0.15 ? "none" : "auto" }}
            onClick={(e) => { e.stopPropagation(); onSelect(st); }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (st.source === "live" && onOpenDetail) onOpenDetail(st.station_id);
            }}
            onMouseEnter={() => onHover(st)} onMouseLeave={() => onHover(null)}>
            {/* Invisible hit target so the thin icon strokes are easy to hover/click. */}
            <circle r={sizeWorld * 0.6} fill="transparent" />
            {isSelected && (
              <circle r={sizeWorld * 0.72} fill="none" stroke="#ffffff" strokeWidth={1.5 / transform.scale} />
            )}
            <StationMapIcon station={st} color={color} sizeWorld={sizeWorld} />
          </g>
        );
      })}
    </>
  );
}
