"""Conflict, tension, and force endpoints."""

import sqlite3
from collections import defaultdict
from typing import Annotated, Any

from fastapi import Depends

from x4_api.deps import get_db
from x4_api.routes._db import table_exists
from x4_api.routes.map import router
from x4_api.schemas import PublicModel

from ._common import _faction_name_map


class ConflictFaction(PublicModel):
    faction_id: str
    faction_name: str
    fighter_count: int
    miner_count: int = 0
    trader_count: int = 0
    other_count: int = 0

class ConflictSide(PublicModel):
    factions: list[ConflictFaction]
    fighter_count: int
    miner_count: int = 0
    trader_count: int = 0
    other_count: int = 0

class ConflictEntry(PublicModel):
    sector_id: str
    fighter_count: int
    hostile_pair_count: int
    intensity: float  # 0.0-1.0 normalized across all sectors
    type: str  # 'battle', 'invasion', or 'skirmish'
    invader_name: str | None = None
    sector_owner_name: str | None = None
    factions: list[ConflictFaction]
    sides: list[ConflictSide]

class BorderTensionEntry(PublicModel):
    from_sector_id: str
    to_sector_id: str
    from_forces: list[ConflictFaction]
    to_forces: list[ConflictFaction]
    intensity: float

class SectorForceEntry(PublicModel):
    sector_id: str
    fighter_count: int
    miner_count: int = 0
    trader_count: int = 0
    other_count: int = 0
    factions: list[ConflictFaction]
    sides: list[ConflictSide] | None = None

def _hostile_pair_set(conn: sqlite3.Connection) -> set[tuple[str, str]]:
    """Load mutually-hostile faction pairs (both orderings) for fast `in` lookups."""
    hostile_rows = conn.execute(
        "SELECT faction_id, other_faction_id FROM faction_relations_current WHERE relation < -0.1"
    ).fetchall()
    hostile_set: set[tuple[str, str]] = set()
    for row in hostile_rows:
        hostile_set.add((row[0], row[1]))
        hostile_set.add((row[1], row[0]))
    return hostile_set

def _group_into_sides(
    factions: list[ConflictFaction], hostile_set: set[tuple[str, str]]
) -> list[list[ConflictFaction]]:
    """Greedily place each faction into the first side with no hostile relation to
    any faction already in that side, else start a new side."""
    sides: list[list[ConflictFaction]] = []
    for cf in factions:
        placed = False
        for side in sides:
            is_hostile = any(
                (cf.faction_id, existing.faction_id) in hostile_set for existing in side
            )
            if not is_hostile:
                side.append(cf)
                placed = True
                break
        if not placed:
            sides.append([cf])
    return sides

@router.get("/map/forces", response_model=list[SectorForceEntry])
def list_forces(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> list[SectorForceEntry]:
    """Return total fighter counts per sector and breakdown by faction."""
    if not table_exists(conn, "ships"):
        return []

    breakdown_rows = conn.execute("""
        SELECT sh.sector_id, sh.owner_faction, c.role, COUNT(*) AS cnt, f.name AS faction_name
        FROM ships sh
        JOIN s.ships c ON c.ship_id = sh.macro
        LEFT JOIN s.factions f ON f.faction_id = sh.owner_faction
        WHERE sh.owner_faction IS NOT NULL
          AND sh.sector_id IS NOT NULL
          AND (sh.state IS NULL OR sh.state = '')
        GROUP BY sh.sector_id, sh.owner_faction, c.role
        ORDER BY sh.sector_id, cnt DESC
    """).fetchall()

    conflict_name_map = _faction_name_map(conn)
    by_sector: dict[str, dict[str, dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(int))
    )
    totals_fighter: dict[str, int] = defaultdict(int)
    totals_miner: dict[str, int] = defaultdict(int)
    totals_trader: dict[str, int] = defaultdict(int)
    totals_other: dict[str, int] = defaultdict(int)

    for sector, faction, role, cnt, fname in breakdown_rows:
        sector_id = sector.lower()
        by_sector[sector_id][faction]["_seen"] = 1
        if fname and faction not in conflict_name_map:
            conflict_name_map[faction] = fname

        if role == "fight":
            totals_fighter[sector_id] += cnt
            by_sector[sector_id][faction]["fight"] += cnt
        elif role == "mine":
            totals_miner[sector_id] += cnt
            by_sector[sector_id][faction]["mine"] += cnt
        elif role == "trade":
            totals_trader[sector_id] += cnt
            by_sector[sector_id][faction]["trade"] += cnt
        else:
            totals_other[sector_id] += cnt
            by_sector[sector_id][faction]["other"] += cnt

    hostile_set = _hostile_pair_set(conn)

    results = []
    # Collect all sectors that have ANY forces (fighters, miners, or traders)
    all_sectors = (
        set(totals_fighter.keys())
        | set(totals_miner.keys())
        | set(totals_trader.keys())
        | set(totals_other.keys())
    )
    for sector_id in all_sectors:
        factions = []
        for faction_id, counts in by_sector[sector_id].items():
            factions.append(
                ConflictFaction(
                    faction_id=faction_id,
                    faction_name=conflict_name_map.get(faction_id, faction_id),
                    fighter_count=counts.get("fight", 0),
                    miner_count=counts.get("mine", 0),
                    trader_count=counts.get("trade", 0),
                    other_count=counts.get("other", 0),
                )
            )
        f_count = totals_fighter.get(sector_id, 0)
        m_count = totals_miner.get(sector_id, 0)
        t_count = totals_trader.get(sector_id, 0)

        sides = _group_into_sides(factions, hostile_set)

        conflict_sides = []
        for side_factions in sides:
            side_fcnt = sum(f.fighter_count for f in side_factions)
            side_mcnt = sum(f.miner_count for f in side_factions)
            side_tcnt = sum(f.trader_count for f in side_factions)
            side_ocnt = sum(f.other_count for f in side_factions)
            conflict_sides.append(
                ConflictSide(
                    factions=side_factions,
                    fighter_count=side_fcnt,
                    miner_count=side_mcnt,
                    trader_count=side_tcnt,
                    other_count=side_ocnt,
                )
            )
        conflict_sides.sort(key=lambda s: -s.fighter_count)
        o_count = totals_other.get(sector_id, 0)

        results.append(
            SectorForceEntry(
                sector_id=sector_id,
                fighter_count=f_count,
                miner_count=m_count,
                trader_count=t_count,
                other_count=o_count,
                factions=factions,
                sides=conflict_sides if conflict_sides else None,
            )
        )

    return results

# Shared by list_conflicts/list_tensions: per-sector fighter + station-owner faction
# strength, merged and lower-cased so live-save sector ids (mixed case) join cleanly.
# Verbatim-identical in both queries; list_conflicts layers extra CTEs on top.
_SECTOR_FACTION_STRENGTH_CTE = """
    sector_fighters AS (
        SELECT sh.sector_id, sh.owner_faction, COUNT(*) AS cnt
        FROM ships sh
        JOIN s.ships c ON c.ship_id = sh.macro
        WHERE c.role = 'fight'
          AND sh.owner_faction IS NOT NULL
          AND sh.sector_id IS NOT NULL
          AND (sh.state IS NULL OR sh.state = '')
        GROUP BY sh.sector_id, sh.owner_faction
    ),
    sector_owners AS (
        SELECT LOWER(st.sector_id) AS sector_id, st.owner_faction
        FROM stations st
        WHERE st.owner_faction IS NOT NULL AND st.sector_id IS NOT NULL
        GROUP BY LOWER(st.sector_id)
    ),
    sector_factions AS (
        SELECT sector_id, owner_faction, cnt FROM sector_fighters
        UNION ALL
        SELECT sector_id, owner_faction, 0 AS cnt FROM sector_owners
    ),
    merged_factions AS (
        SELECT LOWER(sector_id) AS sector_id, owner_faction, SUM(cnt) AS cnt
        FROM sector_factions
        GROUP BY LOWER(sector_id), owner_faction
    )
"""

@router.get("/map/conflicts", response_model=list[ConflictEntry])
def list_conflicts(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> list[ConflictEntry]:
    """Sectors with active fighter presence from mutually-hostile factions.

    Returns one row per sector with a conflict score.  ``intensity`` is
    0.0-1.0 normalized across all sectors; ``fighter_count`` is the raw
    number of combat-class ships from the hostile factions in that sector.
    Returns [] until a save is ingested.
    """
    if not table_exists(conn, "ships") or not table_exists(conn, "faction_relations_current"):
        return []

    # Per-sector faction breakdown for hostile sectors
    # We include sector owners even if they have 0 ships, so an invasion is correctly registered.
    breakdown_rows = conn.execute(f"""
        WITH hostile_pairs AS (
            SELECT r.faction_id AS a, r.other_faction_id AS b
            FROM faction_relations_current r
            WHERE r.relation < -0.1
        ),
        {_SECTOR_FACTION_STRENGTH_CTE},
        hostile_sectors AS (
            SELECT DISTINCT sf.sector_id
            FROM merged_factions sf
            WHERE EXISTS (
                SELECT 1 FROM merged_factions sf2
                JOIN hostile_pairs h ON (h.a = sf.owner_faction AND h.b = sf2.owner_faction)
                WHERE sf2.sector_id = sf.sector_id
            )
        )
        SELECT sf.sector_id, sf.owner_faction, sf.cnt,
               COALESCE(f.name, sf.owner_faction) AS faction_name,
               NULL AS sector_owner_name,
               NULL AS sector_owner_id
        FROM merged_factions sf
        LEFT JOIN s.factions f ON f.faction_id = sf.owner_faction
        WHERE sf.sector_id IN (SELECT sector_id FROM hostile_sectors)
        ORDER BY sf.sector_id, sf.cnt DESC
    """).fetchall()

    if not breakdown_rows:
        return []

    by_sector: dict[str, dict[str, tuple[int, str]]] = defaultdict(dict)
    totals: dict[str, int] = defaultdict(int)
    sector_owners_map: dict[str, tuple[str | None, str | None]] = {}

    for sector, faction, cnt, fname, so_name, so_id in breakdown_rows:
        by_sector[sector][faction] = (cnt, fname)
        totals[sector] += cnt
        if sector not in sector_owners_map:
            sector_owners_map[sector] = (so_id, so_name)

    hostile_set = _hostile_pair_set(conn)

    name_map = _faction_name_map(conn)

    results = []
    for sector, factions in sorted(by_sector.items(), key=lambda x: -(totals[x[0]])):
        sorted_facs = sorted(factions.items(), key=lambda x: -(x[1][0]))

        conflict_factions_sorted = [
            ConflictFaction(
                faction_id=fid, faction_name=name_map.get(fid, fname), fighter_count=fcnt
            )
            for fid, (fcnt, fname) in sorted_facs
        ]
        sides = _group_into_sides(conflict_factions_sorted, hostile_set)

        conflict_sides = []
        for side_factions in sides:
            side_fcnt = sum(f.fighter_count for f in side_factions)
            conflict_sides.append(ConflictSide(factions=side_factions, fighter_count=side_fcnt))

        conflict_sides.sort(key=lambda s: -s.fighter_count)

        largest_side = conflict_sides[0] if len(conflict_sides) > 0 else None
        second_largest_side = conflict_sides[1] if len(conflict_sides) > 1 else None

        largest = largest_side.fighter_count if largest_side else 0
        second_largest = second_largest_side.fighter_count if second_largest_side else 0
        total_fighters = sum(s.fighter_count for s in conflict_sides)

        so_id, so_name = sector_owners_map.get(sector, (None, None))
        is_neutral = so_id is None or so_id == "ownerless"

        ctype = "skirmish"
        invader_name = None

        is_invasion = False
        if not is_neutral and largest_side:
            for f in largest_side.factions:
                if (f.faction_id, so_id) in hostile_set:
                    is_invasion = True
                    break

        if second_largest < 5:
            # The secondary force (the attackers, or defenders if overwhelmed) is tiny.
            # This is only a notable conflict if the LARGEST force is actively invading the sector.
            if not is_invasion or largest < 5:
                continue

            ctype = "invasion"
            # is_invasion is only ever set True inside the `largest_side` truthy branch above.
            assert largest_side is not None
            invader_faction = max(largest_side.factions, key=lambda x: x.fighter_count)
            invader_name = invader_faction.faction_name
        else:
            # A real fight with at least 5 ships on both sides.
            ctype = "battle" if largest >= 10 and second_largest >= 10 else "skirmish"

        # Intensity scales depending on the type of conflict.
        # For battles, the second_largest force dictates how "massive" it really is.
        # For invasions, the largest force dictates how severe the invasion is.
        # For skirmishes, it's just low intensity.
        if ctype == "battle":
            intensity = min(1.0, second_largest / 40.0)
        elif ctype == "invasion":
            intensity = min(1.0, largest / 100.0)
        else:
            intensity = min(1.0, total_fighters / 20.0)

        # Scale intensity to make sure skirmishes are low, battles are high.
        if ctype == "skirmish":
            intensity = 0.1 + intensity * 0.3  # 0.1 to 0.4
        elif ctype == "invasion":
            intensity = 0.4 + intensity * 0.4  # 0.4 to 0.8
        elif ctype == "battle":
            intensity = 0.6 + intensity * 0.4  # 0.6 to 1.0

        results.append(
            ConflictEntry(
                sector_id=sector,
                fighter_count=totals[sector],
                hostile_pair_count=len(factions),
                intensity=round(intensity, 4),
                type=ctype,
                invader_name=invader_name,
                sector_owner_name=so_name,
                factions=[
                    ConflictFaction(faction_id=f, faction_name=fn, fighter_count=fc)
                    for f, (fc, fn) in sorted_facs
                ],
                sides=conflict_sides,
            )
        )

    # Re-sort results by intensity
    results.sort(key=lambda x: -x.intensity)
    return results

@router.get("/map/tensions", response_model=list[BorderTensionEntry])
def list_tensions(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> list[BorderTensionEntry]:
    """Sectors with amassing hostile forces on adjacent borders."""
    if not table_exists(conn, "ships") or not table_exists(conn, "faction_relations_current"):
        return []

    breakdown_rows = conn.execute(f"""
        WITH {_SECTOR_FACTION_STRENGTH_CTE}
        SELECT mf.sector_id, mf.owner_faction, mf.cnt,
               COALESCE(f.name, mf.owner_faction) AS faction_name,
               NULL AS sector_owner_id
        FROM merged_factions mf
        LEFT JOIN s.factions f ON f.faction_id = mf.owner_faction
    """).fetchall()

    forces_name_map = _faction_name_map(conn)
    sector_forces: dict[str, list[dict[str, Any]]] = defaultdict(list)
    sector_owners_map: dict[str, str | None] = {}

    for sector, faction, cnt, fname, so_id in breakdown_rows:
        sector_forces[sector].append(
            {
                "faction_id": faction,
                "faction_name": forces_name_map.get(faction, fname),
                "cnt": cnt,
            }
        )
        if sector not in sector_owners_map:
            sector_owners_map[sector] = so_id

    connections = conn.execute("""
        SELECT DISTINCT
            CASE WHEN z1.sector_id < z2.sector_id THEN z1.sector_id ELSE z2.sector_id END AS from_sector_id,
            CASE WHEN z1.sector_id < z2.sector_id THEN z2.sector_id ELSE z1.sector_id END AS to_sector_id
        FROM s.gates g
        JOIN s.zones z1 ON z1.zone_id = g.from_zone_id
        JOIN s.zones z2 ON z2.zone_id = g.to_zone_id
        WHERE z1.sector_id != z2.sector_id
        UNION
        SELECT DISTINCT
            CASE WHEN z1.sector_id < z2.sector_id THEN z1.sector_id ELSE z2.sector_id END AS from_sector_id,
            CASE WHEN z1.sector_id < z2.sector_id THEN z2.sector_id ELSE z1.sector_id END AS to_sector_id
        FROM s.superhighways sh
        JOIN s.zones z1 ON z1.zone_id = sh.from_zone_id
        JOIN s.zones z2 ON z2.zone_id = sh.to_zone_id
        WHERE z1.sector_id != z2.sector_id
    """).fetchall()

    hostile_set = _hostile_pair_set(conn)

    results = []

    for c_from, c_to in connections:
        c_from = c_from.lower()
        c_to = c_to.lower()

        forces_a = sector_forces.get(c_from, [])
        forces_b = sector_forces.get(c_to, [])

        if not forces_a or not forces_b:
            continue

        owner_a = sector_owners_map.get(c_from)
        owner_b = sector_owners_map.get(c_to)

        hostile_in_a = set()
        hostile_in_b = set()

        for fa in forces_a:
            for fb in forces_b:
                if (fa["faction_id"], fb["faction_id"]) in hostile_set:
                    # Condition 1: Mutual standoff. Both sides have 10+ ships.
                    mutual_standoff = fa["cnt"] >= 10 and fb["cnt"] >= 10

                    # Condition 2: Invasion threat. One side has 20+ ships and is hostile to the other side's SECTOR OWNER.
                    a_invading_b = (
                        fa["cnt"] >= 20 and owner_b and (fa["faction_id"], owner_b) in hostile_set
                    )
                    b_invading_a = (
                        fb["cnt"] >= 20 and owner_a and (fb["faction_id"], owner_a) in hostile_set
                    )

                    if mutual_standoff or a_invading_b or b_invading_a:
                        hostile_in_a.add(fa["faction_id"])
                        hostile_in_b.add(fb["faction_id"])

        if hostile_in_a and hostile_in_b:
            a_involved = [fa for fa in forces_a if fa["faction_id"] in hostile_in_a]
            b_involved = [fb for fb in forces_b if fb["faction_id"] in hostile_in_b]

            total_fighters = sum(fa["cnt"] for fa in a_involved) + sum(
                fb["cnt"] for fb in b_involved
            )
            intensity = min(1.0, total_fighters / 150.0)

            from_forces = [
                ConflictFaction(
                    faction_id=f["faction_id"],
                    faction_name=f["faction_name"],
                    fighter_count=f["cnt"],
                )
                for f in a_involved
            ]
            to_forces = [
                ConflictFaction(
                    faction_id=f["faction_id"],
                    faction_name=f["faction_name"],
                    fighter_count=f["cnt"],
                )
                for f in b_involved
            ]

            from_forces.sort(key=lambda x: -x.fighter_count)
            to_forces.sort(key=lambda x: -x.fighter_count)

            results.append(
                BorderTensionEntry(
                    from_sector_id=c_from,
                    to_sector_id=c_to,
                    from_forces=from_forces,
                    to_forces=to_forces,
                    intensity=round(intensity, 4),
                )
            )

    results.sort(key=lambda x: -x.intensity)
    return results

