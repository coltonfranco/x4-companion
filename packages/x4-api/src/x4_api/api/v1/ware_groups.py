"""REST endpoints for ware group catalog."""

from __future__ import annotations

from x4_api.api.catalog_router import simple_catalog_router
from x4_api.api.schemas import PublicModel


class WareGroup(PublicModel):
    group_id: str
    name: str | None
    tags: str | None
    factory_name: str | None
    icon: str | None
    factory_map_icon: str | None
    factory_hud_icon: str | None
    tier: int | None
    priority: int | None


_COLUMNS = (
    "group_id, name, tags, factory_name, icon, factory_map_icon, factory_hud_icon, tier, priority"
)

router = simple_catalog_router(
    path_prefix="/ware-groups",
    table="s.ware_groups",
    list_columns=_COLUMNS,
    list_model=WareGroup,
    detail_columns=_COLUMNS,
    detail_model=WareGroup,
    list_order_by="COALESCE(priority, 99), group_id",
    id_col="group_id",
    id_param_name="group_id",
)
