"""REST endpoints for mission group catalog.

Reference data from `libraries/missiongroups.xml` — faction guild boards,
war missions, and story plot chains. Enriches live mission data with
human-readable group metadata.
"""

from __future__ import annotations

import sqlite3
from typing import Annotated, Any

from fastapi import Depends, Query

from x4_api.deps import get_db
from x4_api.routes._catalog import simple_catalog_router
from x4_api.schemas import PublicModel


class MissionGroup(PublicModel):
    group_id: str
    name: str | None
    faction: str | None
    enemy: str | None
    is_story: bool


_COLUMNS = "group_id, name, faction, enemy, is_story"

# The list endpoint takes optional filters, so it can't come from the factory's
# generic (unfiltered) list route — only the flat get-by-id route is shared.
router = simple_catalog_router(
    path_prefix="/mission-groups",
    table="s.mission_groups",
    list_columns=_COLUMNS,
    list_model=MissionGroup,
    detail_columns=_COLUMNS,
    detail_model=MissionGroup,
    list_order_by="is_story DESC, group_id",
    id_col="group_id",
    id_param_name="group_id",
    include_list=False,
)


@router.get("/mission-groups", response_model=list[MissionGroup])
def list_mission_groups(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    faction: Annotated[str | None, Query(description="Filter by offering faction id")] = None,
    story_only: Annotated[bool | None, Query(description="Only story missions")] = None,
) -> list[MissionGroup]:
    """List all mission group definitions, optionally filtered by faction or story."""
    clauses = ["1=1"]
    params: dict[str, Any] = {}
    if faction:
        clauses.append("faction = :faction")
        params["faction"] = faction
    if story_only:
        clauses.append("is_story = 1")

    rows = conn.execute(
        f"""SELECT {_COLUMNS}
            FROM s.mission_groups
            WHERE {" AND ".join(clauses)}
            ORDER BY is_story DESC, group_id""",
        params,
    ).fetchall()
    return [MissionGroup(**dict(r)) for r in rows]
