"""Extract `libraries/assignments.xml` into the `assignments` table."""

from __future__ import annotations

from x4_extract.static.id_name import make_id_name_extractor

extract, write = make_id_name_extractor(
    item_tag="assignment", id_column="assignment_id", table="assignments"
)
