"""Region endpoints."""

import sqlite3
from typing import Annotated

from fastapi import Depends, Query

from x4_api.deps import get_db
from x4_api.routes.map import router
from x4_api.schemas import PublicModel


class RegionSummary(PublicModel):
    region_id: str
    cluster_id: str | None = None
    sector_id: str | None = None
    x: float | None = None
    y: float | None = None
    z: float | None = None

@router.get("/map/regions", response_model=list[RegionSummary])
def list_regions(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    cluster_id: str | None = Query(None),
    sector_id: str | None = Query(None),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
) -> list[RegionSummary]:
    sql = ["SELECT region_id, cluster_id, sector_id, x, y, z FROM s.regions WHERE 1=1"]
    params: dict[str, object] = {"limit": limit, "offset": offset}
    if cluster_id is not None:
        sql.append("AND cluster_id = :cluster_id")
        params["cluster_id"] = cluster_id
    if sector_id is not None:
        sql.append("AND sector_id = :sector_id")
        params["sector_id"] = sector_id
    sql.append("ORDER BY region_id LIMIT :limit OFFSET :offset")

    rows = conn.execute(" ".join(sql), params).fetchall()
    return [RegionSummary(**dict(r)) for r in rows]

