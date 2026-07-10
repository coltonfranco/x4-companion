"""Tests for syncing the player's profile-level `loadouts.xml` into the dynamic DB.

This file lives outside the streamed save (a sibling of save/), so `sync()` is
exercised directly against a dynamic connection rather than through pipeline.run().
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from x4_extract.db import apply_schema, open_db
from x4_extract.dynamic import custom_loadouts

TINY_PROFILE_LOADOUTS_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<loadouts>
  <loadout id="player_1" name="Gas Miner" description="" macro="ship_par_m_miner_liquid_01_b_macro" player="1">
    <macros>
      <engine macro="engine_par_m_travel_01_mk3_macro" path="../con_engine_01"/>
      <shield macro="shield_par_m_standard_01_mk2_macro" path="../con_shield_01"/>
    </macros>
    <virtualmacros>
      <thruster macro="thruster_gen_m_allround_01_mk1_macro"/>
    </virtualmacros>
  </loadout>
</loadouts>
"""


def _dynamic_conn(data_dir: Path) -> sqlite3.Connection:
    db_path = data_dir / "dynamic" / "test_save.db"
    apply_schema(data_dir, "dynamic", db_path=db_path)
    return open_db(data_dir, dynamic_db=db_path)


def test_sync_populates_player_loadouts(data_dir: Path, tmp_path: Path) -> None:
    profile_dir = tmp_path / "profile"
    profile_dir.mkdir()
    (profile_dir / "loadouts.xml").write_bytes(TINY_PROFILE_LOADOUTS_XML)

    conn = _dynamic_conn(data_dir)
    try:
        custom_loadouts.sync(conn, profile_dir)

        loadout = conn.execute("SELECT * FROM player_loadouts").fetchone()
        assert loadout["loadout_id"] == "player_1"
        assert loadout["name"] == "Gas Miner"
        assert loadout["ship_macro"] == "ship_par_m_miner_liquid_01_b_macro"

        rows = conn.execute("SELECT kind, macro FROM player_loadout_equipment").fetchall()
        kinds = {r["kind"] for r in rows}
        assert kinds == {"engine", "shield", "thruster"}
    finally:
        conn.close()


def test_sync_is_noop_without_a_profile_file(data_dir: Path, tmp_path: Path) -> None:
    profile_dir = tmp_path / "empty_profile"
    profile_dir.mkdir()

    conn = _dynamic_conn(data_dir)
    try:
        custom_loadouts.sync(conn, profile_dir)  # no loadouts.xml present — must not raise
        assert conn.execute("SELECT COUNT(*) FROM player_loadouts").fetchone()[0] == 0
    finally:
        conn.close()


def test_sync_skips_rewrite_when_file_unchanged(data_dir: Path, tmp_path: Path) -> None:
    profile_dir = tmp_path / "profile"
    profile_dir.mkdir()
    (profile_dir / "loadouts.xml").write_bytes(TINY_PROFILE_LOADOUTS_XML)

    conn = _dynamic_conn(data_dir)
    try:
        custom_loadouts.sync(conn, profile_dir)
        # Manually blow away the rows a real rewrite would repopulate; a skipped sync
        # (stat unchanged) must leave them gone.
        conn.execute("DELETE FROM player_loadout_equipment")
        conn.execute("DELETE FROM player_loadouts")
        conn.commit()

        custom_loadouts.sync(conn, profile_dir)
        assert conn.execute("SELECT COUNT(*) FROM player_loadouts").fetchone()[0] == 0
    finally:
        conn.close()


def test_sync_rereads_when_file_changes(data_dir: Path, tmp_path: Path) -> None:
    profile_dir = tmp_path / "profile"
    profile_dir.mkdir()
    path = profile_dir / "loadouts.xml"
    path.write_bytes(TINY_PROFILE_LOADOUTS_XML)

    conn = _dynamic_conn(data_dir)
    try:
        custom_loadouts.sync(conn, profile_dir)

        updated = TINY_PROFILE_LOADOUTS_XML.replace(b'name="Gas Miner"', b'name="Renamed Miner"')
        path.write_bytes(updated)
        custom_loadouts.sync(conn, profile_dir)

        loadout = conn.execute("SELECT name FROM player_loadouts").fetchone()
        assert loadout["name"] == "Renamed Miner"
    finally:
        conn.close()
