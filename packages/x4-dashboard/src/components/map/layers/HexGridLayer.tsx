// Background hex grid — faint cells tiled across the canvas behind everything. Neither
// `cells` nor `hexSize` depend on pan/zoom (they're derived once from the sector layout),
// so this is memoized: without it, React would re-diff up to ~10k polygons on every
// mousemove while panning even though none of them ever actually change.

import { memo } from "react";
import { hexPoints } from "../../../lib/map/geometry";
import { MAP_THEME } from "../../../lib/map/constants";

function HexGridLayerImpl({ cells, hexSize }: { cells: [number, number][]; hexSize: number }) {
  return (
    <>
      {cells.map(([cx, cy], i) => (
        <polygon key={`bg-${i}`}
          points={hexPoints(cx, cy, hexSize)}
          fill="none"
          stroke={MAP_THEME.gridLine}
          strokeWidth={0.6}
          style={{ pointerEvents: "none" }}
        />
      ))}
    </>
  );
}

export const HexGridLayer = memo(HexGridLayerImpl);
