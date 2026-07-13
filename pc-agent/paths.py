"""Where the agent keeps its files (.env, spool.db, agent.log).

Under PyInstaller (onefile), __file__ points into a temporary extraction
directory that is wiped on exit, so state must live next to the executable
instead. This helper returns the right base directory in both cases.
"""

from __future__ import annotations

import sys
from pathlib import Path


def app_dir() -> Path:
    if getattr(sys, "frozen", False):
        # Packaged: the folder containing MonitorixAgent.exe.
        return Path(sys.executable).resolve().parent
    # Running from source: the pc-agent folder.
    return Path(__file__).resolve().parent


def is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))
