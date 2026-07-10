"""Tests for the `libraries/loadouts.xml` extractor.

Pattern: hand-crafted tiny XML → assert on `extract()`, then verify `write()`
round-trips through SQLite. See test_extract_wares.py for the exemplar.
"""

from __future__ import annotations

import sqlite3

from x4_extract.static.extractors import loadouts

TINY_LOADOUTS_XML = b"""<?xml version="1.0" encoding="utf-8"?>
<loadouts>
  <loadout id="test_basic" name="Basic" description="" macro="ship_gen_s_fighter_01_a_macro">
    <macros>
      <engine macro="engine_gen_s_combat_01_mk1_macro" path="../con_engine_01"/>
      <weapon macro="weapon_gen_s_laser_01_mk1_macro" path="../con_weapon_01"/>
      <shield macro="shield_gen_s_standard_01_mk1_macro" path="../con_shield_01" optional="1"/>
    </macros>
    <software>
      <software ware="software_flightassistmk1"/>
    </software>
    <virtualmacros>
      <thruster macro="thruster_gen_s_allround_01_mk1_macro"/>
    </virtualmacros>
    <ammunition>
      <ammunition macro="countermeasure_flares_01_macro" exact="4" optional="1"/>
    </ammunition>
  </loadout>
  <loadout id="test_carrier" name="Carrier" macro="ship_gen_xl_carrier_01_a_macro">
    <macros>
      <engine macro="engine_gen_xl_allround_01_mk1_macro" path="../con_engine_01"/>
    </macros>
    <groups>
      <shields macro="shield_gen_m_standard_02_mk1_macro" group="group_01" exact="3"/>
      <turrets macro="turret_gen_m_gatling_01_mk1_macro" group="group_02" min="0" max="2" optional="1"/>
      <turrets macro="turret_gen_l_gatling_01_mk1_macro" group="group_03"/>
    </groups>
    <virtualmacros>
      <thruster macro="thruster_gen_xl_allround_01_mk1_macro"/>
    </virtualmacros>
  </loadout>
</loadouts>
"""


def test_extract_pulls_loadout_identity() -> None:
    result = loadouts.extract(TINY_LOADOUTS_XML)

    assert len(result.loadouts) == 2
    basic = next(lo for lo in result.loadouts if lo["loadout_id"] == "test_basic")
    assert basic["ship_macro"] == "ship_gen_s_fighter_01_a_macro"
    assert basic["name"] == "Basic"


def test_extract_captures_macros_software_thruster_and_ammo() -> None:
    result = loadouts.extract(TINY_LOADOUTS_XML)
    rows = [r for r in result.equipment if r["loadout_id"] == "test_basic"]

    engine = next(r for r in rows if r["kind"] == "engine")
    assert engine["macro"] == "engine_gen_s_combat_01_mk1_macro"
    assert engine["slot_path"] == "../con_engine_01"
    assert engine["optional"] == 0

    shield = next(r for r in rows if r["kind"] == "shield")
    assert shield["optional"] == 1

    software = next(r for r in rows if r["kind"] == "software")
    assert software["macro"] == "software_flightassistmk1"

    thruster = next(r for r in rows if r["kind"] == "thruster")
    assert thruster["macro"] == "thruster_gen_s_allround_01_mk1_macro"

    ammo = next(r for r in rows if r["kind"] == "ammunition")
    assert ammo["quantity"] == 4
    assert ammo["optional"] == 1


def test_extract_expands_groups_with_exact_min_max_fallback() -> None:
    result = loadouts.extract(TINY_LOADOUTS_XML)
    rows = [r for r in result.equipment if r["loadout_id"] == "test_carrier"]

    shield_group = next(r for r in rows if r["kind"] == "shield")
    assert shield_group["quantity"] == 3
    assert shield_group["slot_path"] == "group_01"

    turret_optional = next(r for r in rows if r["macro"] == "turret_gen_m_gatling_01_mk1_macro")
    assert turret_optional["quantity"] == 2  # falls back to @max when @exact is absent
    assert turret_optional["optional"] == 1

    turret_bare = next(r for r in rows if r["macro"] == "turret_gen_l_gatling_01_mk1_macro")
    assert turret_bare["quantity"] == 1  # no exact/min/max at all → defaults to 1


def test_write_round_trips_through_sqlite(static_conn: sqlite3.Connection) -> None:
    result = loadouts.extract(TINY_LOADOUTS_XML)
    loadouts.write(static_conn, result)
    static_conn.commit()

    lo_count = static_conn.execute("SELECT COUNT(*) FROM loadouts").fetchone()[0]
    eq_count = static_conn.execute("SELECT COUNT(*) FROM loadout_equipment").fetchone()[0]
    assert lo_count == 2
    assert eq_count == len(result.equipment)

    row = static_conn.execute(
        "SELECT quantity FROM loadout_equipment WHERE loadout_id = 'test_carrier' "
        "AND macro = 'shield_gen_m_standard_02_mk1_macro'"
    ).fetchone()
    assert row["quantity"] == 3
