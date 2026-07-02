"""Extract `libraries/races.xml` into the `races` table.

Each race defines shared attributes for all factions of that lineage:
display names, character physics, engine trail colours, inter-race
diplomacy, and spacesuit references.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from typing import Any

from lxml import etree

from x4_extract.parsing import opt_attr
from x4_extract.parsing import xml_attr_float as _float
from x4_extract.parsing import xml_attr_int as _int
from x4_extract.static.map import _dedup
from x4_extract.static.relations import parse_relation_rows


@dataclass(slots=True)
class ExtractResult:
    races: list[dict[str, Any]] = field(default_factory=list)
    race_relations: list[dict[str, Any]] = field(default_factory=list)


def extract(xml_bytes: bytes) -> ExtractResult:
    root = etree.fromstring(xml_bytes)
    out = ExtractResult()

    for race_el in root.iterfind("race"):
        race_id = race_el.get("id")
        if not race_id:
            continue

        char_el = race_el.find("character")
        speed_el = char_el.find("speed") if char_el is not None else None
        event_el = char_el.find("eventmonitor") if char_el is not None else None
        suit_el = char_el.find("spacesuit") if char_el is not None else None
        icon_el = race_el.find("icon")
        agent_el = race_el.find("agent")
        agent_icon_el = agent_el.find("icon") if agent_el is not None else None
        trail_el = race_el.find("trail")
        engine_el = race_el.find("engineeffect")
        chair_el = race_el.find("chair")

        out.races.append(
            {
                "race_id": race_id,
                "name": race_el.get("name"),
                "description": race_el.get("description"),
                "shortname": race_el.get("shortname"),
                "spacename": race_el.get("spacename"),
                "homespacename": race_el.get("homespacename"),
                "names_table": _int(race_el, "names"),
                "tags": race_el.get("tags"),
                # Character
                "char_height": _float(char_el, "height"),
                "char_walk_speed": _float(speed_el, "walk"),
                "char_run_speed": _float(speed_el, "run"),
                "char_slow_walk": _float(speed_el, "slowwalk"),
                "char_acceleration": _float(speed_el, "acceleration"),
                "char_spacesuit_ref": opt_attr(suit_el, "ref"),
                "event_adjust_y": _float(event_el, "adjusty"),
                "event_adjust_z": _float(event_el, "adjustz"),
                "event_face_key": opt_attr(event_el, "facecutscenekey"),
                # Icons
                "icon_active": opt_attr(icon_el, "active"),
                "icon_inactive": opt_attr(icon_el, "inactive"),
                # Agent
                "agent_icon_male": opt_attr(agent_icon_el, "id"),
                "agent_icon_female": agent_icon_el.get("female")
                if agent_icon_el is not None
                else None,
                # Engine trail
                "trail_brightness": _float(trail_el, "brightness"),
                "trail_contrast": _float(trail_el, "contrast"),
                "trail_saturation": _float(trail_el, "saturation"),
                "trail_hue": _int(trail_el, "hue"),
                # Engine effect
                "engine_color_index": _int(engine_el, "colorindex"),
                # Chair
                "chair_ref": opt_attr(chair_el, "ref"),
            }
        )

        def _relation_row(other: str, rel: float, race_id: str = race_id) -> dict[str, Any]:
            return {"race_id": race_id, "other_race_id": other, "relation": rel}

        out.race_relations.extend(
            parse_relation_rows(race_el, other_attr="race", row_factory=_relation_row)
        )

    # Deduplicate (just in case DLC merges produce duplicates)
    _dedup(out.race_relations, ("race_id", "other_race_id"))

    return out


def write(conn: sqlite3.Connection, result: ExtractResult) -> None:
    conn.execute("DELETE FROM race_relations")
    conn.execute("DELETE FROM races")
    conn.executemany(
        """INSERT INTO races (
            race_id, name, description, shortname, spacename, homespacename,
            names_table, tags,
            char_height, char_walk_speed, char_run_speed, char_slow_walk,
            char_acceleration, char_spacesuit_ref,
            event_adjust_y, event_adjust_z, event_face_key,
            icon_active, icon_inactive,
            agent_icon_male, agent_icon_female,
            trail_brightness, trail_contrast, trail_saturation, trail_hue,
            engine_color_index, chair_ref
        ) VALUES (
            :race_id, :name, :description, :shortname, :spacename, :homespacename,
            :names_table, :tags,
            :char_height, :char_walk_speed, :char_run_speed, :char_slow_walk,
            :char_acceleration, :char_spacesuit_ref,
            :event_adjust_y, :event_adjust_z, :event_face_key,
            :icon_active, :icon_inactive,
            :agent_icon_male, :agent_icon_female,
            :trail_brightness, :trail_contrast, :trail_saturation, :trail_hue,
            :engine_color_index, :chair_ref
        )""",
        result.races,
    )
    if result.race_relations:
        conn.executemany(
            "INSERT INTO race_relations (race_id, other_race_id, relation) "
            "VALUES (:race_id, :other_race_id, :relation)",
            result.race_relations,
        )
