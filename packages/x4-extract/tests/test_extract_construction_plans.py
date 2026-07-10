"""Tests for the `libraries/constructionplans.xml` extractor.

Pattern: hand-crafted tiny XML → assert on `extract()`, then verify `write()`
round-trips through SQLite. See test_extract_wares.py for the exemplar.
"""

from __future__ import annotations

import sqlite3

from x4_extract.static.extractors import construction_plans

TINY_PLANS_XML = b"""<?xml version="1.0" encoding="utf-8"?>
<plans>
  <plan id="test_wharf" name="Test Wharf" description="A small wharf">
    <entry index="1" macro="pier_ter_harbor_01_macro">
      <offset>
        <position x="1" y="2" z="3"/>
      </offset>
    </entry>
    <entry index="2" macro="dockarea_ter_m_station_01_hightech_macro" connection="connectionsnap003">
      <predecessor index="1" connection="connectionsnap001"/>
      <offset>
        <position x="4" y="5" z="6"/>
      </offset>
    </entry>
    <entry index="3" macro="storage_ter_l_solid_01_macro" connection="connectionsnap01">
      <predecessor index="2" connection="connectionsnap010"/>
    </entry>
  </plan>
  <plan id="test_empty_entry" name="No Macro Skipped">
    <entry index="1"/>
  </plan>
</plans>
"""


def test_extract_pulls_plan_identity() -> None:
    result = construction_plans.extract(TINY_PLANS_XML)

    plan_ids = {p["plan_id"] for p in result.plans}
    assert plan_ids == {"test_wharf", "test_empty_entry"}
    wharf = next(p for p in result.plans if p["plan_id"] == "test_wharf")
    assert wharf["name"] == "Test Wharf"
    assert wharf["description"] == "A small wharf"


def test_extract_builds_entry_graph_with_predecessor_links() -> None:
    result = construction_plans.extract(TINY_PLANS_XML)
    entries = [e for e in result.entries if e["plan_id"] == "test_wharf"]

    assert len(entries) == 3
    root = next(e for e in entries if e["entry_index"] == 1)
    assert root["predecessor_index"] is None
    assert root["macro"] == "pier_ter_harbor_01_macro"
    assert root["entry_id"] == "test_wharf#1"

    child = next(e for e in entries if e["entry_index"] == 2)
    assert child["predecessor_index"] == 1

    grandchild = next(e for e in entries if e["entry_index"] == 3)
    assert grandchild["predecessor_index"] == 2


def test_extract_skips_entries_without_a_macro() -> None:
    result = construction_plans.extract(TINY_PLANS_XML)
    assert not [e for e in result.entries if e["plan_id"] == "test_empty_entry"]


def test_write_round_trips_through_sqlite(static_conn: sqlite3.Connection) -> None:
    result = construction_plans.extract(TINY_PLANS_XML)
    construction_plans.write(static_conn, result)
    static_conn.commit()

    plan_count = static_conn.execute("SELECT COUNT(*) FROM construction_plans").fetchone()[0]
    entry_count = static_conn.execute(
        "SELECT COUNT(*) FROM construction_plan_entries"
    ).fetchone()[0]
    assert plan_count == 2
    assert entry_count == 3

    row = static_conn.execute(
        "SELECT predecessor_index FROM construction_plan_entries WHERE entry_id = 'test_wharf#2'"
    ).fetchone()
    assert row["predecessor_index"] == 1
