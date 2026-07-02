"""Global constants defining exact XML `class` matches for datalake extraction."""

from __future__ import annotations

import re
from collections.abc import Iterable

from lxml import etree

_RE_DLC_PATH = re.compile(r"extensions/ego_dlc_(\w+?)/", re.IGNORECASE)


def dlc_from_path(file_path: str | None) -> str | None:
    """Return the DLC name from an asset path, or None for base-game assets.

    e.g. ``extensions/ego_dlc_boron/assets/...`` → ``"boron"``
    """
    if not file_path:
        return None
    m = _RE_DLC_PATH.search(file_path)
    return m.group(1) if m else None


def iter_elements(root: etree._Element) -> Iterable[etree._Element]:
    """Yield `root`'s direct children, skipping XML comment/PI nodes.

    lxml gives comment and processing-instruction nodes a callable `.tag`, which breaks
    naive `el.get(...)` calls — callers that iterate a root's raw children to read
    attributes need to filter those out first.
    """
    for el in root:
        if callable(el.tag):
            continue
        yield el


# Ships
SHIP_CLASSES = {"ship_xs", "ship_s", "ship_m", "ship_l", "ship_xl", "spacesuit"}

# Modules
MODULE_CLASSES = {
    "production",
    "habitation",
    "storage",
    "defencemodule",
    "dockarea",
    "pier",
    "buildmodule",
    "processingmodule",
    "welfaremodule",
    "connectionmodule",
}

# Equipment
EQUIPMENT_CLASSES = {
    "engine",
    "shieldgenerator",
    "weapon",
    "turret",
    "missilelauncher",
    "bomblauncher",
    "spacesuitlaser",
    "missileturret",
    "bullet",
    "missile",
    "bomb",
    "mine",
    "spacesuitbomb",
    "countermeasure",
    "satellite",
    "navbeacon",
    "resourceprobe",
    "scanner",
    "computer",
    "radar",
}
