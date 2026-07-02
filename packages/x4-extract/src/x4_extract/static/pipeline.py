"""Orchestrator: extract XML from raw.db -> write static.db.

Reads the pre-patched data lake (raw.db) and transforms it into structured tables.
"""

from __future__ import annotations

import sqlite3
import time
from collections.abc import Callable
from typing import Any

from x4_extract.config import ExtractSettings
from x4_extract.constants import DEFAULT_LANGUAGE_CODE
from x4_extract.db import apply_schema
from x4_extract.static.extractors import (
    assignments,
    behaviours,
    diplomacy,
    drops,
    equip_mods,
    equipment,
    factions,
    gamestarts,
    loadouts,
    missiongroups,
    modules,
    orders,
    races,
    regions,
    roles,
    ships,
    station_types,
    terraforming,
    texts,
    universe_map,
    waregroups,
    wares,
)
from x4_extract.static.progress import elapsed as _elapsed
from x4_extract.static.progress import log_progress as _log
from x4_extract.static.raw import RawFileStore

# ── Logging helpers ────────────────────────────────────────────────────────────


def run_step(
    progress_log: Callable[[str], None],
    label: str,
    xml: bytes | None,
    extract_fn: Callable[[bytes], Any],
    write_fn: Callable[[Any], None],
    count_fn: Callable[[Any], str],
) -> Any | None:
    """Run one extract -> write pipeline step with the shared start/elapsed log shape.

    Always logs the "Extracting: <label>" start message, even when `xml` is None, so
    the progress-bar step count matches the previous per-block behavior. The
    "  -> ..." elapsed summary (and the extract/write calls) are skipped when the
    source XML wasn't present.
    """
    t0 = time.monotonic()
    progress_log(f"Extracting: {label}")
    if xml is None:
        return None
    result = extract_fn(xml)
    write_fn(result)
    progress_log(f"  -> {count_fn(result)} ({_elapsed(t0)})")
    return result


def run(settings: ExtractSettings, on_progress: Callable[[str, float], None] | None = None) -> None:
    _step = [0]
    _total_steps = 26

    def _progress_log(msg: str) -> None:
        _log(msg)
        if on_progress:
            _step[0] += 1
            # Scale from 0.0 to 1.0 (since icons are now moved out)
            frac = min(_step[0], _total_steps) / _total_steps
            on_progress(
                msg.replace("Extracting: ", "").replace("Computing: ", "").capitalize(), frac
            )

    settings.data_dir.mkdir(parents=True, exist_ok=True)
    db_path = settings.data_dir / "static.db"
    raw_db_path = settings.data_dir / "raw.db"

    if not raw_db_path.exists():
        _progress_log("raw.db not found — run rebuild-datalake first")
        return

    # Always start with a fresh static.db — rebuild-static is a full replace, not a migration.
    apply_schema(settings.data_dir, "static")

    # Write to static.db in a transaction
    conn = sqlite3.connect(db_path)

    # Attach raw database so we can read from it
    conn.execute(f"ATTACH DATABASE '{raw_db_path.as_posix()}' AS raw")

    # Helper to fetch a file from raw.db. Case-insensitive because index/macros.xml
    # references lowercase paths (e.g. props/engines/macros/…) while the crawler
    # preserves the archives' original casing (props/Engines/…). An exact match drops
    # most base-game equipment macros; NOCASE recovers them.
    raw_files = RawFileStore(conn, schema="raw")
    get_raw_file = raw_files.get_path

    # Init localizer
    import dataclasses

    from x4_extract.i18n import Localizer

    localizer = Localizer(conn, DEFAULT_LANGUAGE_CODE)

    def _localize_result(result: Any) -> Any:
        """Recursively translates {page,text} macros in all strings within ExtractResult dicts."""
        if not dataclasses.is_dataclass(result):
            return result
        for field in dataclasses.fields(result):
            value = getattr(result, field.name)
            if isinstance(value, list):
                for row_dict in value:
                    for k, v in row_dict.items():
                        if isinstance(v, str) and "{" in v:
                            row_dict[k] = localizer.resolve(v)
        return result

    _progress_log("Starting static rebuild")

    try:
        with conn:
            waregroups_xml = get_raw_file("libraries/waregroups.xml")
            run_step(
                _progress_log,
                "ware groups",
                waregroups_xml,
                waregroups.extract,
                lambda r: waregroups.write(conn, _localize_result(r)),
                lambda r: f"{len(r.groups)} groups",
            )

            missiongroups_xml = get_raw_file("libraries/missiongroups.xml")
            run_step(
                _progress_log,
                "mission groups",
                missiongroups_xml,
                missiongroups.extract,
                lambda r: missiongroups.write(conn, _localize_result(r)),
                lambda r: f"{len(r.groups)} groups",
            )

            wares_xml = get_raw_file("libraries/wares.xml")
            # extract() fills each ware's production tier
            run_step(
                _progress_log,
                "wares",
                wares_xml,
                wares.extract,
                lambda r: wares.write(conn, _localize_result(r)),
                lambda r: f"{len(r.wares)} wares",
            )
            if wares_xml:
                mods_xml = get_raw_file("libraries/equipmentmods.xml")
                run_step(
                    _progress_log,
                    "equipment mods",
                    mods_xml,
                    lambda xml: equip_mods.extract(xml, wares_xml),
                    lambda r: equip_mods.write(conn, _localize_result(r)),
                    lambda r: f"{len(r.mods)} mods",
                )
                drops_xml = get_raw_file("libraries/drops.xml")
                run_step(
                    _progress_log,
                    "drops",
                    drops_xml,
                    drops.extract,
                    lambda r: drops.write(conn, _localize_result(r)),
                    lambda r: f"{len(r.lists)} lists",
                )

            factions_xml = get_raw_file("libraries/factions.xml")
            colors_xml = get_raw_file("libraries/colors.xml")
            run_step(
                _progress_log,
                "factions",
                factions_xml,
                lambda xml: factions.extract(xml, colors_xml),
                lambda r: factions.write(conn, _localize_result(r)),  # definitions only; relations -> seed.db
                lambda r: f"{len(r.factions)} factions",
            )

            races_xml = get_raw_file("libraries/races.xml")
            run_step(
                _progress_log,
                "races",
                races_xml,
                races.extract,
                lambda r: races.write(conn, _localize_result(r)),
                lambda r: f"{len(r.races)} races",
            )

            macros_xml = get_raw_file("index/macros.xml")
            if macros_xml:
                # Bulk-load all raw_files into memory — the macros step
                # resolves thousands of paths and filenames.  Doing 8K+
                # individual DB queries (each with COLLATE NOCASE) is the
                # dominant cost in the entire pipeline.
                rows = conn.execute("SELECT filepath, content FROM raw.raw_files").fetchall()
                _all_raw: dict[str, bytes] = {str(r[0]): str(r[1]).encode("utf-8") for r in rows}
                # Case-insensitive fallback: macro index uses lowercase paths
                # (assets/props/engines/…) but the cat archives preserve the
                # original casing (assets/props/Engines/…).
                _all_raw_lower = {k.lower(): v for k, v in _all_raw.items()}
                _by_filename: dict[str, bytes] = {}
                for path, content in _all_raw.items():
                    fn = path.rsplit("/", 1)[-1]
                    _by_filename.setdefault(fn.lower(), content)

                def cached_resolver(path: str) -> bytes:
                    if path in _all_raw:
                        return _all_raw[path]
                    lower = path.lower()
                    if lower in _all_raw_lower:
                        return _all_raw_lower[lower]
                    # DLC macros use "extensions/<dlc>/assets/..." paths.
                    if path.startswith("extensions/"):
                        stripped = "/".join(path.split("/")[2:])
                        if stripped in _all_raw:
                            return _all_raw[stripped]
                        sl = stripped.lower()
                        if sl in _all_raw_lower:
                            return _all_raw_lower[sl]
                    raise KeyError(path)

                def cached_resolve_name(name: str) -> bytes:
                    key = f"{name}.xml".lower()
                    if key in _by_filename:
                        return _by_filename[key]
                    raise KeyError(name)

                run_step(
                    _progress_log,
                    "ships",
                    macros_xml,
                    lambda xml: ships.extract(xml, cached_resolver, cached_resolve_name),
                    lambda r: ships.write(conn, _localize_result(r)),
                    lambda r: f"{len(r.ships)} ships",
                )

                run_step(
                    _progress_log,
                    "equipment",
                    macros_xml,
                    lambda xml: equipment.extract(xml, cached_resolver, cached_resolve_name),
                    lambda r: equipment.write(conn, _localize_result(r)),
                    lambda r: (
                        f"{len(r.engines)} engines, {len(r.shields)} shields, "
                        f"{len(r.weapons)} weapons"
                    ),
                )

                run_step(
                    _progress_log,
                    "modules",
                    macros_xml,
                    lambda xml: modules.extract(xml, cached_resolver, cached_resolve_name),
                    lambda r: modules.write(conn, _localize_result(r)),
                    lambda r: f"{len(r.modules)} modules",
                )

                run_step(
                    _progress_log,
                    "station types",
                    macros_xml,
                    lambda xml: station_types.extract(xml, cached_resolver),
                    lambda r: station_types.write(conn, _localize_result(r)),
                    lambda r: f"{len(r.stations)} types",
                )

                t0 = time.monotonic()
                _progress_log("Computing: derived ship stats")
                ships.update_derived_stats(conn)
                _progress_log(f"  done ({_elapsed(t0)})")

            loadouts_xml = get_raw_file("libraries/loadouts.xml")
            run_step(
                _progress_log,
                "loadouts",
                loadouts_xml,
                loadouts.extract,
                lambda r: loadouts.write(conn, _localize_result(r)),
                lambda r: f"{len(r.loadouts)} loadouts",
            )

            t0 = time.monotonic()
            _progress_log("Extracting: map")
            # Collect all map files — base game + per-DLC cluster/sector/zone files.
            # Must be fetched before regions so the sector mapping can be built.
            map_rows = conn.execute(
                "SELECT filepath, content FROM raw.raw_files "
                "WHERE filepath LIKE 'maps/xu_ep2_universe/%.xml'"
            ).fetchall()
            map_xmls: dict[str, bytes] = {}
            if map_rows:
                map_xmls = {row[0].rsplit("/", 1)[-1]: row[1].encode("utf-8") for row in map_rows}

            region_xml = get_raw_file("libraries/region_definitions.xml")
            if region_xml:
                region_sector_map = regions.build_region_sector_map(map_xmls) if map_xmls else None
                regions.write(
                    conn, _localize_result(regions.extract(region_xml, region_sector_map))
                )

            if map_xmls:
                mapdefaults_xml = get_raw_file("libraries/mapdefaults.xml")
                if mapdefaults_xml:
                    map_xmls["mapdefaults.xml"] = mapdefaults_xml
                map_result = universe_map.extract(map_xmls)
                universe_map.write(conn, _localize_result(map_result))
                _progress_log(
                    f"  -> {len(map_result.clusters)} clusters, {len(map_result.sectors)} sectors ({_elapsed(t0)})"
                )

            terraform_xml = get_raw_file("libraries/terraforming.xml")
            run_step(
                _progress_log,
                "terraforming",
                terraform_xml,
                terraforming.extract,
                lambda r: terraforming.write(conn, _localize_result(r)),
                lambda r: f"{len(r.projects)} projects",
            )

            diplo_xml = get_raw_file("libraries/diplomacy.xml")
            run_step(
                _progress_log,
                "diplomacy",
                diplo_xml,
                diplomacy.extract,
                lambda r: diplomacy.write(conn, _localize_result(r)),
                lambda r: f"{len(r.actions)} actions",
            )

            t0 = time.monotonic()
            _progress_log("Extracting: gamestart stories")
            gamestarts_xml = get_raw_file("libraries/gamestarts.xml")
            if gamestarts_xml:
                gs_result = gamestarts.extract(gamestarts_xml)
                if gs_result.stories:
                    conn.execute("DELETE FROM gamestart_stories")
                    conn.executemany(
                        "INSERT INTO gamestart_stories (gamestart_id, story_ref, story_group, story_index) "
                        "VALUES (:gamestart_id, :story_ref, :story_group, :story_index)",
                        gs_result.stories,
                    )
                _progress_log(f"  -> {len(gs_result.stories)} stories ({_elapsed(t0)})")

            assign_xml = get_raw_file("libraries/assignments.xml")
            run_step(
                _progress_log,
                "assignments",
                assign_xml,
                assignments.extract,
                lambda r: assignments.write(conn, _localize_result(r)),
                lambda r: f"{len(r.rows)} assignments",
            )

            behav_xml = get_raw_file("libraries/behaviours.xml")
            run_step(
                _progress_log,
                "behaviours",
                behav_xml,
                behaviours.extract,
                lambda r: behaviours.write(conn, _localize_result(r)),
                lambda r: f"{len(r.rows)} behaviours",
            )

            roles_xml = get_raw_file("libraries/roles.xml")
            posts_xml = get_raw_file("libraries/posts.xml")
            run_step(
                _progress_log,
                "roles",
                roles_xml,
                lambda xml: roles.extract(xml, posts_xml),
                lambda r: roles.write(conn, _localize_result(r)),
                lambda r: f"{len(r.roles)} roles",
            )

            texts_xml = get_raw_file(f"t/0001-l{DEFAULT_LANGUAGE_CODE}.xml")
            run_step(
                _progress_log,
                "texts",
                texts_xml,
                texts.extract,
                lambda r: texts.write(conn, r),
                lambda r: f"{len(r.texts)} texts",
            )

            t0 = time.monotonic()
            _progress_log("Extracting: orders (aiscripts)")
            # Get all aiscript files
            ai_rows = conn.execute(
                "SELECT content FROM raw.raw_files WHERE directory = 'aiscripts'"
            ).fetchall()
            if ai_rows:
                total_orders = 0
                conn.execute("DELETE FROM orders")  # Clear table before loop
                for row in ai_rows:
                    o_result = orders.extract(row[0].encode("utf-8"))
                    if o_result.rows:
                        # localized right before insert
                        o_result = _localize_result(o_result)
                        conn.executemany(
                            "INSERT INTO orders (order_id, name) VALUES (:order_id, :name)",
                            o_result.rows,
                        )
                        total_orders += len(o_result.rows)
                _progress_log(f"  -> {total_orders} orders ({_elapsed(t0)})")

            t0 = time.monotonic()
            _progress_log("Computing: ware uses")
            conn.execute("DELETE FROM ware_uses")
            conn.execute("""
                INSERT INTO ware_uses (ware_id, use_type, use_value)
                SELECT DISTINCT wi.input_ware_id, 'category' AS use_type,
                    CASE
                        WHEN w.group_id IN ('weapons', 'turrets') THEN 'Ship Weapons'
                        WHEN w.group_id = 'shields' THEN 'Shields'
                        WHEN w.group_id = 'engines' THEN 'Engines'
                        WHEN w.group_id = 'thrusters' THEN 'Thrusters'
                        WHEN w.group_id = 'drones' THEN 'Drones'
                        WHEN w.group_id = 'missiles' THEN 'Missiles'
                        WHEN w.group_id = 'countermeasures' THEN 'Countermeasures'
                        WHEN w.group_id IN ('equipmod', 'paintmod') THEN 'Equipment Mods'
                        WHEN s.ship_id IS NOT NULL THEN 'Ships'
                        WHEN m.module_id IS NOT NULL THEN 'Station Modules'
                        WHEN ed.deployable_id IS NOT NULL THEN 'Deployables'
                    END AS use_value
                FROM ware_inputs wi
                JOIN wares w ON wi.ware_id = w.ware_id
                LEFT JOIN ships s ON w.component_ref = s.ship_id
                LEFT JOIN modules m ON w.component_ref = m.module_id
                LEFT JOIN equip_deployables ed ON w.component_ref = ed.deployable_id
                WHERE use_value IS NOT NULL

                UNION

                SELECT DISTINCT wi.input_ware_id, 'ware' AS use_type, w.ware_id AS use_value
                FROM ware_inputs wi
                JOIN wares w ON wi.ware_id = w.ware_id
                LEFT JOIN ships s ON w.component_ref = s.ship_id
                LEFT JOIN modules m ON w.component_ref = m.module_id
                LEFT JOIN equip_deployables ed ON w.component_ref = ed.deployable_id
                WHERE s.ship_id IS NULL AND m.module_id IS NULL AND ed.deployable_id IS NULL
                  AND w.group_id NOT IN ('weapons', 'turrets', 'shields', 'engines', 'thrusters', 'drones', 'missiles', 'countermeasures', 'equipmod', 'paintmod')
            """)
            _progress_log(f"  done ({_elapsed(t0)})")
    finally:
        conn.close()

    _progress_log("All done.")
