"""Equipment mod endpoints."""

from __future__ import annotations

import sqlite3
from typing import Annotated, Any

from fastapi import Depends, Query

from x4_api.api.catalog_router import simple_catalog_router
from x4_api.api.db_utils import build_where_clause, paginate
from x4_api.api.deps import get_db
from x4_api.api.schemas import PublicModel


class EquipModSummary(PublicModel):
    ware_id: str
    name: str | None
    shortname: str | None
    category: str | None
    stat: str | None
    quality: int | None
    min_factor: float | None
    max_factor: float | None
    price_avg: int | None


class EquipModDetail(EquipModSummary):
    description: str | None
    price_min: int | None
    price_max: int | None
    production_time: float | None


_LIST_COLS = "ware_id, name, shortname, category, stat, quality, min_factor, max_factor, price_avg"
_DETAIL_COLS = (
    "ware_id, name, shortname, description, category, stat, quality, "
    "min_factor, max_factor, price_min, price_avg, price_max, production_time"
)

# The list endpoint takes optional filters, so it can't come from the factory's
# generic (unfiltered) list route — only the flat get-by-id route is shared.
router = simple_catalog_router(
    path_prefix="/equipment-mods",
    table="s.equip_mods",
    list_columns=_LIST_COLS,
    list_model=EquipModSummary,
    detail_columns=_DETAIL_COLS,
    detail_model=EquipModDetail,
    list_order_by="category, stat, quality, ware_id",
    id_col="ware_id",
    id_param_name="ware_id",
    include_list=False,
)


@router.get("/equipment-mods", response_model=list[EquipModSummary])
def list_equip_mods(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    category: str | None = Query(
        None, description="Filter by category: weapon, engine, shield, ship"
    ),
    stat: str | None = Query(None, description="Filter by stat type e.g. damage, cooling"),
    quality: int | None = Query(None, description="Filter by quality tier 1-3"),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
) -> list[EquipModSummary]:
    conditions: list[tuple[str, Any]] = []
    if category is not None:
        conditions.append(("category = ?", category))
    if stat is not None:
        conditions.append(("stat = ?", stat))
    if quality is not None:
        conditions.append(("quality = ?", quality))
    where_clause, where_params = build_where_clause(conditions)

    sql = f"SELECT {_LIST_COLS} FROM s.equip_mods"
    if where_clause:
        sql += f" {where_clause}"
    sql += " ORDER BY category, stat, quality, ware_id"
    sql, params = paginate(sql, where_params, limit, offset)

    rows = conn.execute(sql, params).fetchall()
    return [EquipModSummary(**dict(r)) for r in rows]
