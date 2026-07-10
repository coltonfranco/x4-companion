"""REST endpoints for station construction plans: named station designs sourced from
game files — the game's own presets (`libraries/constructionplans.xml`) and the
player's saved designs (the profile's `constructionplans.xml`) — both importable into
the dashboard's station builder alongside the existing "import a live station" flow.
"""

import sqlite3
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException

from x4_api.deps import get_db
from x4_api.routes._db import table_exists
from x4_api.routes.stations import StationLayoutEntry
from x4_api.schemas import PublicModel

router = APIRouter()


class ConstructionPlanSummary(PublicModel):
    plan_id: str
    name: str | None
    description: str | None
    source: Literal["preset", "custom"]
    module_count: int


def _plan_summaries(
    conn: sqlite3.Connection,
    *,
    source: Literal["preset", "custom"],
    plans_table: str,
    entries_table: str,
) -> list[ConstructionPlanSummary]:
    rows = conn.execute(
        f"""
        SELECT p.plan_id, p.name, p.description, COUNT(e.entry_id) AS module_count
        FROM {plans_table} p
        LEFT JOIN {entries_table} e ON e.plan_id = p.plan_id
        GROUP BY p.plan_id
        ORDER BY p.name
        """
    ).fetchall()
    return [
        ConstructionPlanSummary(
            plan_id=r["plan_id"],
            name=r["name"],
            description=r["description"],
            source=source,
            module_count=r["module_count"],
        )
        for r in rows
    ]


@router.get("/construction-plans", response_model=list[ConstructionPlanSummary])
def list_construction_plans(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> list[ConstructionPlanSummary]:
    """Construction plans available to import into the station builder: the player's
    saved designs first, then the game's own (faction HQs/wharfs/shipyards, gamestart
    stations) — straight from game files, same duality as `/ships/{id}/loadout-options`.
    """
    plans: list[ConstructionPlanSummary] = []
    if table_exists(conn, "player_construction_plans"):
        plans.extend(
            _plan_summaries(
                conn,
                source="custom",
                plans_table="player_construction_plans",
                entries_table="player_construction_plan_entries",
            )
        )
    plans.extend(
        _plan_summaries(
            conn,
            source="preset",
            plans_table="s.construction_plans",
            entries_table="s.construction_plan_entries",
        )
    )
    return plans


def _find_plan_entries_table(conn: sqlite3.Connection, plan_id: str) -> str | None:
    """Return the entries table for whichever source has this plan_id, or None."""
    if table_exists(conn, "player_construction_plans") and conn.execute(
        "SELECT 1 FROM player_construction_plans WHERE plan_id = ?", (plan_id,)
    ).fetchone():
        return "player_construction_plan_entries"
    if conn.execute("SELECT 1 FROM s.construction_plans WHERE plan_id = ?", (plan_id,)).fetchone():
        return "s.construction_plan_entries"
    return None


@router.get("/construction-plans/{plan_id}/layout", response_model=list[StationLayoutEntry])
def construction_plan_layout(
    plan_id: str,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> list[StationLayoutEntry]:
    """The placed-module graph of a construction plan, in the same shape as
    `/stations/{id}/layout` so the builder's existing import logic (`layoutToDesign`)
    works on it unchanged. No position data — the builder re-lays the graph out itself.
    """
    entries_table = _find_plan_entries_table(conn, plan_id)
    if entries_table is None:
        raise HTTPException(404, f"Unknown construction plan_id: {plan_id}")

    rows = conn.execute(
        f"""
        SELECT e.entry_id, e.entry_index, e.predecessor_index, e.macro AS module_id,
               m.name, m.kind, NULL AS pos_x, NULL AS pos_y, NULL AS pos_z
        FROM {entries_table} e
        LEFT JOIN s.modules m ON m.module_id = e.macro
        WHERE e.plan_id = :plan_id
        ORDER BY e.entry_index
        """,
        {"plan_id": plan_id},
    ).fetchall()
    return [StationLayoutEntry(**dict(r)) for r in rows]
