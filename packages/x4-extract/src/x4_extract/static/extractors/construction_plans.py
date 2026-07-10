"""Extract named station construction plans from `libraries/constructionplans.xml`.

A construction plan is a station design: a graph of placed module macros linked by
a build predecessor chain (which module connects to which). It answers "what does
this station design look like" — the game ships plans for faction HQs/wharfs/
shipyards plus gamestart stations; the player can also save their own from any
station they've built.

This same schema is reused verbatim by the player's own saved construction plans,
written by the game to a `constructionplans.xml` sibling of the save folder (not
inside it, and not in the game archives) — see
`x4_extract/dynamic/custom_construction_plans.py`, which imports `extract()` from
here rather than reimplementing this parse. It is also structurally the same graph
(`index`/`macro`/`predecessor`) the save itself uses for a *built* station's
construction sequence (`x4_extract/dynamic/extractors/stations.py`), so both feed
the dashboard's station builder "import" flow through the identical
`StationLayoutEntry` shape — position/rotation aren't needed for that (the builder
re-lays the graph out itself), so they aren't extracted here.

Structure:
  <plan id="..." name="..." description="...">
    <patches>...</patches>          (DLC dependency info — ignored, like loadouts)
    <entry index="N" macro="..." connection="...">
      <predecessor index="M" connection="..."/>
      <offset>...</offset>          (ignored — see docstring above)
    </entry>
  </plan>
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from typing import Any

from lxml import etree

from x4_extract.parsing import str_int


@dataclass(slots=True)
class ExtractResult:
    plans: list[dict[str, Any]] = field(default_factory=list)
    entries: list[dict[str, Any]] = field(default_factory=list)


def extract(xml_bytes: bytes) -> ExtractResult:
    """Parse constructionplans.xml bytes into plan + entry rows. Pure function — no I/O."""
    root = etree.fromstring(xml_bytes)
    out = ExtractResult()

    for plan_el in root.iterfind("plan"):
        plan_id = plan_el.get("id")
        if not plan_id:
            continue

        out.plans.append(
            {
                "plan_id": plan_id,
                "name": plan_el.get("name"),
                "description": plan_el.get("description"),
            }
        )

        for entry_el in plan_el.iterfind("entry"):
            macro = entry_el.get("macro")
            index = str_int(entry_el.get("index"))
            if not macro or index is None:
                continue
            pred_el = entry_el.find("predecessor")
            out.entries.append(
                {
                    "plan_id": plan_id,
                    "entry_id": f"{plan_id}#{index}",
                    "entry_index": index,
                    "predecessor_index": str_int(pred_el.get("index")) if pred_el is not None else None,
                    "macro": macro,
                }
            )

    return out


def write(conn: sqlite3.Connection, result: ExtractResult) -> None:
    conn.execute("DELETE FROM construction_plan_entries")
    conn.execute("DELETE FROM construction_plans")
    if result.plans:
        conn.executemany(
            "INSERT INTO construction_plans (plan_id, name, description) "
            "VALUES (:plan_id, :name, :description)",
            result.plans,
        )
    if result.entries:
        conn.executemany(
            "INSERT INTO construction_plan_entries "
            "(plan_id, entry_id, entry_index, predecessor_index, macro) "
            "VALUES (:plan_id, :entry_id, :entry_index, :predecessor_index, :macro)",
            result.entries,
        )
