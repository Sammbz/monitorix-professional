from __future__ import annotations

import ctypes
import json
import logging
import platform
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Callable

import psutil
from watchdog.events import FileSystemEvent, FileSystemEventHandler, FileSystemMovedEvent
from watchdog.observers import Observer

logger = logging.getLogger("pc-agent")

EventCallback = Callable[[str, str, dict[str, Any]], None]

_DRIVE_REMOVABLE = 2

SYSTEM_PROCESS_NAMES = {
    "applicationframehost.exe",
    "backgroundtaskhost.exe",
    "conhost.exe",
    "ctfmon.exe",
    "dllhost.exe",
    "dwm.exe",
    "lockapp.exe",
    "msedgewebview2.exe",
    "runtimebroker.exe",
    "searchapp.exe",
    "searchhost.exe",
    "securityhealthsystray.exe",
    "shellexperiencehost.exe",
    "startmenuexperiencehost.exe",
    "taskhostw.exe",
    "textinputhost.exe",
    "widgets.exe",
}


# --- File & folder watcher ---------------------------------------------------


class FileChangeHandler(FileSystemEventHandler):
    def __init__(
        self,
        callback: EventCallback,
        cooldown_seconds: float,
        ignored_dirs: tuple[Path, ...] = (),
    ) -> None:
        self._callback = callback
        self._cooldown_seconds = cooldown_seconds
        self._ignored_dirs = ignored_dirs
        self._last_seen: dict[tuple[str, str], float] = {}
        self._lock = threading.Lock()

    def _is_ignored(self, *paths: str) -> bool:
        return any(Path(p).is_relative_to(ignored) for p in paths for ignored in self._ignored_dirs)

    def _emit(self, *, event_type: str, message: str, metadata: dict[str, Any], dedupe_key: str) -> None:
        if self._cooldown_seconds > 0:
            key = (event_type, dedupe_key.lower())
            now = time.monotonic()
            with self._lock:
                if now - self._last_seen.get(key, 0.0) < self._cooldown_seconds:
                    return
                self._last_seen[key] = now
        self._callback(event_type, message, metadata)

    def on_created(self, event: FileSystemEvent) -> None:
        path = str(Path(event.src_path))
        if self._is_ignored(path):
            return
        if event.is_directory:
            self._emit(
                event_type="DIRECTORY_CREATED",
                message="Directory created or copied",
                metadata={"path": path},
                dedupe_key=path,
            )
        else:
            self._emit(
                event_type="FILE_CREATED",
                message="File created or copied",
                metadata={"path": path},
                dedupe_key=path,
            )

    def on_deleted(self, event: FileSystemEvent) -> None:
        path = str(Path(event.src_path))
        if self._is_ignored(path):
            return
        event_type = "DIRECTORY_DELETED" if event.is_directory else "FILE_DELETED"
        message = "Directory deleted" if event.is_directory else "File deleted"
        self._emit(event_type=event_type, message=message, metadata={"path": path}, dedupe_key=path)

    def on_modified(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        path = str(Path(event.src_path))
        if self._is_ignored(path):
            return
        self._emit(
            event_type="FILE_MODIFIED",
            message="File modified",
            metadata={"path": path},
            dedupe_key=path,
        )

    def on_moved(self, event: FileSystemMovedEvent) -> None:
        src_path = str(Path(event.src_path))
        dest_path = str(Path(event.dest_path))
        if self._is_ignored(src_path, dest_path):
            return
        event_type = "DIRECTORY_MOVED" if event.is_directory else "FILE_MOVED"
        message = "Directory moved" if event.is_directory else "File moved"
        self._emit(
            event_type=event_type,
            message=message,
            metadata={"src_path": src_path, "dest_path": dest_path},
            dedupe_key=f"{src_path}->{dest_path}",
        )


def run_file_watcher(
    *,
    watch_paths: tuple[Path, ...],
    recursive: bool,
    cooldown_seconds: float,
    callback: EventCallback,
    ignored_dirs: tuple[Path, ...] = (),
) -> Observer | None:
    """Starts a background Observer watching the given paths. Returns None if
    no valid folder was found (nothing to stop later)."""
    handler = FileChangeHandler(callback, cooldown_seconds=cooldown_seconds, ignored_dirs=ignored_dirs)
    observer: Observer | None = None

    for path in watch_paths:
        if not path.is_dir():
            logger.warning("Watch path missing or not a directory, skipping: %s", path)
            continue
        if observer is None:
            observer = Observer()
        observer.schedule(handler, str(path), recursive=recursive)
        logger.info("Watching path: %s (recursive=%s)", path, recursive)

    if observer is not None:
        observer.start()
    else:
        logger.warning("No valid folders to watch; file watcher disabled.")
    return observer


# --- USB watcher (Windows only) ----------------------------------------------


def _windows_removable_drives() -> set[str]:
    kernel32 = ctypes.windll.kernel32
    bitmask = int(kernel32.GetLogicalDrives())
    drives: set[str] = set()
    for index in range(26):
        if not bitmask & (1 << index):
            continue
        drive = f"{chr(ord('A') + index)}:\\"
        if int(kernel32.GetDriveTypeW(ctypes.c_wchar_p(drive))) == _DRIVE_REMOVABLE:
            drives.add(drive)
    return drives


def _windows_usb_pnp_devices() -> dict[str, dict[str, str]]:
    command = [
        "powershell.exe",
        "-NoProfile",
        "-Command",
        (
            "Get-CimInstance Win32_PnPEntity "
            "| Where-Object { $_.PNPDeviceID -like 'USB\\\\*' } "
            "| Select-Object PNPDeviceID,Name,Status "
            "| ConvertTo-Json -Compress"
        ),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=15)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "PowerShell USB query failed")

    payload = result.stdout.strip()
    if not payload:
        return {}

    parsed = json.loads(payload)
    records = parsed if isinstance(parsed, list) else [parsed]
    mapped: dict[str, dict[str, str]] = {}
    for item in records:
        if not isinstance(item, dict):
            continue
        instance_id = str(item.get("PNPDeviceID", "")).strip()
        if instance_id:
            mapped[instance_id] = {
                "name": str(item.get("Name", "")).strip(),
                "status": str(item.get("Status", "")).strip(),
            }
    return mapped


def run_usb_watcher(*, stop_event: threading.Event, interval_seconds: float, callback: EventCallback) -> None:
    if platform.system().lower() != "windows":
        logger.info("USB watcher only supports Windows; disabled on this platform.")
        return

    known_drives = _windows_removable_drives()
    pnp_scan_enabled = True
    try:
        known_devices = _windows_usb_pnp_devices()
    except Exception as exc:
        logger.warning("USB device scan disabled: %s", exc)
        known_devices = {}
        pnp_scan_enabled = False

    while not stop_event.wait(interval_seconds):
        current_drives = _windows_removable_drives()
        for drive in sorted(current_drives - known_drives):
            callback("USB_INSERTED", "USB drive inserted", {"drive": drive})
        for drive in sorted(known_drives - current_drives):
            callback("USB_REMOVED", "USB drive removed", {"drive": drive})
        known_drives = current_drives

        if not pnp_scan_enabled:
            continue

        try:
            current_devices = _windows_usb_pnp_devices()
        except Exception as exc:
            logger.warning("USB device scan disabled: %s", exc)
            pnp_scan_enabled = False
            continue

        for instance_id in sorted(current_devices.keys() - known_devices.keys()):
            device = current_devices[instance_id]
            callback(
                "USB_DEVICE_CONNECTED",
                f"USB device connected: {device.get('name') or instance_id}",
                {"instance_id": instance_id, **device},
            )
        for instance_id in sorted(known_devices.keys() - current_devices.keys()):
            device = known_devices[instance_id]
            callback(
                "USB_DEVICE_DISCONNECTED",
                f"USB device disconnected: {device.get('name') or instance_id}",
                {"instance_id": instance_id, **device},
            )
        known_devices = current_devices


# --- Process / app watcher ---------------------------------------------------


def _is_user_app(name: str, exe_path: str) -> bool:
    normalized_name = name.lower()
    normalized_exe = exe_path.replace("/", "\\").lower()
    if normalized_name in SYSTEM_PROCESS_NAMES:
        return False
    if normalized_exe.startswith("c:\\windows\\") or "\\windows\\system32\\" in normalized_exe:
        return False
    if "\\windowsapps\\microsoft." in normalized_exe:
        return False
    return True


def _scan_processes(*, only_user_apps: bool) -> dict[int, dict[str, str]]:
    processes: dict[int, dict[str, str]] = {}
    for proc in psutil.process_iter(["pid", "name", "exe"]):
        try:
            info = proc.info
            pid = int(info.get("pid") or 0)
            name = str(info.get("name") or "").strip()
            exe = str(info.get("exe") or "").strip()
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess, ValueError):
            continue
        if pid <= 0 or not name:
            continue
        if only_user_apps and not _is_user_app(name, exe):
            continue
        processes[pid] = {"name": name, "exe": exe}
    return processes


def run_process_watcher(
    *,
    stop_event: threading.Event,
    interval_seconds: float,
    min_visible_seconds: float,
    only_user_apps: bool,
    callback: EventCallback,
) -> None:
    baseline = set(_scan_processes(only_user_apps=only_user_apps).keys())
    first_seen = {pid: time.monotonic() for pid in baseline}
    opened_emitted: set[int] = set()
    known = _scan_processes(only_user_apps=only_user_apps)

    while not stop_event.wait(interval_seconds):
        current = _scan_processes(only_user_apps=only_user_apps)
        now = time.monotonic()

        for pid in current:
            first_seen.setdefault(pid, now)

        for pid in sorted(current.keys() - opened_emitted - baseline):
            if now - first_seen[pid] < min_visible_seconds:
                continue
            process = current[pid]
            app_name = Path(process["exe"]).name if process["exe"] else process["name"]
            callback(
                "APP_OPENED",
                f"Application opened: {app_name}",
                {"pid": pid, "name": process["name"], "exe": process["exe"]},
            )
            opened_emitted.add(pid)

        for pid in sorted(known.keys() - current.keys()):
            visible_for = max(0.0, now - first_seen.get(pid, now))
            if pid in opened_emitted and visible_for >= min_visible_seconds:
                process = known[pid]
                app_name = Path(process["exe"]).name if process["exe"] else process["name"]
                callback(
                    "APP_CLOSED",
                    f"Application closed: {app_name}",
                    {
                        "pid": pid,
                        "name": process["name"],
                        "exe": process["exe"],
                        "visible_seconds": round(visible_for, 1),
                    },
                )
            first_seen.pop(pid, None)
            opened_emitted.discard(pid)
            baseline.discard(pid)

        known = current
