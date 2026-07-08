"""Shared helpers for map sub-modules."""

import sqlite3

from x4_api.routes._factions import disambiguate



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


