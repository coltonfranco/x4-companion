"""Map station endpoints."""

import sqlite3
from typing import Annotated

from fastapi import Depends, Query

from x4_api.deps import get_db
from x4_api.domain.station_naming import bulk_resolve_station_names
from x4_api.routes._icons import get_ware_icon_url
from x4_api.routes.map import router
from x4_api.schemas import PublicModel


class MapStation(PublicModel):
    station_id: str
    name: str | None = None
    code: str | None = None
    macro: str | None = None
    owner_faction: str | None = None
    sector_id: str | None = None
    zone_id: str | None = None
    x: float | None = None
    y: float | None = None
    z: float | None = None
    # Function category derived from gamestart tags; one of the major types below or
    # the first tag present, else None for ordinary production stations.
    category: str | None = None
    # Ware group id for factory-type stations (e.g. "shiptech", "refined") — lets the
    # client pick a distinct map icon per factory type instead of one generic icon.
    icon_group: str | None = None
    production_product: str | None = None
    production_product_icon_url: str | None = None
    is_player_owned: bool = False
    is_hq: bool = False
    is_under_construction: bool = False
    source: str = "seed"  # 'live' (active save) | 'seed' (gamestart placement)

# Live station macros encode their function (e.g. station_arg_tradestation_base_01_macro,
# station_pla_headquarters_base_01_macro). Substring → category, checked in this order.
_MACRO_CATEGORY_MARKERS = (
    ("shipyard", "shipyard"),
    ("wharf", "wharf"),
    ("equipmentdock", "equipmentdock"),
    ("tradestation", "tradestation"),
    ("headquarters", "headquarters"),
    ("defence", "defence"),
    ("defense", "defence"),
    ("piratebase", "piratebase"),
    ("piratestation", "piratebase"),
    ("factory", "factory"),
)

def _category_from_macro(macro: str | None) -> str | None:
    """Derive a function category from a live station's macro id."""
    if not macro:
        return None
    m = macro.lower()
    for marker, category in _MACRO_CATEGORY_MARKERS:
        if marker in m:
            return category
    return None


def _single_product_icons(
    conn: sqlite3.Connection,
    station_ids: list[str],
) -> dict[str, tuple[str, str | None]]:
    if not station_ids:
        return {}
    placeholders = ",".join("?" for _ in station_ids)
    product_rows = conn.execute(
        f"SELECT so.station_id, MIN(so.ware_id) AS ware_id, "
        f"       MIN(w.icon_path) AS icon_path, MIN(w.tags) AS tags "
        f"FROM station_offers so "
        f"LEFT JOIN s.wares w ON w.ware_id = so.ware_id "
        f"WHERE so.side = 'sell' AND so.station_id IN ({placeholders}) "
        f"GROUP BY so.station_id "
        f"HAVING COUNT(DISTINCT so.ware_id) = 1",
        station_ids,
    ).fetchall()
    single_products: dict[str, tuple[str, str | None]] = {}
    for pr in product_rows:
        ware_id = pr["ware_id"]
        single_products[pr["station_id"]] = (
            ware_id,
            get_ware_icon_url(ware_id, pr["icon_path"], pr["tags"]),
        )
    return single_products


@router.get("/map/stations", response_model=list[MapStation])
def list_map_stations(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    sector_id: str | None = Query(None, description="Filter by sector macro id"),
    limit: int = Query(5000, ge=1, le=20000),
    offset: int = Query(0, ge=0),
) -> list[MapStation]:
    """Stations positioned within their sector, for the zoomed-in map view.

    Prefers live save stations; positions fall back live -> static zone centre, so
    placement is correct at zone granularity even before per-station offsets are
    parsed. With no save ingested, returns gamestart npc placements (which already
    carry coordinates). `category` is derived from gamestart function tags.

    Zone centre prefers the station's own save-recorded dynamic zone position
    (`zone_dyn_*`) over the static catalog: `zone_id` is a macro, and procedurally-created
    zones (e.g. `tempzone`) share that macro across every physically distinct instance in
    the galaxy — joining by macro alone would collapse unrelated zones onto one static (or
    absent) centre. Ordinary named zones never carry a dynamic position, so this only
    changes placement for the procedural ones.
    """
    params: dict[str, object] = {"limit": limit, "offset": offset}
    sql = [
        "SELECT st.station_id, st.name, st.code, st.macro, st.owner_faction, "
        "st.sector_id, st.zone_id, st.basename, st.nameindex, "
        "(COALESCE(st.zone_dyn_x, z.x, 0) + COALESCE(st.x, 0)) AS x, "
        "(COALESCE(st.zone_dyn_y, z.y, 0) + COALESCE(st.y, 0)) AS y, "
        "(COALESCE(st.zone_dyn_z, z.z, 0) + COALESCE(st.z, 0)) AS z, "
        "st.is_player_owned, st.is_under_construction, "
        "CASE WHEN p.hq_station_id IS NOT NULL AND p.hq_station_id = st.station_id THEN 1 ELSE 0 END AS is_hq, "
        "'live' AS source "
        "FROM stations st "
        "LEFT JOIN s.zones z ON LOWER(z.zone_id) = LOWER(st.zone_id) "
        "LEFT JOIN player p ON p.id = 1 "
        "WHERE 1=1"
    ]
    if sector_id is not None:
        sql.append("AND LOWER(st.sector_id) = LOWER(:sector_id)")
        params["sector_id"] = sector_id
    sql.append("ORDER BY st.station_id LIMIT :limit OFFSET :offset")

    rows = conn.execute(" ".join(sql), params).fetchall()

    # ── resolve specific factory types from sell wares (for the category breakdown) ──
    # 85% of live stations share a generic factory_base macro; their real function is
    # only visible through the wares they sell.  A single bulk query avoids N+1.
    factory_ids = [
        r["station_id"]
        for r in rows
        if _category_from_macro(r["macro"]) == "factory"
        and (r["macro"] or "").lower().endswith("factory_base_01_macro")
    ]
    # station_id → human-readable factory type (e.g. "Weapon Components")
    factory_type: dict[str, str] = {}
    if factory_ids:
        placeholders = ",".join("?" for _ in factory_ids)
        fr = conn.execute(
            f"SELECT so.station_id, w.name FROM station_offers so "
            f"JOIN s.wares w ON w.ware_id = so.ware_id "
            f"WHERE so.side = 'sell' AND so.station_id IN ({placeholders}) "
            f"ORDER BY so.quantity DESC",
            factory_ids,
        ).fetchall()
        seen: set[str] = set()
        for station_id, ware_name in fr:
            if station_id not in seen:
                seen.add(station_id)
                factory_type[station_id] = ware_name

    single_products = _single_product_icons(conn, [r["station_id"] for r in rows])

    # ── resolve the in-game display name for stations that carry no explicit name ──
    resolved_names = bulk_resolve_station_names(conn, rows)

    out: list[MapStation] = []
    for r in rows:
        d = dict(r)
        d.pop("basename", None)
        d.pop("nameindex", None)
        category = _category_from_macro(d.get("macro"))
        if category == "factory":
            category = factory_type.get(d["station_id"], "Factory")
        resolved = resolved_names.get(d["station_id"])
        icon_group = resolved.icon_group if resolved else None
        if resolved:
            d["name"] = resolved.name
            # Many "type" stations (defence platforms, shipyards...) share one generic
            # macro indistinguishable from a factory — the basename-resolved category
            # is authoritative when present, overriding the macro-derived guess.
            if resolved.category:
                category = resolved.category
        if d["station_id"] in single_products:
            d["production_product"], d["production_product_icon_url"] = single_products[
                d["station_id"]
            ]
        out.append(MapStation(category=category, icon_group=icon_group, **d))
    return out

