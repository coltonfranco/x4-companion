"""Faction standing indices derived from the active save.

The API route owns visibility/filter policy; this module owns the scoring math and
breakdown data used by both standings lists and detail tooltips.
"""

from __future__ import annotations

import math
import sqlite3
from dataclasses import dataclass

from x4_api.domain.station_naming import bulk_resolve_station_names


@dataclass(slots=True, frozen=True)
class FactionIdentity:
    faction_id: str
    name: str
    color_hex: str | None


@dataclass(slots=True, frozen=True)
class StrengthComponent:
    label: str
    value: float
    detail: str


@dataclass(slots=True, frozen=True)
class StrengthBreakdown:
    raw: float
    leader_raw: float
    leader_ratio: float
    components: list[StrengthComponent]


@dataclass(slots=True, frozen=True)
class FactionStrength:
    faction_id: str
    name: str
    color_hex: str | None
    military_score: float
    economic_score: float
    diplomatic_score: float
    territory_score: float
    military: StrengthBreakdown
    economic: StrengthBreakdown
    territory: StrengthBreakdown
    diplomacy: StrengthBreakdown
    fight_ship_count: int
    trade_ship_count: int
    mine_ship_count: int
    military_station_count: int
    economic_station_count: int
    sector_count: int
    cluster_count: int
    avg_relation: float


@dataclass(slots=True, frozen=True)
class _TerritoryInfo:
    stations: int
    sectors: int
    clusters: int
    avg_econ: float


@dataclass(slots=True, frozen=True)
class _StrengthParts:
    faction_id: str
    name: str
    color_hex: str | None
    military_raw: float
    economic_raw: float
    territory_raw: float
    diplomatic_raw: float
    military_components: list[StrengthComponent]
    economic_components: list[StrengthComponent]
    territory_components: list[StrengthComponent]
    diplomacy_components: list[StrengthComponent]
    fight_ship_count: int
    trade_ship_count: int
    mine_ship_count: int
    military_station_count: int
    economic_station_count: int
    sector_count: int
    cluster_count: int
    avg_relation: float


_CLASS_MULT = {"s": 1, "m": 2, "l": 4, "xl": 8, "xs": 1}
_ECON_MULT = {"s": 1, "m": 2, "l": 3, "xl": 4, "xs": 1}
_MIN_DISPLAY_RELATION = 0.001
_STATION_CATEGORY_MARKERS = (
    ("shipyard", "shipyard"),
    ("wharf", "wharf"),
    ("equipmentdock", "equipmentdock"),
    ("tradestation", "tradestation"),
    ("headquarters", "headquarters"),
    ("defence", "defence"),
    ("defense", "defence"),
    ("piratebase", "piratebase"),
    ("piratestation", "piratebase"),
    ("factory", "factory"),
)


def compute_faction_strength(
    conn: sqlite3.Connection,
    factions: list[FactionIdentity],
) -> list[FactionStrength]:
    """Calculate live faction strength rows for an already-filtered faction roster."""
    mil_rows = conn.execute("""
        SELECT sh.owner_faction AS faction_id, c.class_id, COUNT(*) AS cnt
        FROM ships sh JOIN s.ships c ON c.ship_id = sh.macro
        WHERE c.role = 'fight' AND sh.owner_faction IS NOT NULL
        GROUP BY sh.owner_faction, c.class_id
    """).fetchall()

    econ_ship_rows = conn.execute("""
        SELECT sh.owner_faction AS faction_id, c.role, c.class_id, COUNT(*) AS cnt
        FROM ships sh JOIN s.ships c ON c.ship_id = sh.macro
        WHERE c.role IN ('trade','mine','build','auxiliary') AND sh.owner_faction IS NOT NULL
        GROUP BY sh.owner_faction, c.role, c.class_id
    """).fetchall()

    territory_rows = conn.execute("""
        SELECT st.owner_faction AS faction_id,
               COUNT(*) AS stations,
               COUNT(DISTINCT st.sector_id) AS sectors,
               COUNT(DISTINCT sec.cluster_id) AS clusters,
               COALESCE(AVG(sec.economy), 0.5) AS avg_econ
        FROM stations st
        LEFT JOIN s.sectors sec ON LOWER(sec.sector_id) = LOWER(st.sector_id)
        WHERE st.owner_faction IS NOT NULL
        GROUP BY st.owner_faction
    """).fetchall()

    relation_rows = conn.execute("""
        SELECT faction_id, relation FROM faction_relations_current
    """).fetchall()

    mil_weighted: dict[str, float] = {}
    fight_counts: dict[str, int] = {}
    fight_class_counts: dict[str, dict[str, int]] = {}
    for r in mil_rows:
        class_id = (r["class_id"] or "").lower()
        fid = r["faction_id"]
        mil_weighted[fid] = mil_weighted.get(fid, 0.0) + r["cnt"] * _CLASS_MULT.get(class_id, 1)
        fight_counts[fid] = fight_counts.get(fid, 0) + r["cnt"]
        class_counts = fight_class_counts.setdefault(fid, {})
        class_counts[class_id] = class_counts.get(class_id, 0) + r["cnt"]

    econ_ship_weighted: dict[str, float] = {}
    trade_counts: dict[str, int] = {}
    mine_counts: dict[str, int] = {}
    econ_class_counts: dict[str, dict[str, int]] = {}
    for r in econ_ship_rows:
        class_id = (r["class_id"] or "").lower()
        fid = r["faction_id"]
        econ_ship_weighted[fid] = (
            econ_ship_weighted.get(fid, 0.0) + r["cnt"] * _ECON_MULT.get(class_id, 1)
        )
        class_counts = econ_class_counts.setdefault(fid, {})
        class_counts[class_id] = class_counts.get(class_id, 0) + r["cnt"]
        if r["role"] == "trade":
            trade_counts[fid] = trade_counts.get(fid, 0) + r["cnt"]
        elif r["role"] == "mine":
            mine_counts[fid] = mine_counts.get(fid, 0) + r["cnt"]

    station_counts = _station_counts_by_faction(conn)
    territory_by_faction = {
        r["faction_id"]: _TerritoryInfo(
            stations=int(r["stations"] or 0),
            sectors=int(r["sectors"] or 0),
            clusters=int(r["clusters"] or 0),
            avg_econ=float(r["avg_econ"] or 0.5),
        )
        for r in territory_rows
    }
    relation_totals, relation_tier_counts = _relation_summaries(relation_rows)

    rows: list[_StrengthParts] = []
    for faction in factions:
        fid = faction.faction_id
        terr = territory_by_faction.get(fid, _TerritoryInfo(0, 0, 0, 0.5))
        sec_cnt = terr.sectors
        clus_cnt = terr.clusters
        station_cnt = terr.stations
        avg_econ = terr.avg_econ
        rep_total, tier_total, relation_count = relation_totals.get(fid, (-30, -2, 1))
        avg_reputation = rep_total / relation_count
        avg_tier = tier_total / relation_count

        station_count_by_category = station_counts.get(fid, {})
        defence_station_power = station_count_by_category.get("defence", 0) * 15.0
        shipbuilding_power = (
            station_count_by_category.get("wharf", 0) * 30.0
            + station_count_by_category.get("shipyard", 0) * 45.0
        )
        combat_ship_power = mil_weighted.get(fid, 0.0)

        production_power = (
            station_count_by_category.get("factory", 0) * 10.0
            + station_count_by_category.get("wharf", 0) * 25.0
            + station_count_by_category.get("shipyard", 0) * 35.0
        )
        trade_infra_power = (
            station_count_by_category.get("tradestation", 0) * 12.0
            + station_count_by_category.get("equipmentdock", 0) * 15.0
        )
        econ_ship_power = econ_ship_weighted.get(fid, 0.0) * 0.8
        sector_economy_power = sec_cnt * avg_econ * 5.0

        rows.append(
            _StrengthParts(
                faction_id=fid,
                name=faction.name,
                color_hex=faction.color_hex,
                military_raw=combat_ship_power + defence_station_power + shipbuilding_power,
                economic_raw=(
                    production_power + trade_infra_power + econ_ship_power + sector_economy_power
                ),
                territory_raw=float(sec_cnt + clus_cnt * 2),
                diplomatic_raw=round((avg_tier + 2.0) / 4.0 * 100.0, 1),
                military_components=[
                    _component(
                        "Combat ship power",
                        combat_ship_power,
                        _class_count_summary(fight_class_counts.get(fid, {})),
                    ),
                    _component(
                        "Defensive stations",
                        defence_station_power,
                        _station_count_summary(
                            {"defence": station_count_by_category.get("defence", 0)}
                        ),
                    ),
                    _component(
                        "Shipbuilding assets",
                        shipbuilding_power,
                        _station_count_summary(
                            {
                                "wharf": station_count_by_category.get("wharf", 0),
                                "shipyard": station_count_by_category.get("shipyard", 0),
                            }
                        ),
                    ),
                ],
                economic_components=[
                    _component(
                        "Production stations",
                        production_power,
                        _station_count_summary(
                            {
                                "factory": station_count_by_category.get("factory", 0),
                                "wharf": station_count_by_category.get("wharf", 0),
                                "shipyard": station_count_by_category.get("shipyard", 0),
                            }
                        ),
                    ),
                    _component(
                        "Trade infrastructure",
                        trade_infra_power,
                        _station_count_summary(
                            {
                                "tradestation": station_count_by_category.get("tradestation", 0),
                                "equipmentdock": station_count_by_category.get(
                                    "equipmentdock",
                                    0,
                                ),
                            }
                        ),
                    ),
                    _component(
                        "Economic ships",
                        econ_ship_power,
                        f"{trade_counts.get(fid, 0)} traders - {mine_counts.get(fid, 0)} miners - "
                        f"{_class_count_summary(econ_class_counts.get(fid, {}))}",
                    ),
                    _component(
                        "Sector economy bonus",
                        sector_economy_power,
                        f"{sec_cnt} sectors - avg economy {avg_econ:.2f}",
                    ),
                ],
                territory_components=[
                    _component("Sector presence", float(sec_cnt), f"{sec_cnt} sectors with owned stations"),
                    _component("Cluster presence", float(clus_cnt * 2), f"{clus_cnt} clusters x 2"),
                ],
                diplomacy_components=[
                    _component(label, float(count), f"{count} relationships")
                    for label, count in relation_tier_counts.get(fid, {"Hostile": 1}).items()
                ],
                fight_ship_count=fight_counts.get(fid, 0),
                trade_ship_count=trade_counts.get(fid, 0),
                mine_ship_count=mine_counts.get(fid, 0),
                military_station_count=(
                    station_count_by_category.get("defence", 0)
                    + station_count_by_category.get("wharf", 0)
                    + station_count_by_category.get("shipyard", 0)
                ),
                economic_station_count=station_cnt,
                sector_count=sec_cnt,
                cluster_count=clus_cnt,
                avg_relation=round(avg_reputation, 1),
            )
        )

    leader_raw = {
        "military": max((r.military_raw for r in rows), default=1.0) or 1.0,
        "economic": max((r.economic_raw for r in rows), default=1.0) or 1.0,
        "territory": max((r.territory_raw for r in rows), default=1.0) or 1.0,
        "diplomacy": max((r.diplomatic_raw for r in rows), default=1.0) or 1.0,
    }
    out: list[FactionStrength] = []
    for r in rows:
        military_score = _score(r.military_raw, leader_raw["military"])
        economic_score = _score(r.economic_raw, leader_raw["economic"])
        territory_score = _score(r.territory_raw, leader_raw["territory"])
        diplomatic_score = r.diplomatic_raw
        out.append(
            FactionStrength(
                faction_id=r.faction_id,
                name=r.name,
                color_hex=r.color_hex,
                military_score=military_score,
                economic_score=economic_score,
                diplomatic_score=diplomatic_score,
                territory_score=territory_score,
                military=_breakdown(r.military_raw, leader_raw["military"], r.military_components),
                economic=_breakdown(r.economic_raw, leader_raw["economic"], r.economic_components),
                territory=_breakdown(r.territory_raw, leader_raw["territory"], r.territory_components),
                diplomacy=_breakdown(diplomatic_score, leader_raw["diplomacy"], r.diplomacy_components),
                fight_ship_count=r.fight_ship_count,
                trade_ship_count=r.trade_ship_count,
                mine_ship_count=r.mine_ship_count,
                military_station_count=r.military_station_count,
                economic_station_count=r.economic_station_count,
                sector_count=r.sector_count,
                cluster_count=r.cluster_count,
                avg_relation=r.avg_relation,
            )
        )
    return out


def _station_counts_by_faction(conn: sqlite3.Connection) -> dict[str, dict[str, int]]:
    station_rows = conn.execute("""
        SELECT station_id, name, macro, owner_faction, basename, nameindex
        FROM stations
        WHERE owner_faction IS NOT NULL
    """).fetchall()
    resolved_stations = bulk_resolve_station_names(conn, station_rows)
    out: dict[str, dict[str, int]] = {}
    for r in station_rows:
        fid = r["owner_faction"]
        category = _station_category_from_macro(r["macro"])
        resolved = resolved_stations.get(r["station_id"])
        if resolved and resolved.category:
            category = resolved.category
        counts = out.setdefault(fid, {})
        category = category or "factory"
        counts[category] = counts.get(category, 0) + 1
    return out


def _relation_summaries(
    relation_rows: list[sqlite3.Row],
) -> tuple[dict[str, tuple[int, int, int]], dict[str, dict[str, int]]]:
    totals: dict[str, tuple[int, int, int]] = {}
    tier_counts: dict[str, dict[str, int]] = {}
    tier_labels = {-2: "Hostile", -1: "Unfriendly", 0: "Neutral", 1: "Friendly", 2: "Allied"}
    for r in relation_rows:
        fid = r["faction_id"]
        reputation = _display_reputation(float(r["relation"]))
        tier = _diplomacy_tier(reputation)
        rep_total, tier_total, count = totals.get(fid, (0, 0, 0))
        totals[fid] = (rep_total + reputation, tier_total + tier, count + 1)
        counts = tier_counts.setdefault(fid, {})
        label = tier_labels[tier]
        counts[label] = counts.get(label, 0) + 1
    return totals, tier_counts


def _display_reputation(relation: float) -> int:
    if abs(relation) < _MIN_DISPLAY_RELATION:
        return 0
    score = math.floor(10.0 * math.log10(abs(relation) * 1000.0))
    return score if relation > 0 else -score


def _diplomacy_tier(reputation: int) -> int:
    if reputation <= -20:
        return -2
    if reputation <= -10:
        return -1
    if reputation < 10:
        return 0
    if reputation < 20:
        return 1
    return 2


def _station_category_from_macro(macro: str | None) -> str | None:
    if not macro:
        return None
    lower = macro.lower()
    for marker, category in _STATION_CATEGORY_MARKERS:
        if marker in lower:
            return category
    return None


def _class_count_summary(counts: dict[str, int]) -> str:
    parts = [
        ("S/XS", counts.get("s", 0) + counts.get("xs", 0)),
        ("M", counts.get("m", 0)),
        ("L", counts.get("l", 0)),
        ("XL", counts.get("xl", 0)),
    ]
    return " - ".join(f"{count} {label}" for label, count in parts if count > 0) or "No ships"


def _station_count_summary(counts: dict[str, int]) -> str:
    labels = {
        "defence": "defence platforms",
        "shipyard": "shipyards",
        "wharf": "wharves",
        "tradestation": "trade stations",
        "equipmentdock": "equipment docks",
        "factory": "production stations",
    }
    return " - ".join(
        f"{count} {labels.get(category, category)}"
        for category, count in counts.items()
        if count > 0
    ) or "No stations"


def _component(label: str, value: float, detail: str) -> StrengthComponent:
    return StrengthComponent(label=label, value=round(value, 1), detail=detail)


def _breakdown(
    raw: float,
    leader_raw: float,
    components: list[StrengthComponent],
) -> StrengthBreakdown:
    return StrengthBreakdown(
        raw=round(raw, 1),
        leader_raw=round(leader_raw, 1),
        leader_ratio=_score(raw, leader_raw),
        components=components,
    )


def _score(raw: float, leader_raw: float) -> float:
    return round(raw / leader_raw * 100.0, 1) if leader_raw > 0 else 0.0
