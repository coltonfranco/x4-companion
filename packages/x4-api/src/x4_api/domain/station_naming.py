"""Resolve the in-game display name for NPC stations that carry no explicit ``name``.

Most procedurally-placed stations have an empty ``stations.name`` in the save; the
game client composes what the player actually sees from two other columns instead:

- ``basename`` — a ``{page_id,text_id}`` reference into the static text tables. For
  "type" stations (defence platforms, shipyards, wharves, trading stations, HQs...)
  this resolves to a race-flavoured template, e.g. ``"Argon Defence Platform"``. A
  handful of unique/story stations also use ``basename`` and resolve straight to a
  complete proper name (``"Hall of Judgement"``) that should NOT get a faction prefix.
- ``nameindex`` — a per-type serial number, rendered as a roman numeral. Ordinary
  production stations (factories) carry a ``nameindex`` but no ``basename`` at all;
  the save doesn't record which text the client would use for these, so we approximate
  it from the station's best-selling ware and that ware's group (``s.ware_groups
  .factory_name``, e.g. "Claytronics" + "Factory", or the bare group name for stations
  spanning several wares of one group, e.g. "Refined Goods Complex").

Faction prefixing (``ANT Argon Defence Platform``) uses the owning faction's
``short_name`` and only applies to the generic "type" templates — not to unique names,
which already read as complete proper nouns in game.
"""

from __future__ import annotations

import re
import sqlite3
from collections.abc import Sequence
from dataclasses import dataclass

_TEXT_REF = re.compile(r"^\{(\d+),(\d+)\}$")

# Basenames ending in one of these are generic per-race/per-faction templates and get
# the owning faction's short name prefixed. Anything else ("Hall of Judgement",
# "Woodworm Scrubs") is already a complete unique name, shown as-is.
_GENERIC_SUFFIXES = (
    "Defence Platform", "Shipyard", "Wharf", "Trading Station",
    "Equipment Dock", "Headquarters", "Pirate Base",
)

# Most "type" stations (defence platforms, shipyards, wharves, trading stations...) for
# every non-Xenon faction share one generic macro (`station_gen_factory_base_01_macro`)
# indistinguishable from an ordinary factory — the macro carries no function info at all.
# The basename text is the only reliable signal, so map it straight to the map/UI
# category instead of trusting the macro-derived category for these stations.
_SUFFIX_CATEGORY = {
    "Defence Platform": "defence",
    "Shipyard": "shipyard",
    "Wharf": "wharf",
    "Trading Station": "tradestation",
    "Equipment Dock": "equipmentdock",
    "Headquarters": "headquarters",
    "Pirate Base": "piratebase",
}


def _match_suffix(name: str) -> str | None:
    for suf in _GENERIC_SUFFIXES:
        if name.endswith(suf):
            return suf
    return None

_ROMAN_TABLE = (
    (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
    (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
    (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
)


def roman_numeral(n: int) -> str:
    if n <= 0:
        return str(n)
    parts: list[str] = []
    for value, symbol in _ROMAN_TABLE:
        count, n = divmod(n, value)
        parts.append(symbol * count)
    return "".join(parts)


def _resolve_text_ref(conn: sqlite3.Connection, ref: str | None) -> str | None:
    """Resolve a `{page,text_id}` reference, following one level of indirection
    (a few refs point to another ref instead of literal text)."""
    for _ in range(2):
        if not ref:
            return None
        m = _TEXT_REF.match(ref)
        if not m:
            return ref
        row = conn.execute(
            "SELECT text FROM s.texts WHERE page_id = ? AND text_id = ?",
            (int(m.group(1)), int(m.group(2))),
        ).fetchone()
        ref = row["text"] if row else None
    return ref


@dataclass(slots=True)
class StationName:
    name: str
    icon_group: str | None = None  # ware group_id, for factory-type icon selection
    category: str | None = None  # overrides the macro-derived category (see _SUFFIX_CATEGORY)


def _is_factory_macro(macro: str | None) -> bool:
    if not macro:
        return False
    return macro.lower().endswith("factory_base_01_macro")


def _short_name(short_names: dict[str, str], owner_faction: object) -> str | None:
    if not isinstance(owner_faction, str):
        return None
    return short_names.get(owner_faction)


def bulk_resolve_station_names(
    conn: sqlite3.Connection,
    stations: Sequence[sqlite3.Row],
) -> dict[str, StationName]:
    """station_id → resolved/corrected name (+ icon group) for stations whose raw
    ``name`` isn't what the game client shows.

    Each input row needs: station_id, name, basename, nameindex, owner_faction, macro
    — `sqlite3.Row` or `dict` both work. Two cases are handled:

    - ``name`` is already populated with the race-flavoured template text (ingestion
      resolves ``basename`` to text but doesn't add the faction prefix) — just prefix
      it, no further lookups needed.
    - ``name`` is empty (ordinary factories, and any basename ingestion missed) —
      resolve from scratch via ``basename``/``nameindex``/best-selling ware.

    Stations that already have a complete unique name (no generic suffix, e.g. "Hall
    of Judgement"), or that can't be resolved (e.g. a factory that hasn't sold
    anything yet), are omitted from the result — callers fall back to the existing
    name / station code.
    """
    rows = [dict(s) for s in stations]
    if not rows:
        return {}

    owner_ids = {r["owner_faction"] for r in rows if r.get("owner_faction")}
    short_names: dict[str, str] = {}
    if owner_ids:
        placeholders = ",".join("?" for _ in owner_ids)
        for r in conn.execute(
            f"SELECT faction_id, short_name FROM s.factions WHERE faction_id IN ({placeholders})",
            list(owner_ids),
        ):
            if r["short_name"]:
                short_names[r["faction_id"]] = r["short_name"]

    out: dict[str, StationName] = {}

    # ── already-named generic templates — missing the faction prefix and/or a real
    # category (their shared macro can't tell a defence platform from a factory) ──
    for r in rows:
        name = r.get("name")
        if not name:
            continue
        suffix = _match_suffix(name)
        if not suffix:
            continue
        category = _SUFFIX_CATEGORY.get(suffix)
        prefix = _short_name(short_names, r.get("owner_faction"))
        if prefix and not name.startswith(f"{prefix} "):
            name = f"{prefix} {name}"
        out[r["station_id"]] = StationName(name=name, category=category)

    # ── everything else needing full resolution ──
    candidates = [r for r in rows if not r.get("name")]
    if not candidates:
        return out

    # ── basename-driven (defence platforms, shipyards, wharves, unique stations) ──
    basename_stations = [s for s in candidates if s.get("basename")]
    text_cache: dict[str, str | None] = {}
    for s in basename_stations:
        basename = s["basename"]
        if basename not in text_cache:
            text_cache[basename] = _resolve_text_ref(conn, basename)
        base_text = text_cache[basename]
        if not base_text:
            continue
        name = base_text
        category = None
        suffix = _match_suffix(base_text)
        if suffix:
            category = _SUFFIX_CATEGORY.get(suffix)
            prefix = _short_name(short_names, s.get("owner_faction"))
            if prefix:
                name = f"{prefix} {name}"
        nameindex = s.get("nameindex")
        if nameindex:
            name = f"{name} {roman_numeral(int(nameindex))}"
        out[s["station_id"]] = StationName(name=name, category=category)

    # ── factory-type (no basename, has a nameindex) — named after what they sell ──
    factory_stations = [
        s for s in candidates
        if not s.get("basename") and s.get("nameindex") is not None and _is_factory_macro(s.get("macro"))
    ]
    if factory_stations:
        ids = [s["station_id"] for s in factory_stations]
        placeholders = ",".join("?" for _ in ids)
        offer_rows = conn.execute(
            f"""
            SELECT so.station_id, w.ware_id, w.name AS ware_name, w.group_id, so.quantity
            FROM station_offers so
            JOIN s.wares w ON w.ware_id = so.ware_id
            WHERE so.side = 'sell' AND so.station_id IN ({placeholders})
            ORDER BY so.station_id, so.quantity DESC
            """,
            ids,
        ).fetchall()

        by_station: dict[str, list[sqlite3.Row]] = {}
        for r in offer_rows:
            by_station.setdefault(r["station_id"], []).append(r)

        group_ids = {r["group_id"] for r in offer_rows if r["group_id"]}
        factory_names: dict[str, str] = {}
        if group_ids:
            placeholders2 = ",".join("?" for _ in group_ids)
            for r in conn.execute(
                f"SELECT group_id, factory_name FROM s.ware_groups WHERE group_id IN ({placeholders2})",
                list(group_ids),
            ):
                if r["factory_name"]:
                    factory_names[r["group_id"]] = r["factory_name"]

        for s in factory_stations:
            sid = s["station_id"]
            offers = by_station.get(sid)
            if not offers:
                continue
            dominant = offers[0]
            group_id = dominant["group_id"]
            group_factory_name = factory_names.get(group_id) if group_id else None
            if not group_factory_name:
                continue
            distinct_wares = {r["ware_id"] for r in offers}
            if len(distinct_wares) == 1:
                suffix = group_factory_name.rsplit(" ", 1)[-1]
                name = f"{dominant['ware_name']} {suffix}"
            else:
                name = group_factory_name
            prefix = _short_name(short_names, s.get("owner_faction"))
            if prefix:
                name = f"{prefix} {name}"
            nameindex = s.get("nameindex")
            if nameindex:
                name = f"{name} {roman_numeral(int(nameindex))}"
            out[sid] = StationName(name=name, icon_group=group_id)

    return out
