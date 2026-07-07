from __future__ import annotations

import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any


class SQLiteSpool:
    """Disk-backed durable queue for events, so nothing is lost if Supabase
    is briefly unreachable.

    spool = SQLiteSpool(path)
    spool.enqueue(event_type, message, metadata)
    rows = spool.fetch_next_batch(10)  # marks rows as 'sending'
    spool.ack([id, ...])               # delivered -> remove
    spool.release([id, ...])           # failed -> retry later
    """

    def __init__(self, path: Path | str) -> None:
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(self._path), timeout=30, check_same_thread=False)
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                message TEXT NOT NULL,
                metadata TEXT NOT NULL,
                created_at REAL NOT NULL,
                sending INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.commit()
        with self._lock:
            self._conn.execute("UPDATE events SET sending = 0 WHERE sending != 0")
            self._conn.commit()

    def enqueue(self, event_type: str, message: str, metadata: dict[str, Any]) -> int:
        with self._lock:
            cursor = self._conn.execute(
                "INSERT INTO events (event_type, message, metadata, created_at, sending)"
                " VALUES (?, ?, ?, ?, 0)",
                (event_type, message, json.dumps(metadata or {}), time.time()),
            )
            self._conn.commit()
            return int(cursor.lastrowid)

    def fetch_next_batch(self, limit: int = 16) -> list[dict[str, Any]]:
        with self._lock:
            cursor = self._conn.execute(
                "SELECT id, event_type, message, metadata, created_at FROM events"
                " WHERE sending = 0 ORDER BY created_at ASC LIMIT ?",
                (limit,),
            )
            rows = cursor.fetchall()
            ids = [int(row[0]) for row in rows]
            if not ids:
                return []

            placeholders = ",".join("?" for _ in ids)
            self._conn.execute(f"UPDATE events SET sending = 1 WHERE id IN ({placeholders})", ids)
            self._conn.commit()

        result: list[dict[str, Any]] = []
        for row_id, event_type, message, metadata_text, created_at in rows:
            try:
                metadata = json.loads(metadata_text)
            except json.JSONDecodeError:
                metadata = {}
            result.append(
                {
                    "id": int(row_id),
                    "event_type": event_type,
                    "message": message,
                    "metadata": metadata,
                    "created_at": float(created_at),
                }
            )
        return result

    def ack(self, ids: list[int]) -> None:
        if not ids:
            return
        with self._lock:
            placeholders = ",".join("?" for _ in ids)
            self._conn.execute(f"DELETE FROM events WHERE id IN ({placeholders})", ids)
            self._conn.commit()

    def release(self, ids: list[int]) -> None:
        if not ids:
            return
        with self._lock:
            placeholders = ",".join("?" for _ in ids)
            self._conn.execute(f"UPDATE events SET sending = 0 WHERE id IN ({placeholders})", ids)
            self._conn.commit()

    def count(self) -> int:
        with self._lock:
            cursor = self._conn.execute("SELECT COUNT(1) FROM events")
            return int(cursor.fetchone()[0] or 0)

    def close(self) -> None:
        self._conn.close()
