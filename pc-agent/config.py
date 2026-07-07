from __future__ import annotations

import os
import platform
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Bundled so the agent works on a new PC with zero setup beyond signing in —
# no .env to copy over by hand. This is the anon key, the same one baked
# into the mobile app's client bundle: it is meant to be public and grants
# nothing by itself. Row Level Security (see supabase/schema.sql) is what
# actually restricts access, scoped to whichever account signs in — not
# this key. Override via SUPABASE_URL/SUPABASE_ANON_KEY env vars if you ever
# need to point the agent at a different Supabase project.
DEFAULT_SUPABASE_URL = "https://uwjfekekxwoqemhlvqbh.supabase.co"
DEFAULT_SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3amZla2VreHdvcWVtaGx2cWJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MTg2MTcsImV4cCI6MjA5ODk5NDYxN30."
    "WYZn_n5ZSEU3KRNjNKDtuNYZ9esaD0XuarAAsl77Szw"
)


@dataclass(frozen=True)
class Config:
    supabase_url: str
    supabase_anon_key: str
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
        supabase_url=os.getenv("SUPABASE_URL", "").strip() or DEFAULT_SUPABASE_URL,
        supabase_anon_key=os.getenv("SUPABASE_ANON_KEY", "").strip() or DEFAULT_SUPABASE_ANON_KEY,
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
