"""Factory for the flat "list all + get by id" REST skeleton shared by the
static reference-data catalogs (ware groups, mission groups, races, ...).

Endpoints with route-specific behavior beyond that skeleton (query-param
filtering on the list, joined/nested detail data) build their own route
instead of taking it fully from the factory — see `mission_groups.py` /
`equip_mods.py` for the `include_list=False` + custom list route pattern.
"""

from __future__ import annotations

import sqlite3
from collections.abc import Callable
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Path

from x4_api.deps import get_db
from x4_api.routes._db import fetch_one_or_404
from x4_api.schemas import PublicModel


def simple_catalog_router[ModelT: PublicModel](
    *,
    path_prefix: str,
    table: str,
    list_columns: str,
    list_model: type[ModelT],
    detail_columns: str,
    detail_model: type[ModelT],
    list_order_by: str,
    id_col: str,
    id_param_name: str,
    row_hook: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
    include_list: bool = True,
) -> APIRouter:
    """Build a router exposing `GET {path_prefix}` and `GET {path_prefix}/{{id}}`.

    `row_hook`, if given, is applied to every row dict (list and detail alike)
    before the Pydantic model is constructed — e.g. for icon_url injection.
    `id_param_name` becomes both the URL path segment name and the OpenAPI
    parameter name, matching what a hand-written route would use (the actual
    Python parameter name inside this factory is irrelevant to callers).
    Pass `include_list=False` when the caller needs a hand-written list route
    (e.g. optional query-param filters) but still wants the flat detail route.
    """
    router = APIRouter()

    def _row(d: dict[str, Any]) -> dict[str, Any]:
        return row_hook(d) if row_hook is not None else d

    if include_list:

        @router.get(path_prefix, response_model=list[list_model])  # type: ignore[valid-type]
        def _list(conn: Annotated[sqlite3.Connection, Depends(get_db)]) -> list[Any]:
            rows = conn.execute(
                f"SELECT {list_columns} FROM {table} ORDER BY {list_order_by}"
            ).fetchall()
            return [list_model(**_row(dict(r))) for r in rows]

    @router.get(f"{path_prefix}/{{{id_param_name}}}", response_model=detail_model)
    def _detail(
        conn: Annotated[sqlite3.Connection, Depends(get_db)],
        entity_id: str = Path(..., alias=id_param_name),
    ) -> Any:
        row = fetch_one_or_404(
            conn,
            f"SELECT {detail_columns} FROM {table} WHERE {id_col} = :id",
            {"id": entity_id},
            f"Unknown {id_param_name}: {entity_id}",
        )
        return detail_model(**_row(dict(row)))

    return router
