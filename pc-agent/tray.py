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


# --- "Start with Windows" via a per-user registry Run key (no admin needed) ---

_RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
_RUN_NAME = "MonitorixAgent"


def _autostart_enabled() -> bool:
    if not sys.platform.startswith("win"):
        return False
    try:
        import winreg

        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, _RUN_KEY) as key:
            winreg.QueryValueEx(key, _RUN_NAME)
        return True
    except Exception:
        return False


def _set_autostart(enable: bool) -> None:
    if not sys.platform.startswith("win"):
        return
    import winreg

    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, _RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
            if enable:
                winreg.SetValueEx(key, _RUN_NAME, 0, winreg.REG_SZ, f'"{sys.executable}"')
            else:
                try:
                    winreg.DeleteValue(key, _RUN_NAME)
                except FileNotFoundError:
                    pass
    except Exception:
        logger.exception("Could not update the autostart setting")


def run_tray_icon(
    *,
    device_name: str,
    log_file: Path | None,
    on_quit: Callable[[], None],
    is_paused: Callable[[], bool] | None = None,
    toggle_pause: Callable[[], None] | None = None,
    on_configure: Callable[[], None] | None = None,
    autostart_supported: bool = False,
) -> Any | None:
    """Starts a detached tray icon. Returns the icon (call .stop() on it at
    shutdown) or None when a tray isn't available."""
    try:
        import pystray
        from pystray import Menu, MenuItem
    except Exception:
        logger.warning("pystray/Pillow not available; running without a tray icon")
        return None

    def _status_text(_item: Any) -> str:
        if is_paused is not None and is_paused():
            return "Monitorix — en pause"
        return "Monitorix — surveillance active"

    def _quit(icon: Any, _item: Any) -> None:
        on_quit()
        icon.stop()

    menu_items: list[Any] = [
        MenuItem(_status_text, None, enabled=False),
        MenuItem(f"Appareil : {device_name}", None, enabled=False),
        Menu.SEPARATOR,
    ]

    if toggle_pause is not None and is_paused is not None:
        def _toggle(icon: Any, _item: Any) -> None:
            toggle_pause()
            icon.update_menu()  # refresh the dynamic labels

        menu_items.append(
            MenuItem(lambda _item: "Reprendre" if is_paused() else "Mettre en pause", _toggle)
        )

    if log_file is not None:
        menu_items.append(MenuItem("Ouvrir les logs", lambda _i, _it: _open_path(log_file)))
    if on_configure is not None:
        menu_items.append(MenuItem("Configurer le code…", lambda _i, _it: on_configure()))

    if autostart_supported:
        def _toggle_autostart(icon: Any, _item: Any) -> None:
            _set_autostart(not _autostart_enabled())
            icon.update_menu()

        menu_items.append(
            MenuItem("Démarrer avec Windows", _toggle_autostart, checked=lambda _item: _autostart_enabled())
        )

    menu_items.append(Menu.SEPARATOR)
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
