"""Generates the pre-cleaned station-type icons under packages/x4-dashboard/public/icons/station-tint/.

Usage: uv run python scripts/gen_station_tint_icons.py

The game's `stationicon/si_*.png` assets (data/icons/stationicon/, extracted from the
game files — not checked in) bake a soft glow into their *alpha* channel: alpha fades
0→~0.9 in a halo around the pictogram, with pure black RGB, while the pictogram itself
is fully opaque (alpha≈1) across both its light and dark shading. That means neither
raw channel works as a single-color tint mask on its own — alpha masking lets the glow
bleed through as a colored smudge, luminance masking discards the icon's own dark
shading and loses half the shape.

This thresholds the glow out of the alpha channel (smoothstep centered where the glow's
alpha maxes out, ~0.90-0.965, comfortably below the pictogram's ~1.0) and feathers the
result slightly so the edge stays anti-aliased instead of a hard cutout. Output is a
flat white RGB with only the cleaned alpha varying, so any tint color can be applied by
a plain CSS `mask-image` at render time (see StationTypeIcon in StationMapIcon.tsx).

Re-run this after re-extracting game data if `data/icons/stationicon/` changes.
"""

from pathlib import Path

from PIL import Image, ImageFilter

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = REPO_ROOT / "data" / "icons" / "stationicon"
OUT_DIR = REPO_ROOT / "packages" / "x4-dashboard" / "public" / "icons" / "station-tint"

# Every station-type/ware-group icon referenced by CATEGORY_ICONS_PLAIN and
# WARE_GROUP_ICONS_PLAIN in StationMapIcon.tsx (kept in sync manually — small, stable set).
ICONS = [
    "si_shipyard", "si_wharf", "si_equipmentdock", "si_tradestation", "si_playerhq",
    "si_defensestation", "si_piratestation", "si_agricultural", "si_energy", "si_food",
    "si_hightech", "si_water", "si_pharmaceutical", "si_refined", "si_shiptech", "si_factory",
]

GLOW_MAX = 0.90  # observed alpha ceiling of the baked-in glow halo
ICON_MIN = 0.965  # observed alpha floor of the actual pictogram
FEATHER_RADIUS = 0.8  # px, at native 128x128 resolution


def smoothstep(edge0: float, edge1: float, x: float) -> float:
    if x <= edge0:
        return 0.0
    if x >= edge1:
        return 1.0
    t = (x - edge0) / (edge1 - edge0)
    return t * t * (3 - 2 * t)


def clean_icon(src: Path) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    alpha = im.split()[-1]
    thresholded = [round(smoothstep(GLOW_MAX, ICON_MIN, a / 255.0) * 255) for a in alpha.getdata()]
    new_alpha = Image.new("L", im.size)
    new_alpha.putdata(thresholded)
    new_alpha = new_alpha.filter(ImageFilter.GaussianBlur(radius=FEATHER_RADIUS))
    out = Image.new("RGBA", im.size, (255, 255, 255, 0))
    out.putalpha(new_alpha)
    return out


def main() -> None:
    if not SRC_DIR.exists():
        raise SystemExit(f"missing {SRC_DIR} — run the game data extraction first")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name in ICONS:
        src = SRC_DIR / f"{name}.png"
        if not src.exists():
            print(f"skip (missing source): {name}")
            continue
        clean_icon(src).save(OUT_DIR / f"{name}.png")
        print(f"wrote {name}.png")


if __name__ == "__main__":
    main()
