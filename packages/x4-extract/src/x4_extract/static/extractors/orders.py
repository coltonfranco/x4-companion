"""Extract `<order>` definitions (from aiscript XML) into the `orders` table."""

from __future__ import annotations

from x4_extract.static.id_name import make_id_name_extractor

extract, write = make_id_name_extractor(item_tag="order", id_column="order_id", table="orders")
