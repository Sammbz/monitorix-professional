from __future__ import annotations

import logging
import signal
import threading
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

from config import load_config
from spool import SQLiteSpool
from supabase_client import SupabaseRestClient
from watchers import run_file_watcher, run_process_watcher, run_usb_watcher

logger = logging.getLogger("pc-agent")


def configure_logging(level: str, log_file: Path | None) -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler()]
    if log_file is not None:
        # Rotating so an always-on agent can't fill the disk.
        handlers.append(RotatingFileHandler(log_file, maxBytes=5 * 1024 * 1024, backupCount=2, encoding="utf-8"))
    logging.basicConfig(
        level=getattr(logging, level, logging.INFO),
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        handlers=handlers,
    )


def run_event_sender(
    *,
    stop_event: threading.Event,
    spool: SQLiteSpool,
    client: SupabaseRestClient,
    device_name: str,
    device_id: str | None,
) -> None:
    """Drains the spool to Supabase. Keeps retrying the device id lookup if
    it wasn't available at startup (e.g. Supabase was unreachable)."""
    while not stop_event.is_set() or spool.count() > 0:
        batch = spool.fetch_next_batch(limit=16)
        if not batch:
            time.sleep(0.5)
            continue

        sent_ids: list[int] = []
        retry_ids: list[int] = []
        for row in batch:
            if not device_id:
                try:
                    device_id = client.get_or_create_device_id(device_name)
                    logger.info("Obtained device id: %s", device_id)
                except Exception:
                    logger.exception("Could not obtain device id; will retry")
                    retry_ids.append(row["id"])
                    continue
            try:
                client.insert_event(
                    device_id=device_id,
                    event_type=row["event_type"],
                    message=row["message"],
                    metadata=row["metadata"],
                )
                sent_ids.append(row["id"])
            except Exception:
                logger.exception("Failed to send event id=%s type=%s", row["id"], row["event_type"])
                retry_ids.append(row["id"])

        spool.ack(sent_ids)
        spool.release(retry_ids)

        # Whole batch failed (offline, or server-side rate limit): back off
        # instead of hammering the API with immediate retries.
        if retry_ids and not sent_ids:
            time.sleep(5)


def run_heartbeat(
    *,
    stop_event: threading.Event,
    client: SupabaseRestClient,
    device_name: str,
    device_id: str | None,
    interval_seconds: float,
) -> None:
    """Pings agent_heartbeat so the dashboard shows this device as online
    even when there is no user activity to report. enroll_device is
    idempotent, so retrying the device id lookup here is safe even if the
    sender thread is doing the same."""
    while not stop_event.wait(interval_seconds):
        try:
            if not device_id:
                device_id = client.get_or_create_device_id(device_name)
            client.heartbeat(device_id)
        except Exception:
            logger.debug("Heartbeat failed; will retry", exc_info=True)


def main() -> int:
    config = load_config()
    configure_logging(config.log_level, config.log_file)
    logger.info("Starting pc-agent as device '%s'", config.device_name)

    base_dir = Path(__file__).resolve().parent
    spool = SQLiteSpool(base_dir / "spool.db")

    client = SupabaseRestClient(
        supabase_url=config.supabase_url,
        anon_key=config.supabase_anon_key,
        enrollment_token=config.enrollment_token,
        timeout_seconds=config.supabase_timeout_seconds,
    )

    device_id: str | None = None
    try:
        device_id = client.get_or_create_device_id(config.device_name)
        logger.info("Enrolled as device id: %s", device_id)
    except Exception:
        logger.warning("Could not reach Supabase at startup; will retry while sending events")

    stop_event = threading.Event()
    shutdown_event = threading.Event()

    def enqueue(event_type: str, message: str, metadata: dict[str, Any]) -> None:
        try:
            spool.enqueue(event_type, message, metadata or {})
        except Exception:
            logger.exception("Failed to enqueue event: %s", event_type)

    def request_shutdown(signum: int, _frame: Any) -> None:
        logger.info("Signal %s received, shutting down...", signum)
        shutdown_event.set()

    signal.signal(signal.SIGINT, request_shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, request_shutdown)

    sender_thread = threading.Thread(
        target=run_event_sender,
        kwargs={
            "stop_event": stop_event,
            "spool": spool,
            "client": client,
            "device_name": config.device_name,
            "device_id": device_id,
        },
        name="event-sender",
        daemon=True,
    )
    sender_thread.start()

    heartbeat_thread = threading.Thread(
        target=run_heartbeat,
        kwargs={
            "stop_event": stop_event,
            "client": client,
            "device_name": config.device_name,
            "device_id": device_id,
            "interval_seconds": config.heartbeat_interval_seconds,
        },
        name="heartbeat",
        daemon=True,
    )
    heartbeat_thread.start()

    observer = run_file_watcher(
        watch_paths=config.watch_paths,
        recursive=config.file_watch_recursive,
        cooldown_seconds=config.file_event_cooldown_seconds,
        callback=enqueue,
        # Never report the agent's own state files (spool db) as user
        # activity — otherwise writing an event modifies spool.db-wal,
        # which would be detected and re-enqueued as another event, forever.
        ignored_dirs=(base_dir,),
    )

    usb_thread = threading.Thread(
        target=run_usb_watcher,
        kwargs={
            "stop_event": stop_event,
            "interval_seconds": config.usb_poll_interval_seconds,
            "callback": enqueue,
        },
        name="usb-watcher",
        daemon=True,
    )
    usb_thread.start()

    process_thread = threading.Thread(
        target=run_process_watcher,
        kwargs={
            "stop_event": stop_event,
            "interval_seconds": config.process_poll_interval_seconds,
            "min_visible_seconds": config.process_min_visible_seconds,
            "only_user_apps": config.process_only_user_apps,
            "callback": enqueue,
        },
        name="process-watcher",
        daemon=True,
    )
    process_thread.start()

    enqueue("AGENT_STARTED", "Monitoring agent started", {"watch_paths": [str(p) for p in config.watch_paths]})

    try:
        while not shutdown_event.is_set():
            time.sleep(0.5)
    except KeyboardInterrupt:
        shutdown_event.set()
    finally:
        if observer is not None:
            observer.stop()
            observer.join(timeout=10)

        stop_event.set()
        usb_thread.join(timeout=10)
        process_thread.join(timeout=10)
        heartbeat_thread.join(timeout=10)

        enqueue("AGENT_STOPPED", "Monitoring agent stopped", {})
        sender_thread.join(timeout=10)
        spool.close()

    logger.info("Agent stopped cleanly.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
