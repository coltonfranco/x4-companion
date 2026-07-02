"""Small shared SQLite helpers used across the v1 route modules."""

from __future__ import annotations

import json
import sqlite3
from typing import Any, cast

from fastapi import HTTPException


def table_exists(conn: sqlite3.Connection, name: str) -> bool:
    """Whether a table (or attached-schema table, e.g. `s.wares`) exists.

    Used to detect not-yet-ingested saves — the dynamic DB is created with an empty
    schema before the first save is parsed, so plain queries against its tables would
    otherwise raise instead of letting the caller return an empty/placeholder response.
    """
    return bool(
        conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=:name",
            {"name": name},
        ).fetchone()
    )


def fetch_one_or_404(
    conn: sqlite3.Connection,
    sql: str,
    params: dict[str, Any],
    detail: str,
) -> sqlite3.Row:
    """Run a single-row query, raising 404 with `detail` if it has no match."""
    row = conn.execute(sql, params).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=detail)
    return cast(sqlite3.Row, row)


def build_where_clause(
    conditions: list[tuple[str, Any]],
) -> tuple[str, list[Any]]:
    """Join pre-filtered `(sql_fragment, param)` pairs into a `WHERE ...` clause.

    Callers append only the conditions that are actually active (e.g. skip a filter
    whose query param wasn't supplied) — this just does the shared `where: list[str]
    = []; params = []; ...; "WHERE " + " AND ".join(where)` bookkeeping every v1 route
    with optional filters used to hand-roll.

    Each fragment uses `?` placeholders. `param` is normally the single bind value for
    one `?`; pass a `list`/`tuple` of values for a fragment with multiple placeholders
    (e.g. `"(title LIKE ? OR text LIKE ?)"` paired with `[a, b]`), or an empty
    tuple/list for a fragment with no placeholder at all (e.g. a hardcoded `"x = 1"`).
    Returns `("", [])` when `conditions` is empty.
    """
    if not conditions:
        return "", []
    where = [fragment for fragment, _ in conditions]
    params: list[Any] = []
    for _, value in conditions:
        if isinstance(value, (list, tuple)):
            params.extend(value)
        else:
            params.append(value)
    return f"WHERE {' AND '.join(where)}", params


def paginate(sql: str, params: list[Any], limit: int, offset: int) -> tuple[str, list[Any]]:
    """Append `LIMIT ? OFFSET ?` to `sql` (positional-param style) and its params."""
    return f"{sql} LIMIT ? OFFSET ?", [*params, limit, offset]


def safe_json_loads(raw: str | None) -> dict[str, Any]:
    """Parse `raw` as a JSON object, returning `{}` on any failure or missing input.

    Several endpoints stash extra per-row metadata in an `extra_json` text column;
    callers apply their own field-specific extraction on the returned dict afterward.
    """
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def localized_text_sql(col: str) -> str:
    """SQL fragment resolving an in-game `{page_id,text_id}` text reference.

    Ship/station names are sometimes stored as a `{page_id,text_id}` reference into
    `s.texts` rather than a literal string; this returns the `SELECT ... FROM s.texts`
    subquery that looks it up. Callers wrap it in their own `CASE WHEN col LIKE
    '{%,%}' THEN (this) ELSE ... END` with a fallback chain that varies per call site.
    """
    return (
        f"(SELECT text FROM s.texts WHERE "
        f"page_id = CAST(SUBSTR({col}, 2, INSTR({col}, ',') - 2) AS INTEGER) AND "
        f"text_id = CAST(SUBSTR({col}, INSTR({col}, ',') + 1, "
        f"LENGTH({col}) - INSTR({col}, ',') - 1) AS INTEGER))"
    )
