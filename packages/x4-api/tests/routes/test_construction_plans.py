"""Integration tests for the construction-plans endpoints: game presets (static) and
the player's saved plans (synced from the profile's constructionplans.xml on activate).
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

CUSTOM_PLANS_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<plans>
  <plan id="player_1" name="My Wharf" description="">
    <entry index="1" macro="pier_ter_harbor_01_macro"/>
    <entry index="2" macro="dockarea_ter_m_station_01_hightech_macro" connection="connectionsnap003">
      <predecessor index="1" connection="connectionsnap001"/>
    </entry>
  </plan>
</plans>
"""


@pytest.fixture
def settings(data_dir: Path, fixtures_dir: Path) -> Settings:
    folder = data_dir / "saves"
    folder.mkdir()
    save = folder / "save_001.xml.gz"
    shutil.copyfile(fixtures_dir / "tiny_save.xml.gz", save)
    past = time.time() - 30
    os.utime(save, (past, past))

    (data_dir / "constructionplans.xml").write_bytes(CUSTOM_PLANS_XML)

    return Settings(install_path=Path("C:/fake/x4"), data_dir=data_dir, save_path=folder)


def test_construction_plans_combines_presets_and_custom(
    client: TestClient, static_conn: sqlite3.Connection
) -> None:
    static_conn.execute(
        "INSERT INTO construction_plans (plan_id, name, description) "
        "VALUES ('preset_wharf', 'Preset Wharf', '')"
    )
    static_conn.executemany(
        "INSERT INTO construction_plan_entries "
        "(entry_id, plan_id, entry_index, predecessor_index, macro) VALUES (?, ?, ?, ?, ?)",
        [
            ("preset_wharf#1", "preset_wharf", 1, None, "pier_ter_harbor_01_macro"),
            ("preset_wharf#2", "preset_wharf", 2, 1, "storage_ter_l_solid_01_macro"),
        ],
    )
    static_conn.commit()

    resp = client.post("/api/v1/saves/save_001/activate")
    assert resp.status_code == 200, resp.text

    plans = client.get("/api/v1/construction-plans").json()
    by_source = {p["source"]: p for p in plans}

    assert by_source["custom"]["plan_id"] == "player_1"
    assert by_source["custom"]["name"] == "My Wharf"
    assert by_source["custom"]["module_count"] == 2

    assert by_source["preset"]["plan_id"] == "preset_wharf"
    assert by_source["preset"]["module_count"] == 2


def test_construction_plan_layout_matches_station_layout_shape(
    client: TestClient,
) -> None:
    client.post("/api/v1/saves/save_001/activate")

    layout = client.get("/api/v1/construction-plans/player_1/layout").json()
    assert len(layout) == 2
    root = next(e for e in layout if e["entry_index"] == 1)
    assert root["predecessor_index"] is None
    assert root["module_id"] == "pier_ter_harbor_01_macro"
    assert root["pos_x"] is None

    child = next(e for e in layout if e["entry_index"] == 2)
    assert child["predecessor_index"] == 1


def test_construction_plan_layout_404_for_unknown_plan(client: TestClient) -> None:
    client.post("/api/v1/saves/save_001/activate")
    resp = client.get("/api/v1/construction-plans/nobody_saved_this/layout")
    assert resp.status_code == 404
