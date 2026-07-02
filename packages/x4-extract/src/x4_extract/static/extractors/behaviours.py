"""Extract `libraries/behaviours.xml` into the `behaviours` table."""

from __future__ import annotations

from x4_extract.static.id_name import make_id_name_extractor

extract, write = make_id_name_extractor(
    item_tag="behaviour", id_column="behaviour_id", table="behaviours"
)
