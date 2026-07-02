"""Shared helpers for map sub-modules."""

import sqlite3

from x4_api.routes._factions import disambiguate

_OWNERSHIP_CLAIM_SQL = (
    "( "
    "    stype.ownership_claim = 1 "
    "    OR EXISTS ( "
    "        SELECT 1 FROM station_modules sm "
    "        JOIN s.modules m ON m.module_id = sm.module_id "
    "        WHERE sm.station_id = st.station_id AND m.ownership_claim = 1 "
    "    ) "
    ")"
)



def _first_wins_by(rows: list[sqlite3.Row], key_col: str) -> dict[str, sqlite3.Row]:
    """Reduce cnt-DESC-ordered *rows* to the first (highest-count) row per key_col."""
    result: dict[str, sqlite3.Row] = {}
    for r in rows:
        key = r[key_col]
        if key not in result:
            result[key] = r
    return result



def _faction_name_map(conn: sqlite3.Connection) -> dict[str, str]:
    """Return {faction_id: disambiguated_name} for every non-legacy faction."""
    rows = conn.execute("SELECT faction_id, name FROM s.factions WHERE is_legacy = 0").fetchall()
    return {r["faction_id"]: r["name"] for r in disambiguate([dict(r) for r in rows])}



def _live_sector_owners(conn: sqlite3.Connection) -> dict[str, tuple[str | None, str | None]]:
    """Return {lowercase_sector_id: (owner_faction, owner_name)} from live stations.

    Most-stations-wins per sector. Used to replace seed.sector_ownership lookups
    when a live save is loaded.
    """
    rows = conn.execute(
        "SELECT LOWER(st.sector_id) AS sid, st.owner_faction, f.name AS owner_name, COUNT(*) AS cnt "
        "FROM stations st "
        "LEFT JOIN s.factions f ON f.faction_id = st.owner_faction "
        "LEFT JOIN s.station_types stype ON stype.station_id = st.macro "
        "WHERE st.owner_faction IS NOT NULL AND st.sector_id IS NOT NULL "
        f"  AND {_OWNERSHIP_CLAIM_SQL} "
        "GROUP BY LOWER(st.sector_id), st.owner_faction "
        "ORDER BY cnt DESC"
    ).fetchall()
    winners = _first_wins_by(rows, "sid")
    return {sid: (r["owner_faction"], r["owner_name"]) for sid, r in winners.items()}


