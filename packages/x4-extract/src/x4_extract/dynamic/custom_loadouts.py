"""Sync the player's saved equipment loadouts from the profile's `loadouts.xml`.

Unlike every other dynamic table, this data isn't in the streamed save file. X4 writes
named "Save Loadout" presets (Equipment menu) to `loadouts.xml`, a sibling of the save/
folder the pipeline streams — not inside the save, and not in the game archives. It
changes only when the player explicitly saves a loadout in-game, and applies to every
save under that profile, so it's synced independently of the save's own stat/fingerprint
gate: a plain stat() comparison against the last-synced (mtime, size), stored under a
dedicated key in the same `ingest_state` table the save pipeline already uses.

Reuses `static.extractors.loadouts.extract()` — the on-disk schema is identical to the
game's own `libraries/loadouts.xml` (see that module's docstring).
"""

from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from x4_extract.static.extractors.loadouts import extract

_FILENAME = "loadouts.xml"
_STATE_TIER = "player_loadouts_stat"


def sync(conn: sqlite3.Connection, profile_dir: Path) -> None:
    """Re-read `profile_dir/loadouts.xml` into player_loadouts(+equipment) if it changed.

    No-op when the file doesn't exist (fresh profile, no saved loadouts yet) or its
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
        conn.execute("DELETE FROM player_loadout_equipment")
        conn.execute("DELETE FROM player_loadouts")
        if result.loadouts:
            conn.executemany(
                "INSERT INTO player_loadouts (loadout_id, ship_macro, name, description) "
                "VALUES (:loadout_id, :ship_macro, :name, :description)",
                result.loadouts,
            )
        if result.equipment:
            conn.executemany(
                "INSERT INTO player_loadout_equipment "
                "(loadout_id, slot_path, macro, kind, optional, quantity, weaponmode, ammunition) "
                "VALUES (:loadout_id, :slot_path, :macro, :kind, :optional, :quantity, :weaponmode, "
                ":ammunition)",
                result.equipment,
            )
        conn.execute(
            "INSERT OR REPLACE INTO ingest_state (tier, fingerprint, ingested_at) VALUES (?, ?, ?)",
            (_STATE_TIER, token, datetime.now(UTC).isoformat()),
        )
