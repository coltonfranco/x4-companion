"""Extract NPC and buildable station type definitions (macro class="station").

Station macros define the top-level objects that appear on the galaxy map as named
locations: wharfs, shipyards, trading stations, equipment docks, etc. Environmental
objects (asteroid turrets, derelicts) also carry class="station" but have no build
sets — they are excluded by the presence check on <build><sets>.

Parsed from macros.xml index + individual macro files, same pattern as ships/modules.
"""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from lxml import etree

from x4_extract.parsing import opt_attr
from x4_extract.parsing import xml_attr_bool as _bool_attr
from x4_extract.parsing import xml_attr_int as _int
from x4_extract.static.macro_index import iter_index_macros


@dataclass(slots=True)
class ExtractResult:
    stations: list[dict[str, Any]] = field(default_factory=list)


def extract(
    index_bytes: bytes,
    resolve_path: Callable[[str], bytes],
) -> ExtractResult:
    out = ExtractResult()
    for name, xml_path, macro_el in iter_index_macros(
        index_bytes, resolve_path, class_filter={"station"}, dedupe=True
    ):
        _parse_station(name, xml_path, macro_el, out)
    return out


def _parse_station(
    macro_name: str,
    file_path: str,
    macro_el: etree._Element,
    out: ExtractResult,
) -> None:
    ident_el = macro_el.find("properties/identification")
    hull_el = macro_el.find("properties/hull")
    workforce_el = macro_el.find("properties/workforce")
    dock_el = macro_el.find("properties/dock")
    docksize_el = macro_el.find("properties/docksize")
    equip_el = macro_el.find("properties/equip")
    supply_el = macro_el.find("properties/supply")
    prod_el = macro_el.find("properties/production")
    secrecy_el = macro_el.find("properties/secrecy")
    ownership_el = macro_el.find("properties/ownership")
    storage_el = macro_el.find("properties/storage")
    cargo_el = macro_el.find("properties/cargo")

    sets = [s.get("ref") for s in macro_el.iterfind("properties/build/sets/set") if s.get("ref")]

    # Skip pure environmental objects that carry no build context
    if not sets and ident_el is None:
        return

    out.stations.append(
        {
            "station_id": macro_name,
            "name": opt_attr(ident_el, "name"),
            "file_path": file_path,
            "makerrace": opt_attr(ident_el, "makerrace"),
            "description": opt_attr(ident_el, "description"),
            "icon": opt_attr(ident_el, "icon"),
            "hull": _int(hull_el, "max"),
            "hull_integrated": _bool_attr(hull_el, "integrated"),
            "workforce_max": _int(workforce_el, "max")
            if _int(workforce_el, "max") is not None
            else _int(workforce_el, "capacity"),
            "workforce_race": opt_attr(workforce_el, "race"),
            "drone_capacity": _int(storage_el, "unit"),
            "storage_capacity": _int(cargo_el, "max") if cargo_el is not None else None,
            "storage_type": opt_attr(cargo_el, "tags"),
            "dock_allow": _bool_attr(dock_el, "allow") if dock_el is not None else None,
            "dock_allowtrade": _bool_attr(dock_el, "allowtrade") if dock_el is not None else None,
            "dock_allowbuild": _bool_attr(dock_el, "allowbuild") if dock_el is not None else None,
            "dock_external": _bool_attr(dock_el, "external") if dock_el is not None else None,
            "dock_playeronly": _bool_attr(dock_el, "playeronly") if dock_el is not None else None,
            "dock_size_tags": opt_attr(docksize_el, "tags"),
            "equip_classes": opt_attr(equip_el, "classes"),
            "supply_classes": opt_attr(supply_el, "classes"),
            "production_research": _bool_attr(prod_el, "research") if prod_el is not None else None,
            "secrecy_level": _int(secrecy_el, "level") if secrecy_el is not None else None,
            "ownership_claim": _bool_attr(ownership_el, "claim")
            if ownership_el is not None
            else None,
            "build_sets": json.dumps(sets) if sets else None,
        }
    )


def write(conn: sqlite3.Connection, result: ExtractResult) -> None:
    conn.execute("DELETE FROM station_types")
    if result.stations:
        conn.executemany(
            "INSERT INTO station_types (station_id, name, file_path, makerrace, description, icon,"
            "  hull, hull_integrated, workforce_max, workforce_race,"
            "  drone_capacity, storage_capacity, storage_type,"
            "  dock_allow, dock_allowtrade, dock_allowbuild, dock_external, dock_playeronly, dock_size_tags,"
            "  equip_classes, supply_classes, production_research,"
            "  secrecy_level, ownership_claim, build_sets) "
            "VALUES (:station_id, :name, :file_path, :makerrace, :description, :icon,"
            "  :hull, :hull_integrated, :workforce_max, :workforce_race,"
            "  :drone_capacity, :storage_capacity, :storage_type,"
            "  :dock_allow, :dock_allowtrade, :dock_allowbuild, :dock_external, :dock_playeronly, :dock_size_tags,"
            "  :equip_classes, :supply_classes, :production_research,"
            "  :secrecy_level, :ownership_claim, :build_sets)",
            result.stations,
        )
