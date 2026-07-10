"""REST endpoints for ship loadouts (installed equipment) and named loadout options."""

import sqlite3
from typing import Annotated, Literal

from fastapi import APIRouter, Depends

from x4_api.deps import get_db
from x4_api.routes._db import table_exists
from x4_api.schemas import PublicModel

router = APIRouter()


class LoadoutSlot(PublicModel):
    ship_id: str
    slot_type: str
    slot_connection: str
    macro: str
    ammunition: int | None
    extra_json: str | None


@router.get("/ships/{ship_id}/loadout", response_model=list[LoadoutSlot])
def get_ship_loadout(
    ship_id: str,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> list[LoadoutSlot]:
    """All installed equipment slots for a ship. Empty list when the table doesn't exist yet."""
    if not table_exists(conn, "ship_loadouts"):
        return []

    rows = conn.execute(
        """
        SELECT ship_id, slot_type, slot_connection, macro, ammunition, extra_json
        FROM ship_loadouts
        WHERE ship_id = ?
        ORDER BY slot_type, slot_connection
        """,
        (ship_id,),
    ).fetchall()
    return [LoadoutSlot(**dict(r)) for r in rows]


class LoadoutOptionItem(PublicModel):
    kind: str  # engine | thruster | shield | weapon | turret | software | ammunition
    ware_id: str
    quantity: int


class LoadoutOption(PublicModel):
    loadout_id: str
    name: str | None
    description: str | None
    source: Literal["preset", "custom"]
    items: list[LoadoutOptionItem]


def _loadout_options(
    conn: sqlite3.Connection,
    ship_macro: str,
    *,
    source: Literal["preset", "custom"],
    loadouts_table: str,
    equipment_table: str,
) -> list[LoadoutOption]:
    lo_rows = conn.execute(
        f"SELECT loadout_id, name, description FROM {loadouts_table} WHERE ship_macro = ?",
        (ship_macro,),
    ).fetchall()
    if not lo_rows:
        return []

    eq_rows = conn.execute(
        f"""
        SELECT loadout_id, kind, macro, quantity
        FROM {equipment_table}
        WHERE loadout_id IN ({",".join("?" * len(lo_rows))})
        """,
        [r["loadout_id"] for r in lo_rows],
    ).fetchall()
    items_by_loadout: dict[str, list[LoadoutOptionItem]] = {}
    for r in eq_rows:
        # loadout_equipment stores the raw XML attribute: a macro name (strip the
        # "_macro" suffix to match `ware_id`) for every kind except software, whose
        # `ware=` attribute already *is* the ware id.
        ware_id = r["macro"].removesuffix("_macro")
        items_by_loadout.setdefault(r["loadout_id"], []).append(
            LoadoutOptionItem(kind=r["kind"], ware_id=ware_id, quantity=r["quantity"] or 1)
        )

    return [
        LoadoutOption(
            loadout_id=lo["loadout_id"],
            name=lo["name"],
            description=lo["description"],
            source=source,
            items=items_by_loadout.get(lo["loadout_id"], []),
        )
        for lo in lo_rows
    ]


@router.get("/ships/{ship_id}/loadout-options", response_model=list[LoadoutOption])
def get_ship_loadout_options(
    ship_id: str,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> list[LoadoutOption]:
    """Named loadouts available for this ship: the game's own factory presets (sourced
    from `libraries/loadouts.xml`) and the player's saved custom loadouts (sourced from
    the profile's `loadouts.xml`) — both keyed by ship macro, straight from game files.
    """
    # ship_id *is* the macro (matches s.ships.ship_id directly — see GET /ships/{ship_id});
    # unlike ware_id, ships never have the "_macro" suffix stripped.
    ship_macro = ship_id
    options: list[LoadoutOption] = []
    if table_exists(conn, "player_loadouts"):
        options.extend(
            _loadout_options(
                conn,
                ship_macro,
                source="custom",
                loadouts_table="player_loadouts",
                equipment_table="player_loadout_equipment",
            )
        )
    options.extend(
        _loadout_options(
            conn,
            ship_macro,
            source="preset",
            loadouts_table="s.loadouts",
            equipment_table="s.loadout_equipment",
        )
    )
    return options
