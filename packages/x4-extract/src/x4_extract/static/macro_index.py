"""Shared walk over `index/macros.xml` entries, resolving each to its macro element.

`ships.py`, `equipment.py`, `modules.py`, and `station_types.py` each resolve the same
`index/macros.xml` -> `<entry name value>` -> macro file -> `<macro class=...>` chain,
differing only in which macro classes they keep and whether they dedupe by name.
"""

from __future__ import annotations

from collections.abc import Callable, Collection, Iterable

from lxml import etree


def iter_index_macros(
    index_bytes: bytes,
    resolve_path: Callable[[str], bytes],
    *,
    class_filter: Collection[str] | None = None,
    dedupe: bool = False,
) -> Iterable[tuple[str, str, etree._Element]]:
    """Yield `(macro_name, xml_path, macro_element)` for each resolvable index entry.

    Entries with a missing name/value, an unresolvable or unparsable macro file, or a
    macro whose `class` is not in `class_filter` (when given) are skipped. When `dedupe`
    is True, a name already yielded is skipped on subsequent entries.
    """
    root = etree.fromstring(index_bytes)
    seen: set[str] = set()

    for entry in root.iterfind("entry"):
        name = entry.get("name")
        if not name or (dedupe and name in seen):
            continue

        path = entry.get("value")
        if not path:
            continue

        # Paths in index use backslashes and omit the .xml extension
        xml_path = path.replace("\\", "/") + ".xml"
        try:
            macro_bytes = resolve_path(xml_path)
            macro_root = etree.fromstring(macro_bytes)
            macro_el = macro_root.find("macro")
            if macro_el is None:
                continue

            class_raw = macro_el.get("class", "")
            if class_filter is not None and class_raw not in class_filter:
                continue

        except (KeyError, OSError, etree.XMLSyntaxError):
            continue

        if dedupe:
            seen.add(name)

        yield name, xml_path, macro_el
