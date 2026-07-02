"""Cluster and cluster connection endpoints."""

import sqlite3
from typing import Annotated

from fastapi import Depends, Query

from x4_api.deps import get_db
from x4_api.routes.map import router
from x4_api.schemas import PublicModel

from ._common import _OWNERSHIP_CLAIM_SQL, _first_wins_by


class ClusterSummary(PublicModel):
    cluster_id: str
    macro_id: str | None = None
    name: str | None = None
    description: str | None = None
    owner_faction: str | None = None
    dlc: str | None = None
    environment: str | None = None
    sun_class: str | None = None
    population_id: str | None = None
    max_population: int | None = None
    x: float | None = None
    y: float | None = None
    z: float | None = None
    # Hex-grid layout coordinates
    qx: float | None = None
    qy: float | None = None
    qz: float | None = None
    qw: float | None = None

@router.get("/map/clusters", response_model=list[ClusterSummary])
def list_clusters(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    owner_faction: str | None = Query(None),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
) -> list[ClusterSummary]:
    # Build cluster ownership map from live stations (most-stations-wins per cluster).
    owner_rows = conn.execute(
        "SELECT sec.cluster_id, st.owner_faction, COUNT(*) AS cnt "
        "FROM stations st "
        "JOIN s.sectors sec ON LOWER(sec.sector_id) = LOWER(st.sector_id) "
        "LEFT JOIN s.station_types stype ON stype.station_id = st.macro "
        f"WHERE st.owner_faction IS NOT NULL AND {_OWNERSHIP_CLAIM_SQL} "
        "GROUP BY sec.cluster_id, st.owner_faction "
        "ORDER BY cnt DESC"
    ).fetchall()
    winners = _first_wins_by(owner_rows, "cluster_id")
    live_owner = {cid: r["owner_faction"] for cid, r in winners.items()}

    rows = conn.execute(
        "SELECT c.cluster_id, c.name AS macro_id, c.dlc, c.name_id AS name, c.description_id AS description, "
        "c.environment, c.sun_class, c.population_id, c.max_population, "
        "c.x, c.y, c.z, c.qx, c.qy, c.qz, c.qw "
        "FROM s.clusters c ORDER BY c.cluster_id LIMIT :limit OFFSET :offset",
        {"limit": limit, "offset": offset},
    ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["owner_faction"] = live_owner.get(d["cluster_id"])
        if owner_faction is not None and d.get("owner_faction") != owner_faction:
            continue
        out.append(ClusterSummary(**d))
    return out

class ClusterConnection(PublicModel):
    from_cluster_id: str
    to_cluster_id: str
    kind: str | None  # gate | highway

@router.get("/map/connections", response_model=list[ClusterConnection])
def list_cluster_connections(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> list[ClusterConnection]:
    """Return all cluster-to-cluster connections (gate and superhighway, deduplicated)."""
    rows = conn.execute("""
        SELECT DISTINCT
            CASE WHEN s1.cluster_id < s2.cluster_id THEN s1.cluster_id ELSE s2.cluster_id END AS from_cluster_id,
            CASE WHEN s1.cluster_id < s2.cluster_id THEN s2.cluster_id ELSE s1.cluster_id END AS to_cluster_id,
            'gate' AS kind
        FROM s.gates g
        JOIN s.zones z1 ON z1.zone_id = g.from_zone_id
        JOIN s.sectors s1 ON s1.sector_id = z1.sector_id
        JOIN s.zones z2 ON z2.zone_id = g.to_zone_id
        JOIN s.sectors s2 ON s2.sector_id = z2.sector_id
        WHERE s1.cluster_id != s2.cluster_id
          AND s1.cluster_id IS NOT NULL AND s2.cluster_id IS NOT NULL

        UNION

        SELECT DISTINCT
            CASE WHEN s1.cluster_id < s2.cluster_id THEN s1.cluster_id ELSE s2.cluster_id END AS from_cluster_id,
            CASE WHEN s1.cluster_id < s2.cluster_id THEN s2.cluster_id ELSE s1.cluster_id END AS to_cluster_id,
            sh.kind AS kind
        FROM s.superhighways sh
        JOIN s.zones z1 ON z1.zone_id = sh.from_zone_id
        JOIN s.sectors s1 ON s1.sector_id = z1.sector_id
        JOIN s.zones z2 ON z2.zone_id = sh.to_zone_id
        JOIN s.sectors s2 ON s2.sector_id = z2.sector_id
        WHERE s1.cluster_id != s2.cluster_id
          AND s1.cluster_id IS NOT NULL AND s2.cluster_id IS NOT NULL

        ORDER BY from_cluster_id, to_cluster_id
    """).fetchall()
    return [ClusterConnection(**dict(r)) for r in rows]

class ClusterResourceEntry(PublicModel):
    cluster_id: str
    ware: str
    yield_level: str  # low | medium | high | veryhigh (best yield present in the cluster)

@router.get("/map/cluster-resources", response_model=list[ClusterResourceEntry])
def list_cluster_resources(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> list[ClusterResourceEntry]:
    """Return best resource yield per ware per cluster, for map overlay display."""
    rows = conn.execute("""
        SELECT c.cluster_id, rr.ware,
            CASE MAX(
                CASE rr.yield WHEN 'veryhigh' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END
            )
                WHEN 4 THEN 'veryhigh'
                WHEN 3 THEN 'high'
                WHEN 2 THEN 'medium'
                ELSE 'low'
            END AS yield_level
        FROM s.region_resources rr
        JOIN s.sectors s ON s.sector_id = rr.sector_id
        JOIN s.clusters c ON c.cluster_id = s.cluster_id
        GROUP BY c.cluster_id, rr.ware
        ORDER BY c.cluster_id, rr.ware
    """).fetchall()
    return [ClusterResourceEntry(**dict(r)) for r in rows]

