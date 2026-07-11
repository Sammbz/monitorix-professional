from __future__ import annotations

from typing import Any

import requests


class SupabaseRestClient:
    """Talks to Supabase through two SECURITY DEFINER RPC functions
    (enroll_device / submit_event) using an organization-scoped enrollment
    token — this agent never signs in as a user. The token is validated
    server-side on every call; if it leaks, it only grants write access to
    one organization's devices/events, nothing else in the database.
    """

    def __init__(
        self,
        *,
        supabase_url: str,
        anon_key: str,
        enrollment_token: str,
        timeout_seconds: float = 10.0,
    ) -> None:
        self._rest_url = f"{supabase_url.rstrip('/')}/rest/v1"
        self._anon_key = anon_key
        self._token = enrollment_token
        self._timeout_seconds = timeout_seconds
        self._session = requests.Session()

    def _rpc(self, function_name: str, payload: dict[str, Any]) -> Any:
        response = self._session.post(
            f"{self._rest_url}/rpc/{function_name}",
            headers={
                "apikey": self._anon_key,
                "Authorization": f"Bearer {self._anon_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=self._timeout_seconds,
        )
        if response.status_code >= 400:
            details = response.text.strip() or f"HTTP {response.status_code}"
            raise RuntimeError(f"Supabase RPC '{function_name}' failed: {details}")
        return response.json() if response.text.strip() else None

    def get_or_create_device_id(self, device_name: str) -> str:
        device_id = self._rpc("enroll_device", {"p_token": self._token, "p_device_name": device_name})
        if not device_id:
            raise RuntimeError("enroll_device did not return a device id")
        return str(device_id)

    def heartbeat(self, device_id: str) -> None:
        """Bumps the device's last_seen_at without writing an event, so an
        idle machine still shows as online in the dashboard."""
        self._rpc("agent_heartbeat", {"p_token": self._token, "p_device_id": device_id})

    def insert_event(
        self,
        *,
        device_id: str,
        event_type: str,
        message: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self._rpc(
            "submit_event",
            {
                "p_token": self._token,
                "p_device_id": device_id,
                "p_event_type": event_type,
                "p_message": message,
                "p_metadata": metadata or {},
            },
        )
