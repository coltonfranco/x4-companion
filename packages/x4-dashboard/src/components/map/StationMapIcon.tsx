import { useId } from "react";

import type { MapStation } from "../../lib/map/types";

export const CATEGORY_ICONS: Record<string, string> = {
  shipyard: "mapob_shipyard.png",
  wharf: "mapob_wharf.png",
  equipmentdock: "mapob_equipmentdock.png",
  tradestation: "mapob_tradestation.png",
  headquarters: "mapob_playerhq.png",
  defence: "mapob_defensestation.png",
  piratebase: "mapob_piratestation.png",
};

export const WARE_GROUP_ICONS: Record<string, string> = {
  agricultural: "mapob_agricultural.png",
  energy: "mapob_energy.png",
  food: "mapob_food.png",
  gases: "mapob_refined.png",
  hightech: "mapob_hightech.png",
  ice: "mapob_water.png",
  minerals: "mapob_refined.png",
  pharmaceutical: "mapob_pharmaceutical.png",
  refined: "mapob_refined.png",
  shiptech: "mapob_shiptech.png",
  water: "mapob_water.png",
};

type StationIconStation = {
  category?: string | null;
  icon_group?: string | null;
  is_hq?: boolean;
  production_product_icon_url?: string | null;
};

type StationIconDescriptor = {
  kind: "product" | "station";
  href: string;
};

const STATION_GLYPH_CATEGORIES = new Set([
  "shipyard",
  "wharf",
  "equipmentdock",
  "tradestation",
  "headquarters",
  "defence",
  "piratebase",
]);

export function iconPathFor(st: {
  category?: string | null;
  icon_group?: string | null;
  is_hq?: boolean;
}): string {
  if (st.is_hq) return "mapob_playerhq.png";
  if (st.category && CATEGORY_ICONS[st.category]) return CATEGORY_ICONS[st.category];
  if (st.icon_group && WARE_GROUP_ICONS[st.icon_group]) return WARE_GROUP_ICONS[st.icon_group];
  return "mapob_factory.png";
}

export function iconForStation(st: MapStation): string {
  return iconPathFor(st);
}

function productionIconUrlForStation(st: StationIconStation): string | null {
  if (!st.production_product_icon_url || st.is_hq) return null;
  const category = st.category?.toLowerCase() ?? null;
  if (category && STATION_GLYPH_CATEGORIES.has(category)) return null;
  return st.production_product_icon_url;
}

function stationIconDescriptor(st: StationIconStation): StationIconDescriptor {
  const productIconUrl = productionIconUrlForStation(st);
  if (productIconUrl) return { kind: "product", href: productIconUrl };
  return { kind: "station", href: `/static/icons/map_objects/${iconPathFor(st)}` };
}

function hexFramePoints(radius: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i;
    return `${(Math.cos(angle) * radius).toFixed(3)},${(Math.sin(angle) * radius).toFixed(3)}`;
  }).join(" ");
}

export function StationIcon({
  station,
  className,
  style,
  color = "#aeb7c8",
}: {
  station: StationIconStation;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
}) {
  const rawId = useId();
  const descriptor = stationIconDescriptor(station);
  const maskId = `sti-mask-${rawId.replace(/:/g, "")}`;
  const half = 64;
  const productHalf = 37;
  const imageHalf = descriptor.kind === "product" ? productHalf : half;

  return (
    <svg
      className={className}
      style={{ display: "block", ...style }}
      viewBox="-64 -64 128 128"
      aria-hidden="true"
    >
      <defs>
        <mask
          id={maskId}
          x={-imageHalf}
          y={-imageHalf}
          width={imageHalf * 2}
          height={imageHalf * 2}
          maskUnits="userSpaceOnUse"
          style={{ maskType: "luminance" } as React.CSSProperties}
        >
          <image
            href={descriptor.href}
            x={-imageHalf}
            y={-imageHalf}
            width={imageHalf * 2}
            height={imageHalf * 2}
            preserveAspectRatio="xMidYMid meet"
          />
        </mask>
      </defs>
      {descriptor.kind === "product" && (
        <polygon
          points={hexFramePoints(56)}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinejoin="round"
        />
      )}
      <rect
        x={-imageHalf}
        y={-imageHalf}
        width={imageHalf * 2}
        height={imageHalf * 2}
        fill={color}
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}

export function StationTypeIcon(props: {
  station: StationIconStation;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
}) {
  return <StationIcon {...props} />;
}

export function StationMapIcon({
  station,
  color,
  sizeWorld,
}: {
  station: MapStation;
  color: string;
  sizeWorld: number;
}) {
  const rawId = useId();
  const descriptor = stationIconDescriptor(station);
  const half = sizeWorld / 2;

  if (descriptor.kind === "product") {
    const glyphSize = sizeWorld * 0.58;
    const glyphHalf = glyphSize / 2;
    const frameRadius = sizeWorld * 0.48;
    const strokeWidth = sizeWorld * 0.055;
    const maskId = `smi-product-mask-${rawId.replace(/:/g, "")}`;

    return (
      <g style={{ pointerEvents: "none" }}>
        <defs>
          <mask
            id={maskId}
            x={-glyphHalf}
            y={-glyphHalf}
            width={glyphSize}
            height={glyphSize}
            maskUnits="userSpaceOnUse"
            style={{ maskType: "luminance" } as React.CSSProperties}
          >
            <image
              href={descriptor.href}
              x={-glyphHalf}
              y={-glyphHalf}
              width={glyphSize}
              height={glyphSize}
              preserveAspectRatio="xMidYMid meet"
            />
          </mask>
        </defs>
        <polygon
          points={hexFramePoints(frameRadius)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
        <rect
          x={-glyphHalf}
          y={-glyphHalf}
          width={glyphSize}
          height={glyphSize}
          fill={color}
          mask={`url(#${maskId})`}
        />
      </g>
    );
  }

  const maskId = `smi-mask-${rawId.replace(/:/g, "")}`;

  return (
    <g style={{ pointerEvents: "none" }}>
      <defs>
        <mask
          id={maskId}
          x={-half}
          y={-half}
          width={sizeWorld}
          height={sizeWorld}
          maskUnits="userSpaceOnUse"
          style={{ maskType: "luminance" } as React.CSSProperties}
        >
          <image
            href={descriptor.href}
            x={-half}
            y={-half}
            width={sizeWorld}
            height={sizeWorld}
            preserveAspectRatio="xMidYMid meet"
          />
        </mask>
      </defs>
      <rect
        x={-half}
        y={-half}
        width={sizeWorld}
        height={sizeWorld}
        fill={color}
        mask={`url(#${maskId})`}
      />
    </g>
  );
}
