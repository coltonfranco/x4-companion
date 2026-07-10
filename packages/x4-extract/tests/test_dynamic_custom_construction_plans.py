"""Tests for syncing the player's profile-level `constructionplans.xml` into the
dynamic DB. Mirrors test_dynamic_custom_loadouts.py — this file also lives outside
the streamed save, so `sync()` is exercised directly against a dynamic connection.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from x4_extract.db import apply_schema, open_db
from x4_extract.dynamic import custom_construction_plans

TINY_PROFILE_PLANS_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<plans>
  <plan id="player_1" name="My Defense Station" description="">
    <entry index="1" macro="defence_ter_claim_01_macro">
      <offset><position x="0" y="0" z="0"/></offset>
    </entry>
    <entry index="2" macro="defence_ter_tube_01_macro" connection="connectionsnap002">
      <predecessor index="1" connection="connectionsnap001"/>
      <offset><position x="0" y="-800" z="548"/></offset>
    </entry>
  </plan>
</plans>
"""


def _dynamic_conn(data_dir: Path) -> sqlite3.Connection:
    db_path = data_dir / "dynamic" / "test_save.db"
    apply_schema(data_dir, "dynamic", db_path=db_path)
    return open_db(data_dir, dynamic_db=db_path)


def test_sync_populates_player_construction_plans(data_dir: Path, tmp_path: Path) -> None:
    profile_dir = tmp_path / "profile"
    profile_dir.mkdir()
    (profile_dir / "constructionplans.xml").write_bytes(TINY_PROFILE_PLANS_XML)

    conn = _dynamic_conn(data_dir)
    try:
        custom_construction_plans.sync(conn, profile_dir)

        plan = conn.execute("SELECT * FROM player_construction_plans").fetchone()
        assert plan["plan_id"] == "player_1"
        assert plan["name"] == "My Defense Station"

        entries = conn.execute(
            "SELECT entry_index, predecessor_index, macro FROM player_construction_plan_entries "
            "ORDER BY entry_index"
        ).fetchall()
        assert [dict(e) for e in entries] == [
            {"entry_index": 1, "predecessor_index": None, "macro": "defence_ter_claim_01_macro"},
            {"entry_index": 2, "predecessor_index": 1, "macro": "defence_ter_tube_01_macro"},
        ]
    finally:
        conn.close()


def test_sync_is_noop_without_a_profile_file(data_dir: Path, tmp_path: Path) -> None:
    profile_dir = tmp_path / "empty_profile"
    profile_dir.mkdir()

    conn = _dynamic_conn(data_dir)
    try:
        custom_construction_plans.sync(conn, profile_dir)  # no file present — must not raise
        assert conn.execute("SELECT COUNT(*) FROM player_construction_plans").fetchone()[0] == 0
    finally:
        conn.close()


def test_sync_skips_rewrite_when_file_unchanged(data_dir: Path, tmp_path: Path) -> None:
    profile_dir = tmp_path / "profile"
    profile_dir.mkdir()
    (profile_dir / "constructionplans.xml").write_bytes(TINY_PROFILE_PLANS_XML)

    conn = _dynamic_conn(data_dir)
    try:
        custom_construction_plans.sync(conn, profile_dir)
        conn.execute("DELETE FROM player_construction_plan_entries")
        conn.execute("DELETE FROM player_construction_plans")
        conn.commit()

        custom_construction_plans.sync(conn, profile_dir)
        assert conn.execute("SELECT COUNT(*) FROM player_construction_plans").fetchone()[0] == 0
    finally:
        conn.close()


def test_sync_rereads_when_file_changes(data_dir: Path, tmp_path: Path) -> None:
    profile_dir = tmp_path / "profile"
    profile_dir.mkdir()
    path = profile_dir / "constructionplans.xml"
    path.write_bytes(TINY_PROFILE_PLANS_XML)

    conn = _dynamic_conn(data_dir)
    try:
        custom_construction_plans.sync(conn, profile_dir)

        updated = TINY_PROFILE_PLANS_XML.replace(
            b'name="My Defense Station"', b'name="Renamed Station"'
        )
        path.write_bytes(updated)
        custom_construction_plans.sync(conn, profile_dir)

        plan = conn.execute("SELECT name FROM player_construction_plans").fetchone()
        assert plan["name"] == "Renamed Station"
    finally:
        conn.close()
