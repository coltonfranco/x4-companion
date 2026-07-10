"""Sync the player's saved station construction plans from the profile's
`constructionplans.xml`.

Unlike every other dynamic table, this data isn't in the streamed save file. X4 writes
named "Save Construction Plan" designs to `constructionplans.xml`, a sibling of the
save/ folder the pipeline streams — not inside the save, and not in the game archives
(the exact same location convention as the player's saved equipment loadouts — see
`custom_loadouts.py`, whose docstring this mirrors). It changes only when the player
explicitly saves a plan in-game, and applies to every save under that profile, so it's
synced independently of the save's own stat/fingerprint gate: a plain stat() comparison
against the last-synced (mtime, size), stored under a dedicated key in the same
`ingest_state` table the save pipeline already uses.

Reuses `static.extractors.construction_plans.extract()` — the on-disk schema is
identical to the game's own `libraries/constructionplans.xml`.
"""

from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from x4_extract.static.extractors.construction_plans import extract

_FILENAME = "constructionplans.xml"
_STATE_TIER = "player_construction_plans_stat"


def sync(conn: sqlite3.Connection, profile_dir: Path) -> None:
    """Re-read `profile_dir/constructionplans.xml` into player_construction_plans(+entries)
    if it changed.

    No-op when the file doesn't exist (fresh profile, no saved plans yet) or its
    (mtime, size) matches the last sync.
    """
    path = profile_dir / _FILENAME
    if not path.exists():
        return

    st = path.stat()
    token = f"{st.st_mtime_ns}:{st.st_size}"
    row = conn.execute(
        "SELECT fingerprint FROM ingest_state WHERE tier = ?", (_STATE_TIER,)
    ).fetchone()
    if row is not None and row[0] == token:
        return

    result = extract(path.read_bytes())
    with conn:
        conn.execute("DELETE FROM player_construction_plan_entries")
        conn.execute("DELETE FROM player_construction_plans")
        if result.plans:
            conn.executemany(
                "INSERT INTO player_construction_plans (plan_id, name, description) "
                "VALUES (:plan_id, :name, :description)",
                result.plans,
            )
        if result.entries:
            conn.executemany(
                "INSERT INTO player_construction_plan_entries "
                "(entry_id, plan_id, entry_index, predecessor_index, macro) "
                "VALUES (:entry_id, :plan_id, :entry_index, :predecessor_index, :macro)",
                result.entries,
            )
        conn.execute(
            "INSERT OR REPLACE INTO ingest_state (tier, fingerprint, ingested_at) VALUES (?, ?, ?)",
            (_STATE_TIER, token, datetime.now(UTC).isoformat()),
        )
