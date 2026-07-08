"""Sector and sector connection endpoints."""

import sqlite3
from typing import Annotated

from fastapi import Depends, HTTPException, Query

from x4_api.deps import get_db
from x4_api.routes._db import table_exists
from x4_api.routes.map import router
from x4_api.schemas import PublicModel


class SectorSummary(PublicModel):
    sector_id: str
    cluster_id: str | None
    macro_id: str | None = None
    name: str | None = None
    description: str | None = None
    owner_faction: str | None
    dlc: str | None = None
    sunlight: float | None = None
    economy: float | None = None
    security: float | None = None
    tags: str | None = None
    access_licence: str | None = None
    x: float | None = None
    y: float | None = None
    z: float | None = None
    # Hex-grid layout coordinates
    qx: float | None = None
    qy: float | None = None
    qz: float | None = None
    qw: float | None = None
    known_to_player: bool = False

def _resolve_sector_owners(conn: sqlite3.Connection) -> dict[str, str]:
    """Return {lowercase_sector_id: owner_faction} from the game's own sector ownership
    records. Sectors with no recorded owner remain unowned (not in the map)."""
    if not table_exists(conn, "sector_state"):
        return {}
    rows = conn.execute(
        "SELECT LOWER(sector_id) AS sid, owner_faction "
        "FROM sector_state WHERE owner_faction IS NOT NULL"
    ).fetchall()
    return {r["sid"]: r["owner_faction"] for r in rows}


def _sector_summary_sql(conn: sqlite3.Connection) -> tuple[str, str]:
    """Return (columns_sql, join_live_sql) for the sec.* sector summary column list.

    Feature-detects `sector_state` (added by live-save ingest) so callers automatically
    fall back to a static `0 AS known_to_player` when no save has been ingested yet.
    """
    has_sector_state = table_exists(conn, "sector_state")
    select_known = (
        "COALESCE(ss.known_to_player, 0) AS known_to_player"
        if has_sector_state
        else "0 AS known_to_player"
    )
    join_live = (
        "LEFT JOIN sector_state ss ON ss.sector_id = LOWER(sec.sector_id) "
        if has_sector_state
        else ""
    )
    columns = (
        "sec.sector_id, sec.cluster_id, sec.name AS macro_id, sec.dlc, "
        "sec.name_id AS name, sec.description_id AS description, sec.sunlight, sec.economy, sec.security, "
        "sec.tags, sec.access_licence, sec.x, sec.y, sec.z, sec.qx, sec.qy, sec.qz, sec.qw, "
        f"{select_known}"
    )
    return columns, join_live

@router.get("/map/sectors", response_model=list[SectorSummary])
def list_sectors(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    cluster_id: str | None = Query(None),
    owner_faction: str | None = Query(None),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
) -> list[SectorSummary]:
    # Prefer game-authoritative sector ownership from the save (sector_state.owner_faction).
    # Fall back to station-counting heuristic when no save data exists.
    live_owner = _resolve_sector_owners(conn)

    columns, join_live = _sector_summary_sql(conn)

    sql = f"SELECT {columns} FROM s.sectors sec {join_live}WHERE 1=1"

    params: dict[str, object] = {"limit": limit, "offset": offset}
    if cluster_id is not None:
        sql += " AND sec.cluster_id = :cluster_id"
        params["cluster_id"] = cluster_id
    sql += " ORDER BY sec.sector_id LIMIT :limit OFFSET :offset"

    rows = conn.execute(sql, params).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["owner_faction"] = live_owner.get(d["sector_id"].lower())
        if owner_faction is not None and d.get("owner_faction") != owner_faction:
            continue
        out.append(SectorSummary(**d))
    return out

@router.get("/map/sectors/{sector_id}", response_model=SectorSummary)
def get_sector(
    sector_id: str,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> SectorSummary:
    columns, join_live = _sector_summary_sql(conn)

    row = conn.execute(
        f"SELECT {columns} FROM s.sectors sec {join_live}WHERE sec.sector_id = :id",
        {"id": sector_id},
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=f"Unknown sector_id: {sector_id}")
    d = dict(row)
    ss_row = conn.execute(
        "SELECT owner_faction FROM sector_state WHERE LOWER(sector_id) = LOWER(:sid) AND owner_faction IS NOT NULL",
        {"sid": sector_id},
    ).fetchone()
    d["owner_faction"] = ss_row["owner_faction"] if ss_row else None
    return SectorSummary(**d)

class SectorConnection(PublicModel):
    from_sector_id: str
    to_sector_id: str
    kind: str | None  # gate | highway

@router.get("/map/sector-connections", response_model=list[SectorConnection])
def list_sector_connections(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> list[SectorConnection]:
    """Return all sector-to-sector connections (gate and superhighway, deduplicated)."""
    rows = conn.execute("""
        SELECT DISTINCT
            CASE WHEN z1.sector_id < z2.sector_id THEN z1.sector_id ELSE z2.sector_id END AS from_sector_id,
            CASE WHEN z1.sector_id < z2.sector_id THEN z2.sector_id ELSE z1.sector_id END AS to_sector_id,
            'gate' AS kind
        FROM s.gates g
        JOIN s.zones z1 ON z1.zone_id = g.from_zone_id
        JOIN s.zones z2 ON z2.zone_id = g.to_zone_id
        WHERE z1.sector_id != z2.sector_id
          AND z1.sector_id IS NOT NULL AND z2.sector_id IS NOT NULL

        UNION

        SELECT DISTINCT
            CASE WHEN z1.sector_id < z2.sector_id THEN z1.sector_id ELSE z2.sector_id END AS from_sector_id,
            CASE WHEN z1.sector_id < z2.sector_id THEN z2.sector_id ELSE z1.sector_id END AS to_sector_id,
            sh.kind AS kind
        FROM s.superhighways sh
        JOIN s.zones z1 ON z1.zone_id = sh.from_zone_id
        JOIN s.zones z2 ON z2.zone_id = sh.to_zone_id
        WHERE z1.sector_id != z2.sector_id
          AND z1.sector_id IS NOT NULL AND z2.sector_id IS NOT NULL

        ORDER BY from_sector_id, to_sector_id
    """).fetchall()
    return [SectorConnection(**dict(r)) for r in rows]

