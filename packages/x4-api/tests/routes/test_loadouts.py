"""Integration tests for the ship loadout-options endpoint: game presets (static) and
the player's saved custom loadouts (synced from the profile's loadouts.xml on activate).
"""

from __future__ import annotations

import os
import shutil
import sqlite3
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from x4_api.config import Settings

SHIP_MACRO = "ship_test_loadout_macro"  # also the ship_id path param — ships never strip "_macro"

CUSTOM_LOADOUTS_XML = f"""<?xml version="1.0" encoding="UTF-8"?>
<loadouts>
  <loadout id="player_1" name="My Fit" description="" macro="{SHIP_MACRO}" player="1">
    <macros>
      <engine macro="engine_gen_s_combat_01_mk1_macro" path="../con_engine_01"/>
    </macros>
  </loadout>
</loadouts>
""".encode()


@pytest.fixture
def settings(data_dir: Path, fixtures_dir: Path) -> Settings:
    folder = data_dir / "saves"
    folder.mkdir()
    save = folder / "save_001.xml.gz"
    shutil.copyfile(fixtures_dir / "tiny_save.xml.gz", save)
    past = time.time() - 30
    os.utime(save, (past, past))

    (data_dir / "loadouts.xml").write_bytes(CUSTOM_LOADOUTS_XML)

    return Settings(install_path=Path("C:/fake/x4"), data_dir=data_dir, save_path=folder)


def test_loadout_options_combines_presets_and_custom(
    client: TestClient, static_conn: sqlite3.Connection
) -> None:
    static_conn.execute(
        "INSERT INTO loadouts (loadout_id, ship_macro, name, description) "
        f"VALUES ('preset_basic', '{SHIP_MACRO}', 'Basic', '')"
    )
    static_conn.execute(
        "INSERT INTO loadout_equipment (loadout_id, slot_path, macro, kind, optional, quantity) "
        "VALUES ('preset_basic', '../con_shield_01', 'shield_gen_s_standard_01_mk1_macro', "
        "'shield', 0, NULL)"
    )
    static_conn.commit()

    resp = client.post("/api/v1/saves/save_001/activate")
    assert resp.status_code == 200, resp.text

    options = client.get(f"/api/v1/ships/{SHIP_MACRO}/loadout-options").json()
    by_source = {o["source"]: o for o in options}

    assert by_source["custom"]["loadout_id"] == "player_1"
    assert by_source["custom"]["name"] == "My Fit"
    assert by_source["custom"]["items"] == [
        {"kind": "engine", "ware_id": "engine_gen_s_combat_01_mk1", "quantity": 1}
    ]

    assert by_source["preset"]["loadout_id"] == "preset_basic"
    assert by_source["preset"]["items"] == [
        {"kind": "shield", "ware_id": "shield_gen_s_standard_01_mk1", "quantity": 1}
    ]


def test_loadout_options_empty_for_unknown_ship(client: TestClient) -> None:
    client.post("/api/v1/saves/save_001/activate")
    assert client.get("/api/v1/ships/ship_nobody_owns/loadout-options").json() == []
