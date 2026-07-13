"""Optional system-tray presence for the agent.

A visible tray icon turns the agent from a hidden background process into a
transparent one: the user can see monitoring is active, read the logs, and
quit it. This is both a UX nicety and a compliance signal (GDPR-friendly
"the employee knows they are monitored").

Everything here degrades gracefully: if pystray/Pillow aren't installed, or
the platform has no tray, run_tray_icon() logs a warning and returns None,
and the agent keeps running headless exactly as before.
"""

from __future__ import annotations

import logging
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable

logger = logging.getLogger("pc-agent")


def _build_image() -> Any:
    """A small teal disc with a white dot — no external asset file needed."""
    from PIL import Image, ImageDraw

    size = 64
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((4, 4, size - 4, size - 4), fill=(13, 148, 136, 255))  # brand teal
    draw.ellipse((23, 23, size - 23, size - 23), fill=(255, 255, 255, 255))
    return image


def _open_path(path: Path) -> None:
    try:
        if sys.platform.startswith("win"):
            os.startfile(str(path))  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(path)])
        else:
            subprocess.Popen(["xdg-open", str(path)])
    except Exception:
        logger.exception("Could not open %s", path)


def run_tray_icon(
    *,
    device_name: str,
    log_file: Path | None,
    on_quit: Callable[[], None],
) -> Any | None:
    """Starts a detached tray icon. Returns the icon (call .stop() on it at
    shutdown) or None when a tray isn't available."""
    try:
        import pystray
        from pystray import Menu, MenuItem
    except Exception:
        logger.warning("pystray/Pillow not available; running without a tray icon")
        return None

    def _quit(icon: Any, _item: Any) -> None:
        on_quit()
        icon.stop()

    menu_items = [
        MenuItem(f"Monitorix — surveillance active", None, enabled=False),
        MenuItem(f"Appareil : {device_name}", None, enabled=False),
        Menu.SEPARATOR,
    ]
    if log_file is not None:
        menu_items.append(MenuItem("Ouvrir les logs", lambda _i, _it: _open_path(log_file)))
    menu_items.append(MenuItem("Quitter", _quit))

    try:
        icon = pystray.Icon(
            "monitorix",
            icon=_build_image(),
            title=f"Monitorix — {device_name}",
            menu=Menu(*menu_items),
        )
        # Detached: sets up the icon on its own thread, doesn't block main().
        icon.run_detached()
        logger.info("Tray icon started")
        return icon
    except Exception:
        logger.exception("Failed to start tray icon; continuing headless")
        return None
