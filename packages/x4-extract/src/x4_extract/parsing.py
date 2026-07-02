"""Shared parsing helpers for XML-backed extraction.

X4 XML stores many numeric attributes as strings, and some files use float-formatted
values for integer fields. These helpers keep that coercion policy consistent across
extractors.
"""

from __future__ import annotations

from collections.abc import Collection

from lxml import etree


def xml_attr_int(el: etree._Element | None, attr: str) -> int | None:
    """Return an integer XML attribute, tolerating float-formatted integer strings."""
    if el is None:
        return None
    value = el.get(attr)
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return int(float(value))


def xml_attr_int_or_none(el: etree._Element | None, attr: str) -> int | None:
    """Return an integer XML attribute, or None when coercion fails."""
    try:
        return xml_attr_int(el, attr)
    except ValueError:
        return None


def xml_attr_float(el: etree._Element | None, attr: str) -> float | None:
    """Return a float XML attribute, or None when it is missing or invalid."""
    if el is None:
        return None
    value = el.get(attr)
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def xml_attr_bool(el: etree._Element | None, attr: str) -> bool | None:
    """Return an X4 boolean XML attribute encoded as "1"."""
    if el is None:
        return None
    value = el.get(attr)
    if value is None:
        return None
    return value == "1"


def str_int(value: str | None) -> int | None:
    """Return an integer from a string, tolerating float-formatted integer strings."""
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def str_float(value: str | None) -> float | None:
    """Return a float from a string, or None when it is missing or invalid."""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def xpath_elements(node: etree._Element, query: str) -> list[etree._Element]:
    """Evaluate an XPath query and return only the matching element nodes."""
    result = node.xpath(query)
    if not isinstance(result, list):
        return []
    return [item for item in result if isinstance(item, etree._Element)]


def attr_flag(el: etree._Element | None, attr: str, true_value: str = "true") -> int:
    """Return 1 if the attribute equals *true_value*, else 0."""
    if el is None:
        return 0
    return 1 if el.get(attr) == true_value else 0


def opt_attr(el: etree._Element | None, attr: str) -> str | None:
    """Return a string XML attribute, or None when *el* is None or the attribute is missing."""
    return el.get(attr) if el is not None else None


_SIZE_ORDER: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("xl", ("extralarge",)),
    ("l", ("large",)),
    ("m", ("medium",)),
    ("s", ("small",)),
)


def size_from_tags(
    tags: str | Collection[str],
    *,
    order: tuple[tuple[str, tuple[str, ...]], ...] = _SIZE_ORDER,
    default: str | None = None,
) -> str | None:
    """Return the size code (s/m/l/xl/...) for the first tag-group in *order* with a
    match in *tags* (a raw tags string or an already-split collection), else *default*.

    Each `order` entry is `(size_code, needle_tags)`; a size code matches when any of
    its needle tags is found in *tags* (substring test for a string, membership test
    for a collection). Checked largest-to-smallest by default — pass a custom `order`
    for call sites with extra/alternate needles per size (e.g. "dock_xl") or a
    different code set.
    """
    for code, needles in order:
        if any(needle in tags for needle in needles):
            return code
    return default
