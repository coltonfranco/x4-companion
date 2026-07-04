"""Shared helpers for dynamic save extractors."""

from __future__ import annotations

import json
from collections.abc import Callable, Iterable, Mapping

from lxml import etree

from x4_extract.savefile.dispatch import Registration, Target

ANCESTOR_WALK_LIMIT = 40


def element_attrs(elem: etree._Element) -> dict[str, str]:
    """Return lxml attributes as a plain string dictionary."""
    return {
        (k if isinstance(k, str) else k.decode()): (v if isinstance(v, str) else v.decode())
        for k, v in elem.attrib.items()
    }


def known_to_player(elem: etree._Element) -> int:
    """Return 1 if the element's `knownto` attribute marks it known to the player."""
    return 1 if elem.get("knownto") == "player" else 0


def component_class_registrations(
    classes: Iterable[str],
    visitor: Callable[[etree._Element], None],
) -> list[Registration]:
    """Build component registrations for a set of X4 component classes."""
    return [
        Registration(
            target=Target(tag="component", depth=None, class_attr=class_attr),
            visitor=visitor,
        )
        for class_attr in classes
    ]


def extra_json_from_attrs(
    attrs: Mapping[str, str],
    mapped: frozenset[str],
    extra: Mapping[str, object] | None = None,
) -> str | None:
    """Serialize attributes not promoted to typed columns as stable JSON."""
    payload: dict[str, object] = {k: v for k, v in attrs.items() if k not in mapped}
    if extra:
        payload.update(extra)
    return json.dumps(payload, sort_keys=True) if payload else None


def walk_ancestors(
    elem: etree._Element,
    *,
    limit: int = ANCESTOR_WALK_LIMIT,
    include_self: bool = False,
) -> Iterable[etree._Element]:
    """Yield ancestors up to `limit` levels, optionally starting with `elem`."""
    ancestor: etree._Element | None = elem if include_self else elem.getparent()
    for _ in range(limit):
        if ancestor is None:
            break
        yield ancestor
        ancestor = ancestor.getparent()


def enclosing_sector_zone(
    elem: etree._Element,
    *,
    limit: int = ANCESTOR_WALK_LIMIT,
    include_self: bool = False,
) -> tuple[str | None, str | None]:
    """Return enclosing `(sector_id, zone_id)` macro ids from component ancestors."""
    sector_id: str | None = None
    zone_id: str | None = None
    for ancestor in walk_ancestors(elem, limit=limit, include_self=include_self):
        class_attr = ancestor.get("class", "")
        if class_attr == "zone" and zone_id is None:
            zone_id = ancestor.get("macro")
        elif class_attr == "sector":
            sector_id = ancestor.get("macro")
            break
    return sector_id, zone_id


def enclosing_zone_id(
    elem: etree._Element,
    *,
    limit: int = ANCESTOR_WALK_LIMIT,
) -> str | None:
    """Return the enclosing zone component's own save-unique `id` (not its macro).

    Needed to look up a zone's dynamic position (see the `_on_zone_position`-style visitor
    pattern used by extractors that care about it): `tempzone` is a placeholder macro shared
    by every physically distinct procedurally-created zone instance across the galaxy, so
    macro alone can't disambiguate them — only the component id can.
    """
    for ancestor in walk_ancestors(elem, limit=limit):
        class_attr = ancestor.get("class", "")
        if class_attr == "zone":
            return ancestor.get("id")
        if class_attr == "sector":
            return None
    return None
