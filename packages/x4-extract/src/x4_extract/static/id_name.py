"""Helpers for simple static id/name catalog extractors."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable, MutableSequence
from dataclasses import dataclass, field

from lxml import etree


def append_id_name_rows(
    xml_bytes: bytes,
    *,
    item_tag: str,
    id_column: str,
    rows: MutableSequence[dict[str, str | None]],
) -> None:
    """Append rows from simple XML elements that expose `id` and `name` attributes."""
    root = etree.fromstring(xml_bytes)
    for el in root.iterfind(item_tag):
        item_id = el.get("id")
        if item_id:
            rows.append({id_column: item_id, "name": el.get("name")})


@dataclass(slots=True)
class IdNameResult:
    rows: list[dict[str, str | None]] = field(default_factory=list)


def make_id_name_extractor(
    *, item_tag: str, id_column: str, table: str
) -> tuple[
    Callable[[bytes], IdNameResult],
    Callable[[sqlite3.Connection, IdNameResult], None],
]:
    """Build `(extract, write)` functions for a flat `<item_tag id name>` -> table catalog.

    `assignments.xml`, `behaviours.xml`, and `orders.xml` (aiscript orders) are all this
    exact shape — a top-level element with only `id` and `name` attributes replacing one
    table wholesale. `table`/`id_column` are the only difference between them.
    """

    def extract(xml_bytes: bytes) -> IdNameResult:
        out = IdNameResult()
        append_id_name_rows(xml_bytes, item_tag=item_tag, id_column=id_column, rows=out.rows)
        return out

    def write(conn: sqlite3.Connection, result: IdNameResult) -> None:
        conn.execute(f"DELETE FROM {table}")
        conn.executemany(
            f"INSERT INTO {table} ({id_column}, name) VALUES (:{id_column}, :name)",
            result.rows,
        )

    return extract, write
