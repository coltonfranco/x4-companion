"""Extract named loadout presets from `libraries/loadouts.xml`.

A loadout assigns specific equipment macros to named slots on a ship. Loadouts are
used for game starts, tutorial ships, and NPC ship configurations. The data here
answers: "what does this ship class come equipped with out of the factory?"

This same schema (see `docs/xml_schemas/loadouts_schema.md`) is reused verbatim by
the player's own saved equipment loadouts, written by the game to a `loadouts.xml`
sibling of the save folder (not inside it, and not in the game archives) — see
`x4_extract/dynamic/custom_loadouts.py`, which imports `extract()` from here rather
than reimplementing this parse.

Structure:
  <loadout id="..." macro="ship_...">
    <macros>
      <engine|shield|weapon|turret macro="..." path="..." optional="1"/>
    </macros>
    <groups>
      <shields|turrets macro="..." group="..." min="N" max="N" exact="N" optional="1"/>
    </groups>
    <virtualmacros>
      <thruster macro="..." />
    </virtualmacros>
    <software>
      <software ware="software_..." />
    </software>
    <ammunition>
      <ammunition macro="..." exact="N" optional="1"/>
    </ammunition>
  </loadout>
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from typing import Any

from lxml import etree

from x4_extract.parsing import attr_flag, str_int

_MACRO_SLOTS = {"engine", "shield", "weapon", "turret", "missilelauncher", "bomblauncher"}
_GROUP_SLOTS = {"shields": "shield", "turrets": "turret"}


@dataclass(slots=True)
class ExtractResult:
    loadouts: list[dict[str, Any]] = field(default_factory=list)
    equipment: list[dict[str, Any]] = field(default_factory=list)


def extract(xml_bytes: bytes) -> ExtractResult:
    """Parse loadouts.xml bytes into loadout + equipment rows. Pure function — no I/O."""
    root = etree.fromstring(xml_bytes)
    out = ExtractResult()

    for lo_el in root.iterfind("loadout"):
        loadout_id = lo_el.get("id")
        ship_macro = lo_el.get("macro")
        if not loadout_id or not ship_macro:
            continue

        out.loadouts.append(
            {
                "loadout_id": loadout_id,
                "ship_macro": ship_macro,
                "name": lo_el.get("name"),
                "description": lo_el.get("description"),
            }
        )

        def _append(
            *,
            slot_path: str | None,
            macro: str,
            kind: str,
            optional: int = 0,
            quantity: int | None = None,
            weaponmode: str | None = None,
            ammunition: str | None = None,
            loadout_id: str = loadout_id,
        ) -> None:
            out.equipment.append(
                {
                    "loadout_id": loadout_id,
                    "slot_path": slot_path,
                    "macro": macro,
                    "kind": kind,
                    "optional": optional,
                    "quantity": quantity,
                    "weaponmode": weaponmode,
                    "ammunition": ammunition,
                }
            )

        for slot_el in lo_el.iterfind("macros/*"):
            kind = slot_el.tag
            if kind not in _MACRO_SLOTS:
                continue
            macro = slot_el.get("macro")
            if not macro:
                continue
            _append(
                slot_path=slot_el.get("path"),
                macro=macro,
                kind=kind,
                optional=attr_flag(slot_el, "optional", "1"),
                weaponmode=slot_el.get("weaponmode"),
                ammunition=slot_el.get("ammunition"),
            )

        # <groups> covers the connection-group system large/XL ships use for their
        # secondary shields/turrets — a named group can hold several identical units,
        # counted by @exact (a fixed loadout) or @min/@max (a designer-authored range).
        # We take the richest concrete number the group specifies, falling back to 1.
        for group_el in lo_el.iterfind("groups/*"):
            group_kind = _GROUP_SLOTS.get(group_el.tag)
            if group_kind is None:
                continue
            macro = group_el.get("macro")
            if not macro:
                continue
            quantity = (
                str_int(group_el.get("exact"))
                or str_int(group_el.get("max"))
                or str_int(group_el.get("min"))
                or 1
            )
            _append(
                slot_path=group_el.get("group"),
                macro=macro,
                kind=group_kind,
                optional=attr_flag(group_el, "optional", "1"),
                quantity=quantity,
            )

        for thr_el in lo_el.iterfind("virtualmacros/thruster"):
            macro = thr_el.get("macro")
            if macro:
                _append(slot_path=None, macro=macro, kind="thruster")

        for sw_el in lo_el.iterfind("software/software"):
            ware = sw_el.get("ware")
            if ware:
                _append(slot_path=None, macro=ware, kind="software")

        for ammo_el in lo_el.iterfind("ammunition/ammunition"):
            macro = ammo_el.get("macro")
            if not macro:
                continue
            _append(
                slot_path=None,
                macro=macro,
                kind="ammunition",
                optional=attr_flag(ammo_el, "optional", "1"),
                quantity=str_int(ammo_el.get("exact")),
            )

    return out


def write(conn: sqlite3.Connection, result: ExtractResult) -> None:
    conn.execute("DELETE FROM loadout_equipment")
    conn.execute("DELETE FROM loadouts")
    if result.loadouts:
        conn.executemany(
            "INSERT INTO loadouts (loadout_id, ship_macro, name, description) "
            "VALUES (:loadout_id, :ship_macro, :name, :description)",
            result.loadouts,
        )
    if result.equipment:
        conn.executemany(
            "INSERT INTO loadout_equipment (loadout_id, slot_path, macro, kind, optional, quantity, weaponmode, ammunition) "
            "VALUES (:loadout_id, :slot_path, :macro, :kind, :optional, :quantity, :weaponmode, :ammunition)",
            result.equipment,
        )
