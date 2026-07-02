"""Shared helper for extracting `<relations><relation .../></relations>` rows.

`factions.xml`, `races.xml`, and `gamestarts.xml` each nest a `<relations>` block whose
`<relation>` children carry a foreign-key attribute (faction id, race id, ...) plus a
`relation` value. This normalizes the shared iterate/parse/skip-on-bad-float shape.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from contextlib import suppress
from typing import Any

from lxml import etree


def parse_relation_rows(
    parent_el: etree._Element,
    *,
    other_attr: str,
    row_factory: Callable[[str, float], dict[str, Any]],
) -> Iterable[dict[str, Any]]:
    """Yield rows from `parent_el`'s `relations/relation` children.

    `other_attr` names the foreign-key attribute on each `<relation>` element (e.g.
    "faction", "race"); `row_factory(other_id, relation)` builds the row dict. Relations
    with a missing foreign key or a non-numeric `relation` value are skipped.
    """
    for rel_el in parent_el.iterfind("relations/relation"):
        other = rel_el.get(other_attr)
        val = rel_el.get("relation")
        if not other or val is None:
            continue
        with suppress(ValueError):
            yield row_factory(other, float(val))
