"""Gate and superhighway endpoints."""

import sqlite3
from typing import Annotated

from fastapi import Depends, Query

from x4_api.deps import get_db
from x4_api.routes.map import router
from x4_api.schemas import PublicModel


class GateSummary(PublicModel):
    from_zone_id: str
    to_zone_id: str
    kind: str | None

@router.get("/map/gates", response_model=list[GateSummary])
def list_gates(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    limit: int = Query(500, ge=1, le=10000),
    offset: int = Query(0, ge=0),
) -> list[GateSummary]:
    rows = conn.execute(
        "SELECT from_zone_id, to_zone_id, kind FROM s.gates ORDER BY from_zone_id, to_zone_id LIMIT :limit OFFSET :offset",
        {"limit": limit, "offset": offset},
    ).fetchall()
    return [GateSummary(**dict(r)) for r in rows]

class SuperhighwaySummary(PublicModel):
    from_zone_id: str
    to_zone_id: str
    kind: str

@router.get("/map/superhighways", response_model=list[SuperhighwaySummary])
def list_superhighways(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    limit: int = Query(500, ge=1, le=10000),
    offset: int = Query(0, ge=0),
) -> list[SuperhighwaySummary]:
    rows = conn.execute(
        "SELECT from_zone_id, to_zone_id, kind FROM s.superhighways ORDER BY from_zone_id, to_zone_id LIMIT :limit OFFSET :offset",
        {"limit": limit, "offset": offset},
    ).fetchall()
    return [SuperhighwaySummary(**dict(r)) for r in rows]

