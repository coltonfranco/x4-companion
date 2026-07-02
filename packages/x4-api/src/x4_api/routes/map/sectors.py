"""Sector and sector connection endpoints."""

import sqlite3
from typing import Annotated

from fastapi import Depends, HTTPException, Query

from x4_api.deps import get_db
from x4_api.routes._db import table_exists
from x4_api.routes.map import router
from x4_api.schemas import PublicModel

from ._common import _OWNERSHIP_CLAIM_SQL, _first_wins_by


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
    # Build sector ownership map from live stations (most-stations-wins per sector).
    owner_rows = conn.execute(
        "SELECT LOWER(st.sector_id) AS sector_id, st.owner_faction, COUNT(*) AS cnt "
        "FROM stations st "
        "LEFT JOIN s.station_types stype ON stype.station_id = st.macro "
        "WHERE st.owner_faction IS NOT NULL AND st.sector_id IS NOT NULL "
        f"  AND {_OWNERSHIP_CLAIM_SQL} "
        "GROUP BY LOWER(st.sector_id), st.owner_faction "
        "ORDER BY cnt DESC"
    ).fetchall()
    winners = _first_wins_by(owner_rows, "sector_id")
    live_owner = {sid: r["owner_faction"] for sid, r in winners.items()}

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
    owner_row = conn.execute(
        "SELECT st.owner_faction, COUNT(*) AS cnt FROM stations st "
        "LEFT JOIN s.station_types stype ON stype.station_id = st.macro "
        "WHERE LOWER(st.sector_id) = LOWER(:sid) AND st.owner_faction IS NOT NULL "
        f"  AND {_OWNERSHIP_CLAIM_SQL} "
        "GROUP BY st.owner_faction ORDER BY cnt DESC LIMIT 1",
        {"sid": sector_id},
    ).fetchone()
    d["owner_faction"] = owner_row["owner_faction"] if owner_row else None
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

