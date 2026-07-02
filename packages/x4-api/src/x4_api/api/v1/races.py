"""Race definitions endpoint."""

from __future__ import annotations

import sqlite3
from typing import Annotated, Any

from fastapi import Depends

from x4_api.api.catalog_router import simple_catalog_router
from x4_api.api.deps import get_db
from x4_api.api.icons import get_icon_url
from x4_api.api.schemas import PublicModel


class RaceSummary(PublicModel):
    race_id: str
    name: str | None
    description: str | None = None
    shortname: str | None = None
    tags: str | None = None
    icon_url: str | None = None


class RaceDetail(RaceSummary):
    spacename: str | None = None
    homespacename: str | None = None
    names_table: int | None = None
    char_height: float | None = None
    char_walk_speed: float | None = None
    char_run_speed: float | None = None
    char_slow_walk: float | None = None
    char_acceleration: float | None = None
    char_spacesuit_ref: str | None = None
    event_adjust_y: float | None = None
    event_adjust_z: float | None = None
    event_face_key: str | None = None
    icon_inactive: str | None = None
    agent_icon_male: str | None = None
    agent_icon_female: str | None = None
    trail_brightness: float | None = None
    trail_contrast: float | None = None
    trail_saturation: float | None = None
    trail_hue: int | None = None
    engine_color_index: int | None = None
    chair_ref: str | None = None


class RaceRelation(PublicModel):
    race_id: str
    other_race_id: str
    relation: float


_LIST_COLS = "race_id, name, description, shortname, tags, icon_active"
_DETAIL_COLS = (
    _LIST_COLS + ", spacename, homespacename, names_table, "
    "char_height, char_walk_speed, char_run_speed, char_slow_walk, char_acceleration, char_spacesuit_ref, "
    "event_adjust_y, event_adjust_z, event_face_key, "
    "icon_inactive, agent_icon_male, agent_icon_female, "
    "trail_brightness, trail_contrast, trail_saturation, trail_hue, "
    "engine_color_index, chair_ref"
)


def _inject_icon_url(d: dict[str, Any]) -> dict[str, Any]:
    """Both list and detail queries select `icon_active`; resolve it to a URL."""
    d["icon_url"] = get_icon_url(d.pop("icon_active"))
    return d


router = simple_catalog_router(
    path_prefix="/races",
    table="s.races",
    list_columns=_LIST_COLS,
    list_model=RaceSummary,
    detail_columns=_DETAIL_COLS,
    detail_model=RaceDetail,
    list_order_by="race_id",
    id_col="race_id",
    id_param_name="race_id",
    row_hook=_inject_icon_url,
)


@router.get("/race-relations", response_model=list[RaceRelation])
def list_race_relations(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> list[RaceRelation]:
    rows = conn.execute(
        "SELECT race_id, other_race_id, relation FROM s.race_relations ORDER BY race_id, other_race_id"
    ).fetchall()
    return [RaceRelation(**dict(r)) for r in rows]
