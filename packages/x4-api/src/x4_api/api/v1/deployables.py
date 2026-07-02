"""REST endpoint for deployables (satellites, resource probes, nav beacons, mines)."""

import sqlite3
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from x4_api.api.db_utils import build_where_clause, paginate, table_exists
from x4_api.api.deps import get_db
from x4_api.api.schemas import PublicModel

router = APIRouter()


class DeployableEntry(PublicModel):
    id: str
    class_: str
    code: str | None
    macro: str | None
    owner_faction: str | None
    sector_id: str | None
    zone_id: str | None
    known_to_player: int
    extra_json: str | None


@router.get("/deployables", response_model=list[DeployableEntry])
def list_deployables(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    class_: Annotated[
        str | None,
        Query(alias="class", description="Filter by class (satellite, resourceprobe, etc.)"),
    ] = None,
    owner: Annotated[str | None, Query(description="Filter by owner faction")] = None,
    limit: Annotated[int, Query(ge=1, le=5000)] = 500,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[DeployableEntry]:
    if not table_exists(conn, "deployables"):
        return []

    conditions: list[tuple[str, Any]] = []
    if class_:
        conditions.append(("class = ?", class_))
    if owner:
        conditions.append(("owner_faction = ?", owner))
    where_clause, where_params = build_where_clause(conditions)

    sql = f"""
        SELECT id, class, code, macro, owner_faction, sector_id, zone_id,
               known_to_player, extra_json
        FROM deployables
        {where_clause}
        ORDER BY class, owner_faction
    """
    sql, params = paginate(sql, where_params, limit, offset)

    rows = conn.execute(sql, params).fetchall()
    return [DeployableEntry(**dict(r)) for r in rows]
