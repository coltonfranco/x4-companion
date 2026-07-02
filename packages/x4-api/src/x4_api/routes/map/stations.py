"""Map station endpoints."""

import sqlite3
from typing import Annotated

from fastapi import Depends, Query

from x4_api.deps import get_db
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
    """
    params: dict[str, object] = {"limit": limit, "offset": offset}
    sql = [
        "SELECT st.station_id, st.name, st.code, st.macro, st.owner_faction, "
        "st.sector_id, st.zone_id, "
        "(COALESCE(z.x, 0) + COALESCE(st.x, 0)) AS x, "
        "(COALESCE(z.y, 0) + COALESCE(st.y, 0)) AS y, "
        "(COALESCE(z.z, 0) + COALESCE(st.z, 0)) AS z, "
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
    out: list[MapStation] = []
    # ── resolve specific factory types from sell wares ──
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

    for r in rows:
        d = dict(r)
        category = _category_from_macro(d.get("macro"))
        if category == "factory":
            category = factory_type.get(d["station_id"], "Factory")
        out.append(MapStation(category=category, **d))
    return out

