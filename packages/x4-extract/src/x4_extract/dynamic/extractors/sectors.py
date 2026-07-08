"""Extract dynamic sector state (e.g. player knowledge, ownership) from a streamed save.

Sector components are found at depth 9:
    savegame(1) → universe(2) → component[galaxy](3) → connections(4) →
    connection(5) → component[cluster](6) → connections(7) → connection(8) →
    component[sector](9)

The game records sector ownership changes directly on the sector component:
    <component class=\"sector\" macro=\"cluster_409_sector001_macro\"
               owner=\"freesplit\" contested=\"1\" knownto=\"player\"/>

Tier: VOLATILE — player knowledge of sectors expands continuously during play.
"""

from __future__ import annotations

import dataclasses
import sqlite3
from dataclasses import dataclass, field

from lxml import etree

from x4_extract.dynamic.collector import Tier, fingerprint_for_tier, tables_for_tier
from x4_extract.dynamic.extractors.component_helpers import (
    element_attrs,
    extra_json_from_attrs,
    known_to_player,
)
from x4_extract.savefile.dispatch import Registration, Target

_SECTOR_DEPTH = 9

# Sector component attrs promoted to columns; the rest go to extra_json.
_MAPPED_SECTOR_ATTRS = frozenset({"macro", "owner", "contested", "knownto", "id", "class", "code"})


@dataclass(slots=True)
class SectorStateRow:
    sector_id: str
    known_to_player: int
    owner_faction: str | None
    contested: int
    extra_json: str | None


@dataclass(slots=True)
class SectorsCollector:
    rows: list[SectorStateRow] = field(default_factory=list)

    def register(self) -> list[Registration]:
        return [
            Registration(
                target=Target(
                    depth=_SECTOR_DEPTH,
                    tag="component",
                    class_attr="sector",
                    parent_tag="connection",
                ),
                visitor=self._on_sector,
            )
        ]

    def _on_sector(self, elem: etree._Element) -> None:
        sector_id = elem.get("macro")
        if not sector_id:
            return

        self.rows.append(
            SectorStateRow(
                sector_id=sector_id,
                known_to_player=known_to_player(elem),
                owner_faction=elem.get("owner") or None,
                contested=int(elem.get("contested", "0")),
                extra_json=extra_json_from_attrs(element_attrs(elem), _MAPPED_SECTOR_ATTRS),
            )
        )

    # --- tiered contract -------------------------------------------------------
    def tables(self, tier: Tier) -> tuple[str, ...]:
        return tables_for_tier(tier, Tier.VOLATILE, ("sector_state",))

    def fingerprint(self, tier: Tier) -> str:
        return fingerprint_for_tier(tier, Tier.VOLATILE, (dataclasses.asdict(r) for r in self.rows))

    def flush(self, conn: sqlite3.Connection, tier: Tier | None = None) -> None:
        if tier not in (None, Tier.VOLATILE) or not self.rows:
            return
        conn.executemany(
            """
            INSERT OR REPLACE INTO sector_state
                (sector_id, known_to_player, owner_faction, contested, extra_json)
            VALUES (:sector_id, :known_to_player, :owner_faction, :contested, :extra_json)
            """,
            [dataclasses.asdict(r) for r in self.rows],
        )
