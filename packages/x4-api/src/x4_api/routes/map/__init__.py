"""Map topology sub-package.

Split from the original map.py monolith. Each sub-module registers routes
on the shared `router` defined here.
"""

from fastapi import APIRouter

router = APIRouter()

from . import clusters as clusters  # noqa: E402
from . import conflicts as conflicts  # noqa: E402
from . import gates as gates  # noqa: E402
from . import regions as regions  # noqa: E402
from . import resources as resources  # noqa: E402
from . import sectors as sectors  # noqa: E402
from . import stations as stations  # noqa: E402
from . import zones as zones  # noqa: E402
