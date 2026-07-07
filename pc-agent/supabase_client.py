from __future__ import annotations

from typing import Any

import requests


class SupabaseRestClient:
    """Talks to Supabase's PostgREST API using the service_role key, which
    bypasses Row Level Security. Only ever use this key server-side/agent-side
    — never ship it in the mobile app.
    """

    def __init__(self, supabase_url: str, service_role_key: str, timeout_seconds: float = 10.0) -> None:
        self._base_url = f"{supabase_url.rstrip('/')}/rest/v1"
        self._timeout_seconds = timeout_seconds
        self._session = requests.Session()
        self._session.headers.update(
            {
                "apikey": service_role_key,
                "Authorization": f"Bearer {service_role_key}",
                "Content-Type": "application/json",
            }
        )

    def _request(
        self,
        method: str,
        table: str,
        *,
        params: dict[str, str] | None = None,
        json_body: dict[str, Any] | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> Any:
        response = self._session.request(
            method=method,
            url=f"{self._base_url}/{table}",
            params=params,
            json=json_body,
            headers=extra_headers or {},
            timeout=self._timeout_seconds,
        )
        if response.status_code >= 400:
            details = response.text.strip() or f"HTTP {response.status_code}"
            raise RuntimeError(f"Supabase request failed for '{table}': {details}")
        return response.json() if response.text.strip() else None

    def get_or_create_device_id(self, *, user_id: str, device_name: str) -> str:
        rows = self._request(
            "GET",
            "devices",
            params={
                "select": "id",
                "user_id": f"eq.{user_id}",
                "name": f"eq.{device_name}",
                "order": "created_at.desc",
                "limit": "1",
            },
        )
        if rows:
            device_id = str(rows[0].get("id", "")).strip()
            if device_id:
                return device_id

        created = self._request(
            "POST",
            "devices",
            json_body={"user_id": user_id, "name": device_name},
            extra_headers={"Prefer": "return=representation"},
        )
        if not created:
            raise RuntimeError("Supabase returned an empty response while creating the device.")

        device_id = str(created[0].get("id", "")).strip()
        if not device_id:
            raise RuntimeError("Supabase did not return a valid device id.")
        return device_id

    def insert_event(
        self,
        *,
        device_id: str,
        event_type: str,
        message: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        payload = {
            "device_id": device_id,
            "event_type": event_type,
            "message": message,
            "metadata": metadata or {},
        }
        self._request("POST", "events", json_body=payload, extra_headers={"Prefer": "return=minimal"})
