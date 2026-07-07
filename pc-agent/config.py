from __future__ import annotations

import os
import platform
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True)
class Config:
    supabase_url: str
    supabase_service_role_key: str
    device_user_id: str
    device_name: str
    watch_paths: tuple[Path, ...]
    file_watch_recursive: bool
    file_event_cooldown_seconds: float
    usb_poll_interval_seconds: float
    process_poll_interval_seconds: float
    process_min_visible_seconds: float
    process_only_user_apps: bool
    supabase_timeout_seconds: float
    log_level: str


def _as_bool(value: str | None, default: bool) -> bool:
    if value is None or not value.strip():
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _as_float(value: str | None, default: float) -> float:
    if value is None or not value.strip():
        return default
    try:
        return float(value)
    except ValueError:
        return default


def _required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


def _default_watch_paths() -> tuple[Path, ...]:
    home = Path.home()
    candidates = (home / "Desktop", home / "Documents", home / "Downloads")
    return tuple(path for path in candidates if path.exists())


def _parse_watch_paths(raw: str | None) -> tuple[Path, ...]:
    if not raw or not raw.strip():
        return _default_watch_paths()

    seen: list[Path] = []
    for item in [part.strip() for part in raw.split(";") if part.strip()]:
        path = Path(item).expanduser()
        if path not in seen:
            seen.append(path)
    return tuple(seen)


def load_config() -> Config:
    base_dir = Path(__file__).resolve().parent
    load_dotenv(base_dir / ".env", override=True)

    return Config(
        supabase_url=_required("SUPABASE_URL"),
        supabase_service_role_key=_required("SUPABASE_SERVICE_ROLE_KEY"),
        device_user_id=_required("DEVICE_USER_ID"),
        device_name=os.getenv("DEVICE_NAME", "").strip() or platform.node() or "pc-agent",
        watch_paths=_parse_watch_paths(os.getenv("WATCH_PATHS")),
        file_watch_recursive=_as_bool(os.getenv("FILE_WATCH_RECURSIVE"), True),
        file_event_cooldown_seconds=max(_as_float(os.getenv("FILE_EVENT_COOLDOWN_SECONDS"), 1.0), 0.0),
        usb_poll_interval_seconds=max(_as_float(os.getenv("USB_POLL_INTERVAL_SECONDS"), 2.0), 0.2),
        process_poll_interval_seconds=max(_as_float(os.getenv("PROCESS_POLL_INTERVAL_SECONDS"), 2.0), 0.2),
        process_min_visible_seconds=max(_as_float(os.getenv("PROCESS_MIN_VISIBLE_SECONDS"), 6.0), 0.5),
        process_only_user_apps=_as_bool(os.getenv("PROCESS_ONLY_USER_APPS"), True),
        supabase_timeout_seconds=max(_as_float(os.getenv("SUPABASE_TIMEOUT_SECONDS"), 10.0), 1.0),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
    )
