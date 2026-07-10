"""REST endpoints for game factions."""

import dataclasses
import sqlite3
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from x4_api.deps import get_db
from x4_api.domain.faction_strength import FactionIdentity, compute_faction_strength
from x4_api.routes._db import fetch_one_or_404, table_exists
from x4_api.routes._factions import disambiguate, is_hidden_select, visible_faction_where
from x4_api.routes._icons import get_icon_url
from x4_api.schemas import PublicModel

router = APIRouter()


class FactionSummary(PublicModel):
    faction_id: str
    name: str
    color_hex: str | None
    is_hidden: bool = False
    short_name: str | None = None
    prefix_name: str | None = None
    space_name: str | None = None
    home_space_name: str | None = None
    police_faction: str | None = None
    primary_race: str | None = None
    icon_active: str | None = None
    icon_inactive: str | None = None
    icon_banner: str | None = None
    tags: str | None = None
    icon_url: str | None = None


class FactionDetail(FactionSummary):
    primary_race: str | None
    description: str | None = None
    behaviour_set: str | None = None
    tags: str | None = None


class FactionRelation(PublicModel):
    other_faction_id: str
    initial_relation: float
    current_relation: float | None = None  # from the active save; None until ingested


class AllFactionRelation(PublicModel):
    faction_id: str
    other_faction_id: str
    initial_relation: float
    current_relation: float | None = None  # from the active save; None until ingested


class FactionLicence(PublicModel):
    licence_type: str
    faction_id: str
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    precursor: str | None = None
    price: int | None = None
    min_relation: float | None = None


class FactionStrengthComponent(PublicModel):
    label: str
    value: float
    detail: str


class FactionStrengthBreakdown(PublicModel):
    raw: float
    leader_raw: float
    leader_ratio: float
    components: list[FactionStrengthComponent]


@router.get("/faction-relations", response_model=list[AllFactionRelation])
def list_all_faction_relations(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    include_hidden: bool = Query(False, description="Include utility/hidden factions."),
) -> list[AllFactionRelation]:
    """Every faction-to-faction relation from the active save. Returns [] until a save is ingested."""
    sql = [
        "SELECT c.faction_id, c.other_faction_id, c.relation AS initial_relation,",
        "       c.relation AS current_relation",
        "FROM faction_relations_current c",
        "LEFT JOIN s.factions f ON f.faction_id = c.faction_id",
        "LEFT JOIN s.factions other ON other.faction_id = c.other_faction_id",
        "WHERE 1=1",
    ]
    if not include_hidden:
        sql.append(f"AND (f.faction_id IS NULL OR {visible_faction_where('f')})")
        sql.append(f"AND (other.faction_id IS NULL OR {visible_faction_where('other')})")
    sql.append("ORDER BY c.faction_id, c.other_faction_id")

    rows = conn.execute(" ".join(sql)).fetchall()
    return [AllFactionRelation(**dict(r)) for r in rows]


@router.get("/factions", response_model=list[FactionSummary])
def list_factions(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    include_hidden: bool = Query(False, description="Include utility/hidden factions."),
) -> list[FactionSummary]:
    """List factions in the game catalog. Overrides the player faction name with the
    custom organisation name from the save when a save has been ingested."""
    sql = [
        "SELECT f.faction_id, "
        "COALESCE(p.faction_name, f.name) AS name, "
        "f.color_hex,",
        is_hidden_select("f"),
        ", CASE WHEN f.faction_id = 'player' THEN NULL ELSE f.short_name END AS short_name",
        ", f.prefix_name, f.space_name, f.home_space_name,",
        "f.police_faction, f.primary_race, f.tags,",
        "CASE WHEN f.faction_id = 'player' AND p.logo_index IS NOT NULL "
        "     THEN 'playerlogo_' || printf('%02d', p.logo_index) "
        "     ELSE f.icon_active "
        "END AS icon_active,",
        "f.icon_inactive, f.icon_banner",
        "FROM s.factions f",
        "LEFT JOIN player p ON p.id = 1 AND f.faction_id = 'player'",
        "WHERE f.is_legacy = 0",
    ]
    if not include_hidden:
        sql.append(f"AND {visible_faction_where('f')}")
    sql.append("ORDER BY name")

    rows = conn.execute(" ".join(sql)).fetchall()

    out: list[dict[str, Any]] = disambiguate([dict(r) for r in rows], name_col="name")
    for d in out:
        d["icon_url"] = get_icon_url(d.get("icon_active"))
    return [FactionSummary(**d) for d in out]


class FactionStrength(PublicModel):
    faction_id: str
    name: str
    color_hex: str | None
    # Normalized 0-100 scores (best faction in each category = 100)
    military_score: float
    economic_score: float
    diplomatic_score: float  # relation-tier average mapped -2..2 → 0..100
    territory_score: float
    military: FactionStrengthBreakdown
    economic: FactionStrengthBreakdown
    territory: FactionStrengthBreakdown
    diplomacy: FactionStrengthBreakdown
    # Raw detail fields
    fight_ship_count: int
    trade_ship_count: int
    mine_ship_count: int
    military_station_count: int  # defence + shipyard + wharf
    economic_station_count: int  # trade stations, equipment docks, factories, etc.
    sector_count: int
    cluster_count: int  # distinct clusters with at least one owned sector
    avg_relation: float  # game-scale -30..30


@router.get("/factions/strength", response_model=list[FactionStrength])
def faction_strength(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    include_hidden: bool = Query(False, description="Include utility/hidden factions."),
) -> list[FactionStrength]:
    """Relative strength metrics, normalized 0-100, computed from LIVE save state.

    Everything here is the *current* universe (dynamic ships/stations/relations) so the
    standings reflect how the game has actually unfolded — seed/static is init state only
    and is not referenced once a save is loaded. The player is ranked alongside AI factions.
    """
    faction_sql = [
        "SELECT f.faction_id, COALESCE(p.faction_name, f.name) AS name, f.color_hex "
        "FROM s.factions f "
        "LEFT JOIN player p ON p.id = 1 AND f.faction_id = 'player' "
        "WHERE f.is_legacy = 0"
    ]
    if not include_hidden:
        faction_sql.append(f"AND {visible_faction_where('f')}")
    faction_sql.append("ORDER BY name")
    factions_q_raw = conn.execute(" ".join(faction_sql)).fetchall()
    faction_dicts = disambiguate([dict(r) for r in factions_q_raw])
    factions = [
        FactionIdentity(
            faction_id=f["faction_id"],
            name=f["name"],
            color_hex=f["color_hex"],
        )
        for f in faction_dicts
    ]
    return [FactionStrength(**dataclasses.asdict(row)) for row in compute_faction_strength(conn, factions)]


@router.get("/factions/known", response_model=dict[str, bool])
def list_known_factions(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    include_hidden: bool = Query(False, description="Include utility/hidden factions."),
) -> dict[str, bool]:
    """Return {faction_id: is_known} for every static faction."""
    faction_sql = ["SELECT faction_id FROM s.factions WHERE is_legacy = 0"]
    if not include_hidden:
        faction_sql.append(f"AND {visible_faction_where()}")
    all_factions = {r["faction_id"] for r in conn.execute(" ".join(faction_sql)).fetchall()}
    known: set[str] = {"player"}

    if table_exists(conn, "faction_relations_current"):
        known.update(
            r["other_faction_id"]
            for r in conn.execute(
                "SELECT other_faction_id FROM faction_relations_current WHERE faction_id = 'player'"
            ).fetchall()
        )

    has_stations = table_exists(conn, "stations")
    if has_stations:
        known.update(
            r["owner_faction"]
            for r in conn.execute(
                "SELECT DISTINCT owner_faction FROM stations WHERE known_to_player = 1 AND owner_faction IS NOT NULL"
            ).fetchall()
        )

    if table_exists(conn, "sector_state") and has_stations:
        known.update(
            r["owner_faction"]
            for r in conn.execute(
                "SELECT DISTINCT st.owner_faction FROM stations st "
                "JOIN sector_state ss ON LOWER(ss.sector_id) = LOWER(st.sector_id) "
                "WHERE ss.known_to_player = 1 AND st.owner_faction IS NOT NULL"
            ).fetchall()
        )

    return {fid: fid in known for fid in sorted(all_factions)}


@router.get("/factions/{faction_id}", response_model=FactionDetail)
def get_faction(
    faction_id: str,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> FactionDetail:
    """Get detailed information for a specific faction."""
    row = fetch_one_or_404(
        conn,
        "SELECT f.faction_id, "
        "COALESCE(p.faction_name, f.name) AS name, "
        "f.color_hex, "
        f"{is_hidden_select('f')}, "
        "f.primary_race, "
        "CASE WHEN f.faction_id = 'player' THEN NULL ELSE f.short_name END AS short_name, "
        "f.prefix_name, "
        "f.space_name, f.home_space_name, f.police_faction, "
        "CASE WHEN f.faction_id = 'player' AND p.logo_index IS NOT NULL "
        "     THEN 'playerlogo_' || printf('%02d', p.logo_index) "
        "     ELSE f.icon_active "
        "END AS icon_active, "
        "f.icon_inactive, f.icon_banner, "
        "f.description, f.behaviour_set, f.tags "
        "FROM s.factions f "
        "LEFT JOIN player p ON p.id = 1 AND f.faction_id = 'player' "
        "WHERE f.faction_id = :id",
        {"id": faction_id},
        f"Unknown faction_id: {faction_id}",
    )

    d = dict(row)
    # Disambiguate if this faction's name collides with others
    (same_name_count,) = conn.execute(
        "SELECT COUNT(*) FROM s.factions WHERE name = :name", {"name": d["name"]}
    ).fetchone()
    if same_name_count > 1:
        d["name"] = f"{d['name']} ({d['faction_id']})"
    d["icon_url"] = get_icon_url(d.get("icon_active"))
    return FactionDetail(**d)


@router.get("/factions/{faction_id}/relations", response_model=list[FactionRelation])
def list_faction_relations(
    faction_id: str,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    include_hidden: bool = Query(False, description="Include utility/hidden factions."),
) -> list[FactionRelation]:
    """Diplomatic relations for a faction from the active save. Returns [] until a save is ingested."""
    fetch_one_or_404(
        conn,
        "SELECT 1 FROM s.factions WHERE faction_id = :id",
        {"id": faction_id},
        f"Unknown faction_id: {faction_id}",
    )
    sql = [
        "SELECT c.other_faction_id, c.relation AS initial_relation, c.relation AS current_relation",
        "FROM faction_relations_current c",
        "LEFT JOIN s.factions other ON other.faction_id = c.other_faction_id",
        "WHERE c.faction_id = :id",
    ]
    if not include_hidden:
        sql.append(f"AND (other.faction_id IS NULL OR {visible_faction_where('other')})")
    sql.append("ORDER BY c.other_faction_id")
    rows = conn.execute(" ".join(sql), {"id": faction_id}).fetchall()
    return [FactionRelation(**dict(r)) for r in rows]


@router.get("/licences", response_model=list[FactionLicence])
def list_licences(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    faction_id: str | None = None,
) -> list[FactionLicence]:
    """List all faction licences, optionally filtered by faction_id."""
    sql = [
        "SELECT licence_type, faction_id, name, description, icon, precursor, price, min_relation FROM s.faction_licences WHERE 1=1"
    ]
    params: dict[str, object] = {}
    if faction_id is not None:
        sql.append("AND faction_id = :faction_id")
        params["faction_id"] = faction_id
    sql.append("ORDER BY faction_id, licence_type")

    rows = conn.execute(" ".join(sql), params).fetchall()
    return [FactionLicence(**dict(r)) for r in rows]
