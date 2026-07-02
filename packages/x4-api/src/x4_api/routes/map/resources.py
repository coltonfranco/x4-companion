"""Resource endpoints (static + live)."""

import sqlite3
from typing import Annotated

from fastapi import Depends, HTTPException, Query

from x4_api.deps import get_db
from x4_api.routes._db import table_exists
from x4_api.routes.map import router
from x4_api.schemas import PublicModel


class ResourceEntry(PublicModel):
    region_name: str
    sector_id: str | None
    ware: str
    yield_level: str

class LiveResourceEntry(PublicModel):
    sector_id: str
    ware: str
    current: int | None
    max: int | None
    yield_tier: str | None

@router.get("/map/resources", response_model=list[ResourceEntry])
def list_resources(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    ware: str | None = Query(
        None, description="Filter by ware (ore, silicon, nividium, hydrogen, helium, methane, ice)"
    ),
    sector_id: str | None = Query(None, description="Filter by sector macro ID"),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
) -> list[ResourceEntry]:
    """List resource region entries. Filter by ware to find where a resource spawns."""
    sql = [
        "SELECT region_name, sector_id, ware, yield AS yield_level",
        "FROM s.region_resources WHERE 1=1",
    ]
    params: dict[str, object] = {"limit": limit, "offset": offset}
    if ware is not None:
        sql.append("AND ware = :ware")
        params["ware"] = ware
    if sector_id is not None:
        sql.append("AND sector_id = :sector_id")
        params["sector_id"] = sector_id
    sql.append("ORDER BY region_name, ware LIMIT :limit OFFSET :offset")

    rows = conn.execute(" ".join(sql), params).fetchall()
    return [ResourceEntry(**dict(r)) for r in rows]

@router.get("/map/sectors/{sector_id}/resources", response_model=list[ResourceEntry])
def get_sector_resources(
    sector_id: str,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> list[ResourceEntry]:
    """List all resources available in a specific sector."""
    row = conn.execute(
        "SELECT 1 FROM s.sectors WHERE sector_id = :id", {"id": sector_id}
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=f"Unknown sector_id: {sector_id}")
    rows = conn.execute(
        "SELECT region_name, sector_id, ware, yield AS yield_level "
        "FROM s.region_resources WHERE sector_id = :id ORDER BY ware",
        {"id": sector_id},
    ).fetchall()
    return [ResourceEntry(**dict(r)) for r in rows]

@router.get("/map/resources/live", response_model=list[LiveResourceEntry])
def list_live_resources(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    ware: str | None = Query(None, description="Filter by ware (ore, silicon, ...)"),
    sector_id: str | None = Query(None, description="Filter by sector macro id"),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
) -> list[LiveResourceEntry]:
    """Live, depleting mineable resources per sector, from the active save.

    Returns [] until a save with resource data is ingested (the dashboard's mining
    heatmap falls back to the static /map/resources in that case).
    """
    if not table_exists(conn, "sector_resources"):  # dynamic DB predates the schema
        return []
    sql = ["SELECT sector_id, ware, current, max, yield_tier FROM sector_resources WHERE 1=1"]
    params: dict[str, object] = {"limit": limit, "offset": offset}
    if ware is not None:
        sql.append("AND ware = :ware")
        params["ware"] = ware
    if sector_id is not None:
        sql.append("AND sector_id = :sector_id")
        params["sector_id"] = sector_id
    sql.append("ORDER BY sector_id, ware LIMIT :limit OFFSET :offset")
    rows = conn.execute(" ".join(sql), params).fetchall()
    return [LiveResourceEntry(**dict(r)) for r in rows]

