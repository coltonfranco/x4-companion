"""Extract `index/macros.xml` and referenced ship macros into the `ships` table.

Speed max calculation: X4 determines true max speed by multiplying thruster forward
thrust by the ship's drag/mass modifiers. Since resolving arbitrary thruster macros
adds significant complexity for v1, `speed_max` is simplified. We attempt to extract
forward drag and mass from the ship's physics node and return `1 / drag_forward` or
similar as a placeholder, or 0.0 if not easily available.
"""

from __future__ import annotations

import sqlite3
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from lxml import etree

from x4_extract.parsing import attr_flag, opt_attr, size_from_tags
from x4_extract.parsing import xml_attr_float as _float
from x4_extract.parsing import xml_attr_int as _int
from x4_extract.parsing import xpath_elements as _xpath_elements
from x4_extract.static.macro_index import iter_index_macros
from x4_extract.static.xml_helpers import SHIP_CLASSES, dlc_from_path

CountCache = dict[tuple[str, bool], dict[str, int]]


@dataclass(slots=True)
class ExtractResult:
    ships: list[dict[str, Any]] = field(default_factory=list)
    software: list[dict[str, Any]] = field(default_factory=list)


def extract(
    index_bytes: bytes, resolve_path: Callable[[str], bytes], resolve_name: Callable[[str], bytes]
) -> ExtractResult:
    """Parse merged macros.xml, resolve ship macros recursively, and extract row dicts."""
    out = ExtractResult()
    for name, xml_path, macro_el in iter_index_macros(
        index_bytes, resolve_path, class_filter=SHIP_CLASSES
    ):
        _parse_ship_macro(name, xml_path, macro_el, resolve_name, out)
    return out


def _parse_ship_macro(
    macro_name: str,
    file_path: str,
    macro_el: etree._Element,
    resolve_name: Callable[[str], bytes],
    out: ExtractResult,
) -> None:
    class_raw = macro_el.get("class", "")
    class_id = class_raw.replace("ship_", "") if class_raw.startswith("ship_") else class_raw

    ident_el = macro_el.find("properties/identification")
    purpose_el = macro_el.find("properties/purpose")
    hull_el = macro_el.find("properties/hull")
    physics_el = macro_el.find("properties/physics")
    storage_el = macro_el.find("properties/storage")
    people_el = macro_el.find("properties/people")
    secrecy_el = macro_el.find("properties/secrecy")
    ship_el = macro_el.find("properties/ship")
    jerk_el = macro_el.find("properties/jerk")
    modifiers_el = macro_el.find("properties/modifiers")
    explosion_el = macro_el.find("properties/explosiondamage")
    travel_stability_el = macro_el.find("properties/traveldrivestability")
    gatherrate_el = macro_el.find("properties/gatherrate")
    capture_el = macro_el.find("properties/capture")
    radar_el = macro_el.find("properties/radar")
    boost_el = macro_el.find("properties/boost")
    rotationspeed_el = macro_el.find("properties/rotationspeed")
    rotationaccel_el = macro_el.find("properties/rotationacceleration")

    missile_storage = drone_storage = countermeasure_storage = deployable_storage = None
    if storage_el is not None:
        missile_storage = _int(storage_el, "missile")
        drone_storage = _int(storage_el, "unit")
        countermeasure_storage = _int(storage_el, "countermeasure")
        deployable_storage = _int(storage_el, "deployable")

    if countermeasure_storage is None:
        if class_id == "s":
            countermeasure_storage = 4
        elif class_id == "m":
            countermeasure_storage = 8
        elif class_id == "l":
            countermeasure_storage = 20
        elif class_id == "xl":
            countermeasure_storage = 40

    if deployable_storage is None:
        if class_id == "s":
            deployable_storage = 50
        elif class_id == "m":
            deployable_storage = 100
        elif class_id == "l":
            deployable_storage = 250
        elif class_id == "xl":
            deployable_storage = 450

    mass = None
    drag_fwd = drag_rev = drag_horiz = drag_vert = drag_pitch = drag_yaw = drag_roll = None
    inertia_pitch = inertia_yaw = inertia_roll = None
    accel_factor_reverse = accel_factor_horizontal = accel_factor_vertical = None

    if physics_el is not None:
        mass = _float(physics_el, "mass")
        drag_el = physics_el.find("drag")
        inertia_el = physics_el.find("inertia")

        if drag_el is not None:
            drag_fwd = _float(drag_el, "forward")
            drag_rev = _float(drag_el, "reverse")
            drag_horiz = _float(drag_el, "horizontal")
            drag_vert = _float(drag_el, "vertical")
            drag_pitch = _float(drag_el, "pitch")
            drag_yaw = _float(drag_el, "yaw")
            drag_roll = _float(drag_el, "roll")

        if inertia_el is not None:
            inertia_pitch = _float(inertia_el, "pitch")
            inertia_yaw = _float(inertia_el, "yaw")
            inertia_roll = _float(inertia_el, "roll")

        accfactors_el = physics_el.find("accfactors")
        if accfactors_el is not None:
            accel_factor_reverse = _float(accfactors_el, "reverse")
            accel_factor_horizontal = _float(accfactors_el, "horizontal")
            accel_factor_vertical = _float(accfactors_el, "vertical")

    accel_forward = (
        _float(jerk_el.find("forward"), "accel")
        if jerk_el is not None and jerk_el.find("forward") is not None
        else None
    )
    decel_forward = (
        _float(jerk_el.find("forward"), "decel")
        if jerk_el is not None and jerk_el.find("forward") is not None
        else None
    )
    accel_boost = (
        _float(jerk_el.find("forward_boost"), "accel")
        if jerk_el is not None and jerk_el.find("forward_boost") is not None
        else None
    )
    accel_travel = (
        _float(jerk_el.find("forward_travel"), "accel")
        if jerk_el is not None and jerk_el.find("forward_travel") is not None
        else None
    )
    accel_strafe = (
        _float(jerk_el.find("strafe"), "value")
        if jerk_el is not None and jerk_el.find("strafe") is not None
        else None
    )
    accel_angular = (
        _float(jerk_el.find("angular"), "value")
        if jerk_el is not None and jerk_el.find("angular") is not None
        else None
    )

    modifier_weapon_heat = (
        _float(modifiers_el.find("weapon"), "heat")
        if modifiers_el is not None and modifiers_el.find("weapon") is not None
        else None
    )
    explosion_damage = _float(explosion_el, "value")
    explosion_shield_damage = _float(explosion_el, "shield")
    travel_stability = _float(travel_stability_el, "maxvalue")

    gatherrate_gas = _float(gatherrate_el, "gas")
    gatherrate_ore = _float(gatherrate_el, "ore")
    gatherrate_silicon = _float(gatherrate_el, "silicon")
    explosion_shield_disruption = _float(explosion_el, "shielddisruption")
    can_be_captured = _int(capture_el, "allow") if capture_el is not None else None
    radar_range_direct = _float(radar_el, "range")
    boost_recharge_delay = _float(boost_el, "rechargedelay")
    rotation_speed_max = _float(rotationspeed_el, "max")
    rotation_accel_max = _float(rotationaccel_el, "max")

    # Hardpoints counters
    counts = {
        "cargo_volume": 0,
        "weapons_s": 0,
        "weapons_m": 0,
        "weapons_l": 0,
        "weapons_xl": 0,
        "turrets_s": 0,
        "turrets_m": 0,
        "turrets_l": 0,
        "turrets_xl": 0,
        "shields_s": 0,
        "shields_m": 0,
        "shields_l": 0,
        "shields_xl": 0,
        "engines_s": 0,
        "engines_m": 0,
        "engines_l": 0,
        "engines_xl": 0,
        "dock_s": 0,
        "dock_m": 0,
        "dock_l": 0,
        "dock_xl": 0,
        "storage_s": 0,
        "storage_m": 0,
        "storage_l": 0,
        "storage_xl": 0,
        "launch_tubes": 0,
    }

    # Recursively resolve components to count hardpoints.  Caches avoid
    # re-parsing and re-counting the same component macros (shared across
    # many ships — the biggest perf win in the entire extraction pipeline).
    tree_cache: dict[str, etree._Element | None] = {}
    count_cache: CountCache = {}
    _resolve_and_count_hardpoints(macro_el, resolve_name, counts, tree_cache, count_cache)

    out.ships.append(
        {
            "ship_id": macro_name,
            "name": (opt_attr(ident_el, "name")) or macro_name,
            "description": opt_attr(ident_el, "description"),
            "basename": opt_attr(ident_el, "basename"),
            "file_path": file_path,
            "is_legacy": "legacy" in file_path.lower(),
            "dlc": dlc_from_path(file_path),
            "variation": opt_attr(ident_el, "variation"),
            "class_id": class_id,
            "ship_type": opt_attr(ship_el, "type"),
            "role": opt_attr(purpose_el, "primary"),
            "faction_id": opt_attr(ident_el, "makerrace"),
            "hull": _int(hull_el, "max") if hull_el is not None else None,
            "cargo_volume": counts.get("cargo_volume", 0),
            "dps_max": None,
            "speed_min": None,
            "speed_max": None,
            "travel_min": None,
            "travel_max": None,
            "boost_min": None,
            "boost_max": None,
            "pitch_min": None,
            "pitch_max": None,
            "yaw_min": None,
            "yaw_max": None,
            "roll_min": None,
            "roll_max": None,
            "shield_capacity_min": None,
            "shield_capacity_max": None,
            "shield_recharge_min": None,
            "shield_recharge_max": None,
            "shield_delay_min": None,
            "shield_delay_max": None,
            "radar_range": None,
            "icon_path": opt_attr(ident_el, "icon"),
            "mass": mass,
            "drag_forward": drag_fwd,
            "drag_reverse": drag_rev,
            "drag_horizontal": drag_horiz,
            "drag_vertical": drag_vert,
            "drag_pitch": drag_pitch,
            "drag_yaw": drag_yaw,
            "drag_roll": drag_roll,
            "inertia_pitch": inertia_pitch,
            "inertia_yaw": inertia_yaw,
            "inertia_roll": inertia_roll,
            "people_capacity": _int(people_el, "capacity") if people_el is not None else None,
            "missile_storage": missile_storage,
            "drone_storage": drone_storage,
            "countermeasure_storage": countermeasure_storage,
            "deployable_storage": deployable_storage,
            "secrecy_level": _int(secrecy_el, "level") if secrecy_el is not None else None,
            "accel_forward": accel_forward,
            "decel_forward": decel_forward,
            "accel_boost": accel_boost,
            "accel_travel": accel_travel,
            "accel_strafe": accel_strafe,
            "accel_angular": accel_angular,
            "accel_factor_reverse": accel_factor_reverse,
            "accel_factor_horizontal": accel_factor_horizontal,
            "accel_factor_vertical": accel_factor_vertical,
            "modifier_weapon_heat": modifier_weapon_heat,
            "explosion_damage": explosion_damage,
            "explosion_shield_damage": explosion_shield_damage,
            "explosion_shield_disruption": explosion_shield_disruption,
            "travel_stability": travel_stability,
            "gatherrate_gas": gatherrate_gas,
            "gatherrate_ore": gatherrate_ore,
            "gatherrate_silicon": gatherrate_silicon,
            "can_be_captured": can_be_captured,
            "radar_range_direct": radar_range_direct,
            "boost_recharge_delay": boost_recharge_delay,
            "rotation_speed_max": rotation_speed_max,
            "rotation_accel_max": rotation_accel_max,
            **counts,
        }
    )

    for sw_el in macro_el.iterfind("properties/software/software"):
        ware_id = sw_el.get("ware")
        if not ware_id:
            continue
        out.software.append(
            {
                "ship_id": macro_name,
                "ware_id": ware_id,
                "compatible": attr_flag(sw_el, "compatible", "1"),
                "is_default": attr_flag(sw_el, "default", "1"),
            }
        )


def _resolve_and_count_hardpoints(
    el: etree._Element,
    resolve_name: Callable[[str], bytes],
    counts: dict[str, int],
    tree_cache: dict[str, etree._Element | None],
    count_cache: CountCache,
) -> None:
    """Resolve component macros recursively and count hardpoints.

    *tree_cache* prevents re-parsing the same XML hundreds of times.
    *count_cache* prevents re-counting connections on identical components.
    """
    # Accumulate cargo volume from properties/cargo and properties/storage
    cargo_el = el.find("properties/cargo")
    if cargo_el is not None:
        c = _int(cargo_el, "max")
        if c:
            counts["cargo_volume"] += c
    storage_el = el.find("properties/storage")
    if storage_el is not None:
        c = _int(storage_el, "cargo")
        if c:
            counts["cargo_volume"] += c

    # Resolve the direct component — hardpoints only, NOT docks.
    # The component is the 3D model + hardpoint connections.  Docks are
    # always defined in child macros (dockarea / shipstorage), not here.
    comp_el = el.find("component")
    if comp_el is not None:
        comp_ref = comp_el.get("ref")
        if comp_ref:
            _add_component_counts(
                comp_ref, resolve_name, counts, tree_cache, count_cache, count_docks=False
            )

    # Resolve child macros — docks, hardpoints, and cargo.
    # Docks (dockarea, shipstorage) are defined in child macros, NOT the
    # main component, so they MUST be counted here.
    for child_macro in _xpath_elements(el, ".//macro[@ref]"):
        macro_ref = child_macro.get("ref")
        if macro_ref:
            _add_component_counts(
                macro_ref, resolve_name, counts, tree_cache, count_cache, count_docks=True
            )


def _add_component_counts(
    ref: str,
    resolve_name: Callable[[str], bytes],
    counts: dict[str, int],
    tree_cache: dict[str, etree._Element | None],
    count_cache: CountCache,
    count_docks: bool = True,
) -> None:
    """Resolve *ref* (once) and merge its counts into *counts*.

    Cargo is always counted — storage macros are distinct and additive.
    When *count_docks* is True, dock bays and hardpoint connections are
    also counted.  When False, only hardpoint connections are counted.
    """
    cache_key = (ref, count_docks)
    if cache_key in count_cache:
        for k, v in count_cache[cache_key].items():
            counts[k] += v
        return

    # Resolve and parse the XML (cached).
    if ref not in tree_cache:
        try:
            raw = resolve_name(ref)
            tree_cache[ref] = etree.fromstring(raw)
        except (KeyError, etree.XMLSyntaxError):
            tree_cache[ref] = None
    root = tree_cache[ref]
    if root is None:
        return

    # Find the matching element and count its connections.
    node = root.find(f".//*[@name='{ref}']")
    if node is None:
        return

    local: dict[str, int] = {
        "cargo_volume": 0,
        "weapons_s": 0,
        "weapons_m": 0,
        "weapons_l": 0,
        "weapons_xl": 0,
        "turrets_s": 0,
        "turrets_m": 0,
        "turrets_l": 0,
        "turrets_xl": 0,
        "shields_s": 0,
        "shields_m": 0,
        "shields_l": 0,
        "shields_xl": 0,
        "engines_s": 0,
        "engines_m": 0,
        "engines_l": 0,
        "engines_xl": 0,
        "dock_s": 0,
        "dock_m": 0,
        "dock_l": 0,
        "dock_xl": 0,
        "storage_s": 0,
        "storage_m": 0,
        "storage_l": 0,
        "storage_xl": 0,
        "launch_tubes": 0,
    }

    # Cargo always accumulates — storage macros are distinct from dock macros
    # and their cargo is additive, never duplicate.
    # Docks are gated by count_docks to allow callers to skip dock counting
    # when it would double-count (e.g. if a macro is reached via multiple paths).
    cargo_el = node.find("properties/cargo")
    if cargo_el is not None:
        c = _int(cargo_el, "max")
        if c:
            local["cargo_volume"] += c
    storage_el = node.find("properties/storage")
    if storage_el is not None:
        c = _int(storage_el, "cargo")
        if c:
            local["cargo_volume"] += c

    if count_docks:
        dock_el = node.find("properties/dock")
        if dock_el is not None:
            cap = _int(dock_el, "capacity") or 1  # external pads omit capacity → implicit 1
            docksize_el = node.find("properties/docksize")
            if cap and docksize_el is not None:
                tags = docksize_el.get("tags", "")
                size = size_from_tags(
                    tags,
                    order=(
                        ("xl", ("dock_xl", "extralarge")),
                        ("l", ("dock_l", "large")),
                        ("m", ("dock_m", "medium")),
                        ("xs", ("dock_xs", "extrasmall")),
                    ),
                    default="s",
                )
                if size == "xs":
                    size = None  # XS = drones/spacesuits, not ship docks

                if size is not None:
                    if dock_el.get("storage") == "1":
                        local[f"storage_{size}"] += cap
                    else:
                        local[f"dock_{size}"] += cap

    _count_connections(node, local)

    # Recurse into child macro refs on this component.
    for child_macro in _xpath_elements(node, ".//macro[@ref]"):
        child_ref = child_macro.get("ref")
        if child_ref:
            _add_component_counts(
                child_ref, resolve_name, local, tree_cache, count_cache, count_docks
            )

    # Cache and merge.
    count_cache[cache_key] = local
    for k, v in local.items():
        counts[k] += v


def _count_connections(comp_node: etree._Element, counts: dict[str, int]) -> None:
    for conn in _xpath_elements(comp_node, ".//connection[@tags]"):
        tags_str = conn.get("tags", "")
        if not tags_str:
            continue

        tags = tags_str.split()

        if "launchtube" in tags:
            counts["launch_tubes"] += 1
            continue

        # Determine kind
        kind = None
        if "engine" in tags:
            kind = "engines"
        elif "turret" in tags:
            kind = "turrets"
        elif "weapon" in tags:
            kind = "weapons"
        elif "shield" in tags:
            kind = "shields"

        if not kind:
            continue

        # Determine size
        size = size_from_tags(tags, default="s")

        counts[f"{kind}_{size}"] += 1


def write(conn: sqlite3.Connection, result: ExtractResult) -> None:
    """Replace ship rows in static.db."""
    conn.execute("DELETE FROM ship_software")
    conn.execute("DELETE FROM ships")

    columns = [
        "ship_id",
        "name",
        "description",
        "basename",
        "file_path",
        "is_legacy",
        "dlc",
        "class_id",
        "ship_type",
        "role",
        "faction_id",
        "variation",
        "hull",
        "cargo_volume",
        "dps_max",
        "speed_min",
        "speed_max",
        "travel_min",
        "travel_max",
        "boost_min",
        "boost_max",
        "pitch_min",
        "pitch_max",
        "yaw_min",
        "yaw_max",
        "roll_min",
        "roll_max",
        "shield_capacity_min",
        "shield_capacity_max",
        "shield_recharge_min",
        "shield_recharge_max",
        "shield_delay_min",
        "shield_delay_max",
        "radar_range",
        "icon_path",
        "mass",
        "drag_forward",
        "drag_reverse",
        "drag_horizontal",
        "drag_vertical",
        "drag_pitch",
        "drag_yaw",
        "drag_roll",
        "inertia_pitch",
        "inertia_yaw",
        "inertia_roll",
        "people_capacity",
        "missile_storage",
        "drone_storage",
        "countermeasure_storage",
        "deployable_storage",
        "secrecy_level",
        "dock_s",
        "dock_m",
        "dock_l",
        "dock_xl",
        "storage_s",
        "storage_m",
        "storage_l",
        "storage_xl",
        "launch_tubes",
        "accel_forward",
        "decel_forward",
        "accel_boost",
        "accel_travel",
        "accel_strafe",
        "accel_angular",
        "accel_factor_reverse",
        "accel_factor_horizontal",
        "accel_factor_vertical",
        "modifier_weapon_heat",
        "explosion_damage",
        "explosion_shield_damage",
        "explosion_shield_disruption",
        "travel_stability",
        "gatherrate_gas",
        "gatherrate_ore",
        "gatherrate_silicon",
        "can_be_captured",
        "radar_range_direct",
        "boost_recharge_delay",
        "rotation_speed_max",
        "rotation_accel_max",
        "weapons_s",
        "weapons_m",
        "weapons_l",
        "weapons_xl",
        "turrets_s",
        "turrets_m",
        "turrets_l",
        "turrets_xl",
        "shields_s",
        "shields_m",
        "shields_l",
        "shields_xl",
        "engines_s",
        "engines_m",
        "engines_l",
        "engines_xl",
    ]

    cols_str = ", ".join(columns)
    vals_str = ", ".join(f":{c}" for c in columns)

    conn.executemany(
        f"INSERT INTO ships ({cols_str}) VALUES ({vals_str})",
        result.ships,
    )
    if result.software:
        conn.executemany(
            "INSERT INTO ship_software (ship_id, ware_id, compatible, is_default) "
            "VALUES (:ship_id, :ware_id, :compatible, :is_default)",
            result.software,
        )


def update_derived_stats(conn: sqlite3.Connection) -> None:
    """Calculate min/max stats based on extracted ship equipment capacity.

    Computes per-ship maxima/minima from compatible equipment only.
    Equipment with restrictive compat_tags that don't match a ship's
    ship_id are excluded, matching the builder's filtering logic.
    """
    conn.row_factory = sqlite3.Row
    sizes = ("s", "m", "l", "xl")

    def _is_compat(tags: str | None, ship_id: str) -> bool:
        """Match frontend compat_tags logic: NULL = universal; any tag whose
        underscore-segments all appear in the ship_id means compatible."""
        if not tags:
            return True
        for tag in tags.split():
            segs = [s for s in tag.split("_") if s]
            if segs and all(s in ship_id for s in segs):
                return True
        return False

    # ── Load ships ───────────────────────────────────────────────────────
    ship_rows = conn.execute("""
        SELECT ship_id, class_id, drag_forward, mass,
               inertia_pitch, inertia_yaw, inertia_roll,
               engines_s, engines_m, engines_l, engines_xl,
               weapons_s, weapons_m, weapons_l, weapons_xl,
               turrets_s, turrets_m, turrets_l, turrets_xl,
               shields_s, shields_m, shields_l, shields_xl
        FROM ships WHERE mass > 0 AND drag_forward > 0
    """).fetchall()

    if not ship_rows:
        return

    # ── Load equipment ───────────────────────────────────────────────────
    engine_rows = conn.execute("""
        SELECT size, class_id, compat_tags,
               thrust_forward, travel_thrust, boost_thrust,
               thrust_pitch, thrust_yaw, thrust_roll
        FROM equip_engines WHERE size IN ('s','m','l','xl')
    """).fetchall()

    shield_rows = conn.execute("""
        SELECT size, compat_tags, capacity, recharge_rate, recharge_delay
        FROM equip_shields WHERE size IN ('s','m','l','xl')
    """).fetchall()

    weapon_rows = conn.execute("""
        SELECT w.size, w.class_id, w.compat_tags,
               b.damage * COALESCE(b.amount,1) * COALESCE(b.barrelamount,1)
                 / COALESCE(b.reload_rate,1.0) AS dps,
               b.speed * b.lifetime / 1000.0 AS range_val
        FROM equip_weapons w
        JOIN equip_bullets b ON w.default_bullet_id = b.bullet_id
        WHERE w.size IN ('s','m','l','xl')
    """).fetchall()

    # ── Pre-group equipment by (size, class) ─────────────────────────────
    eng_by_size = {s: [r for r in engine_rows if r["size"] == s and r["class_id"] == "engine"] for s in sizes}
    thr_by_size = {s: [r for r in engine_rows if r["size"] == s and r["class_id"] == "thruster"] for s in sizes}
    shd_by_size = {s: [r for r in shield_rows if r["size"] == s] for s in sizes}
    wpn_by_size = {s: [r for r in weapon_rows if r["size"] == s and r["class_id"] != "turret"] for s in sizes}
    tur_by_size = {s: [r for r in weapon_rows if r["size"] == s and r["class_id"] == "turret"] for s in sizes}

    # ── Helper: best value among compatible equipment for a given size ───
    def _best(by_size, sz, sid, key_fn, best_fn):
        vals = [key_fn(r) for r in by_size[sz]
                if _is_compat(r["compat_tags"], sid) and key_fn(r) is not None]
        return best_fn(vals) if vals else 0.0

    def _compat_max(by_size, sz, sid, key_fn):
        return _best(by_size, sz, sid, key_fn, max)

    def _compat_min(by_size, sz, sid, key_fn):
        return _best(by_size, sz, sid, key_fn, min)

    # ── Create temp tables ───────────────────────────────────────────────
    for tbl in ("_ship_engine_best", "_ship_thruster_best", "_ship_shield_best",
                "_ship_weapon_best", "_ship_radar"):
        conn.execute(f"DROP TABLE IF EXISTS {tbl}")

    conn.execute("""
        CREATE TEMP TABLE _ship_engine_best (
            ship_id TEXT PRIMARY KEY,
            thrust_s  REAL, thrust_m  REAL, thrust_l  REAL, thrust_xl  REAL,
            travel_s  REAL, travel_m  REAL, travel_l  REAL, travel_xl  REAL,
            boost_s   REAL, boost_m   REAL, boost_l   REAL, boost_xl   REAL,
            min_thrust_s REAL, min_thrust_m REAL, min_thrust_l REAL, min_thrust_xl REAL,
            min_travel_s REAL, min_travel_m REAL, min_travel_l REAL, min_travel_xl REAL,
            min_boost_s  REAL, min_boost_m  REAL, min_boost_l  REAL, min_boost_xl  REAL
        )
    """)
    conn.execute("""
        CREATE TEMP TABLE _ship_thruster_best (
            ship_id TEXT PRIMARY KEY,
            pitch_min REAL, pitch_max REAL,
            yaw_min   REAL, yaw_max   REAL,
            roll_min  REAL, roll_max  REAL
        )
    """)
    conn.execute("""
        CREATE TEMP TABLE _ship_shield_best (
            ship_id TEXT PRIMARY KEY,
            cap_s  REAL, cap_m  REAL, cap_l  REAL, cap_xl  REAL,
            rec_s  REAL, rec_m  REAL, rec_l  REAL, rec_xl  REAL,
            cap_min_s REAL, cap_min_m REAL, cap_min_l REAL, cap_min_xl REAL,
            rec_min_s REAL, rec_min_m REAL, rec_min_l REAL, rec_min_xl REAL,
            delay_min  REAL, delay_max  REAL
        )
    """)
    conn.execute("""
        CREATE TEMP TABLE _ship_weapon_best (
            ship_id TEXT PRIMARY KEY,
            wpn_dps_s REAL, wpn_dps_m REAL, wpn_dps_l REAL, wpn_dps_xl REAL,
            tur_dps_s REAL, tur_dps_m REAL, tur_dps_l REAL, tur_dps_xl REAL,
            range_max REAL
        )
    """)

    # ── Per-ship computation ─────────────────────────────────────────────
    eng_inserts: list[tuple] = []
    thr_inserts: list[tuple] = []
    shd_inserts: list[tuple] = []
    wpn_inserts: list[tuple] = []

    thrust_key   = lambda r: r["thrust_forward"]
    travel_key   = lambda r: (r["thrust_forward"] or 0) * (r["travel_thrust"] or 0)
    boost_key    = lambda r: (r["thrust_forward"] or 0) * (r["boost_thrust"] or 0)
    pitch_key    = lambda r: r["thrust_pitch"]
    yaw_key      = lambda r: r["thrust_yaw"]
    roll_key     = lambda r: r["thrust_roll"]
    cap_key      = lambda r: r["capacity"]
    rec_key      = lambda r: r["recharge_rate"]
    dps_key      = lambda r: r["dps"]
    range_key    = lambda r: r["range_val"]

    for ship in ship_rows:
        sid = ship["ship_id"]
        cls = ship["class_id"]

        # ── Engines ──
        ev: dict[str, float] = {}
        for sz in sizes:
            has = (ship[f"engines_{sz}"] or 0) > 0
            ev[f"thrust_{sz}"]     = _compat_max(eng_by_size, sz, sid, thrust_key) if has else 0.0
            ev[f"travel_{sz}"]     = _compat_max(eng_by_size, sz, sid, travel_key) if has else 0.0
            ev[f"boost_{sz}"]      = _compat_max(eng_by_size, sz, sid, boost_key)  if has else 0.0
            ev[f"min_thrust_{sz}"] = _compat_min(eng_by_size, sz, sid, thrust_key) if has else 0.0
            ev[f"min_travel_{sz}"] = _compat_min(eng_by_size, sz, sid, travel_key) if has else 0.0
            ev[f"min_boost_{sz}"]  = _compat_min(eng_by_size, sz, sid, boost_key)  if has else 0.0
        eng_inserts.append((sid,) + tuple(ev[f"{k}_{sz}"]
                                 for k in ("thrust","travel","boost",
                                           "min_thrust","min_travel","min_boost")
                                 for sz in sizes))

        # ── Thrusters (size = ship class) ──
        if cls in sizes:
            tp = (_compat_min(thr_by_size, cls, sid, pitch_key),
                  _compat_max(thr_by_size, cls, sid, pitch_key),
                  _compat_min(thr_by_size, cls, sid, yaw_key),
                  _compat_max(thr_by_size, cls, sid, yaw_key),
                  _compat_min(thr_by_size, cls, sid, roll_key),
                  _compat_max(thr_by_size, cls, sid, roll_key))
        else:
            tp = (0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
        thr_inserts.append((sid,) + tp)

        # ── Shields ──
        sv: dict[str, float] = {}
        all_compat: list = []
        for sz in sizes:
            compat = [r for r in shd_by_size[sz] if _is_compat(r["compat_tags"], sid)]
            has = (ship[f"shields_{sz}"] or 0) > 0
            sv[f"cap_{sz}"]     = max((r["capacity"] or 0) for r in compat) if has and compat else 0.0
            sv[f"rec_{sz}"]     = max((r["recharge_rate"] or 0) for r in compat) if has and compat else 0.0
            sv[f"cap_min_{sz}"] = min((r["capacity"] or 0) for r in compat) if has and compat else 0.0
            sv[f"rec_min_{sz}"] = min((r["recharge_rate"] or 0) for r in compat) if has and compat else 0.0
            all_compat.extend(compat)
        delays = [(r["recharge_delay"] or 0) for r in all_compat if r["recharge_delay"] is not None]
        sv["delay_min"] = min(delays) if delays else 0.0
        sv["delay_max"] = max(delays) if delays else 0.0
        shd_inserts.append((sid,) + tuple(sv[f"{k}_{sz}"]
                                 for k in ("cap","rec","cap_min","rec_min")
                                 for sz in sizes) + (sv["delay_min"], sv["delay_max"]))

        # ── Weapons & Turrets ──
        wv: dict[str, float] = {}
        for sz in sizes:
            wv[f"wpn_dps_{sz}"] = _compat_max(wpn_by_size, sz, sid, dps_key) if (ship[f"weapons_{sz}"] or 0) > 0 else 0.0
            wv[f"tur_dps_{sz}"] = _compat_max(tur_by_size, sz, sid, dps_key) if (ship[f"turrets_{sz}"] or 0) > 0 else 0.0

        best_r = 0.0
        for sz in sizes:
            if (ship[f"weapons_{sz}"] or 0) > 0 or (ship[f"turrets_{sz}"] or 0) > 0:
                for r in wpn_by_size[sz] + tur_by_size[sz]:
                    if _is_compat(r["compat_tags"], sid) and r["range_val"] and r["range_val"] > best_r:
                        best_r = r["range_val"]
        wv["range_max"] = min(30.0, best_r)
        wpn_inserts.append((sid,) + tuple(wv[f"wpn_dps_{sz}"] for sz in sizes)
                           + tuple(wv[f"tur_dps_{sz}"] for sz in sizes)
                           + (wv["range_max"],))

    # ── Bulk-insert the per-ship rows ────────────────────────────────────
    conn.executemany(
        "INSERT INTO _ship_engine_best (ship_id,"
        " thrust_s,thrust_m,thrust_l,thrust_xl,"
        " travel_s,travel_m,travel_l,travel_xl,"
        " boost_s,boost_m,boost_l,boost_xl,"
        " min_thrust_s,min_thrust_m,min_thrust_l,min_thrust_xl,"
        " min_travel_s,min_travel_m,min_travel_l,min_travel_xl,"
        " min_boost_s,min_boost_m,min_boost_l,min_boost_xl"
        ") VALUES (?,?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?)",
        eng_inserts,
    )
    conn.executemany(
        "INSERT INTO _ship_thruster_best (ship_id,"
        " pitch_min,pitch_max, yaw_min,yaw_max, roll_min,roll_max"
        ") VALUES (?,?,?,?,?,?,?)",
        thr_inserts,
    )
    conn.executemany(
        "INSERT INTO _ship_shield_best (ship_id,"
        " cap_s,cap_m,cap_l,cap_xl, rec_s,rec_m,rec_l,rec_xl,"
        " cap_min_s,cap_min_m,cap_min_l,cap_min_xl,"
        " rec_min_s,rec_min_m,rec_min_l,rec_min_xl,"
        " delay_min,delay_max"
        ") VALUES (?,?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?)",
        shd_inserts,
    )
    conn.executemany(
        "INSERT INTO _ship_weapon_best (ship_id,"
        " wpn_dps_s,wpn_dps_m,wpn_dps_l,wpn_dps_xl,"
        " tur_dps_s,tur_dps_m,tur_dps_l,tur_dps_xl,"
        " range_max"
        ") VALUES (?,?,?,?,?, ?,?,?,?, ?)",
        wpn_inserts,
    )

    # ── Radar (unchanged logic) ──────────────────────────────────────────
    conn.execute("""
        CREATE TEMP TABLE _ship_radar AS
        SELECT s.ship_id, COALESCE(MAX(e.radar_range), 40000) AS radar
        FROM ships s
        LEFT JOIN ship_software sw ON s.ship_id = sw.ship_id AND sw.is_default = 1
        LEFT JOIN equip_software e ON sw.ware_id = e.software_id
        GROUP BY s.ship_id
    """)

    # ── Final UPDATE via JOIN to per-ship temp tables ────────────────────
    conn.execute("""
        UPDATE ships SET
          speed_min  = (COALESCE(eb.min_thrust_s,0)*engines_s + COALESCE(eb.min_thrust_m,0)*engines_m + COALESCE(eb.min_thrust_l,0)*engines_l + COALESCE(eb.min_thrust_xl,0)*engines_xl) / drag_forward,
          speed_max  = (COALESCE(eb.thrust_s,0)*engines_s     + COALESCE(eb.thrust_m,0)*engines_m     + COALESCE(eb.thrust_l,0)*engines_l     + COALESCE(eb.thrust_xl,0)*engines_xl)     / drag_forward,
          travel_min = (COALESCE(eb.min_travel_s,0)*engines_s + COALESCE(eb.min_travel_m,0)*engines_m + COALESCE(eb.min_travel_l,0)*engines_l + COALESCE(eb.min_travel_xl,0)*engines_xl) / drag_forward,
          travel_max = (COALESCE(eb.travel_s,0)*engines_s     + COALESCE(eb.travel_m,0)*engines_m     + COALESCE(eb.travel_l,0)*engines_l     + COALESCE(eb.travel_xl,0)*engines_xl)     / drag_forward,
          boost_min  = (COALESCE(eb.min_boost_s,0)*engines_s  + COALESCE(eb.min_boost_m,0)*engines_m  + COALESCE(eb.min_boost_l,0)*engines_l  + COALESCE(eb.min_boost_xl,0)*engines_xl)  / drag_forward,
          boost_max  = (COALESCE(eb.boost_s,0)*engines_s      + COALESCE(eb.boost_m,0)*engines_m      + COALESCE(eb.boost_l,0)*engines_l      + COALESCE(eb.boost_xl,0)*engines_xl)      / drag_forward,
          accel_max  = (COALESCE(eb.thrust_s,0)*engines_s     + COALESCE(eb.thrust_m,0)*engines_m     + COALESCE(eb.thrust_l,0)*engines_l     + COALESCE(eb.thrust_xl,0)*engines_xl)     / mass,

          pitch_min = COALESCE(tb.pitch_min,0) / inertia_pitch,
          pitch_max = COALESCE(tb.pitch_max,0) / inertia_pitch,
          yaw_min   = COALESCE(tb.yaw_min,0)   / inertia_yaw,
          yaw_max   = COALESCE(tb.yaw_max,0)   / inertia_yaw,
          roll_min  = COALESCE(tb.roll_min,0)  / inertia_roll,
          roll_max  = COALESCE(tb.roll_max,0)  / inertia_roll,

          shield_capacity_min  = (COALESCE(sb.cap_min_s,0)*shields_s + COALESCE(sb.cap_min_m,0)*shields_m + COALESCE(sb.cap_min_l,0)*shields_l + COALESCE(sb.cap_min_xl,0)*shields_xl),
          shield_capacity_max  = (COALESCE(sb.cap_s,0)*shields_s     + COALESCE(sb.cap_m,0)*shields_m     + COALESCE(sb.cap_l,0)*shields_l     + COALESCE(sb.cap_xl,0)*shields_xl),
          shield_recharge_min  = (COALESCE(sb.rec_min_s,0)*shields_s + COALESCE(sb.rec_min_m,0)*shields_m + COALESCE(sb.rec_min_l,0)*shields_l + COALESCE(sb.rec_min_xl,0)*shields_xl),
          shield_recharge_max  = (COALESCE(sb.rec_s,0)*shields_s     + COALESCE(sb.rec_m,0)*shields_m     + COALESCE(sb.rec_l,0)*shields_l     + COALESCE(sb.rec_xl,0)*shields_xl),
          shield_delay_min = CASE WHEN (shields_s>0 OR shields_m>0 OR shields_l>0 OR shields_xl>0) THEN sb.delay_min END,
          shield_delay_max = CASE WHEN (shields_s>0 OR shields_m>0 OR shields_l>0 OR shields_xl>0) THEN sb.delay_max END,

          dps_max    = (COALESCE(wb.wpn_dps_s,0)*weapons_s + COALESCE(wb.wpn_dps_m,0)*weapons_m + COALESCE(wb.wpn_dps_l,0)*weapons_l + COALESCE(wb.wpn_dps_xl,0)*weapons_xl)
                     + (COALESCE(wb.tur_dps_s,0)*turrets_s + COALESCE(wb.tur_dps_m,0)*turrets_m + COALESCE(wb.tur_dps_l,0)*turrets_l + COALESCE(wb.tur_dps_xl,0)*turrets_xl),

          radar_range = (SELECT radar FROM _ship_radar r WHERE r.ship_id = ships.ship_id),
          range_max   = wb.range_max
        FROM _ship_engine_best eb,
             _ship_thruster_best tb,
             _ship_shield_best sb,
             _ship_weapon_best wb
        WHERE ships.ship_id = eb.ship_id
          AND ships.ship_id = tb.ship_id
          AND ships.ship_id = sb.ship_id
          AND ships.ship_id = wb.ship_id
          AND ships.mass > 0 AND ships.drag_forward > 0
    """)

    # Cleanup
    for tbl in ("_ship_engine_best", "_ship_thruster_best", "_ship_shield_best",
                "_ship_weapon_best", "_ship_radar"):
        conn.execute(f"DROP TABLE IF EXISTS {tbl}")
