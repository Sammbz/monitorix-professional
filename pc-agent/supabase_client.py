from __future__ import annotations

import time
from typing import Any, Callable

import requests

from auth import refresh_session

OnSessionRefreshed = Callable[[str, str, str], None]  # (refresh_token, user_id, email)


class SupabaseRestClient:
    """Talks to Supabase's PostgREST API as a signed-in user (anon key +
    access token). Row Level Security applies exactly as it would for the
    mobile app — this agent only ever reads/writes what its own account owns.
    """

    def __init__(
        self,
        *,
        supabase_url: str,
        anon_key: str,
        timeout_seconds: float = 10.0,
        on_session_refreshed: OnSessionRefreshed | None = None,
    ) -> None:
        self._supabase_url = supabase_url.rstrip("/")
        self._rest_url = f"{self._supabase_url}/rest/v1"
        self._anon_key = anon_key
        self._timeout_seconds = timeout_seconds
        self._session = requests.Session()
        self._on_session_refreshed = on_session_refreshed

        self._access_token: str | None = None
        self._refresh_token: str | None = None
        self._expires_at: float = 0.0
        self.user_id: str | None = None
        self.email: str | None = None

    def apply_auth_response(self, data: dict[str, Any]) -> None:
        self._access_token = data["access_token"]
        self._refresh_token = data["refresh_token"]
        self._expires_at = time.time() + float(data.get("expires_in", 3600)) - 60
        self.user_id = str(data["user"]["id"])
        self.email = str(data["user"].get("email", ""))
        if self._on_session_refreshed:
            self._on_session_refreshed(self._refresh_token, self.user_id, self.email)

    def _ensure_fresh_token(self) -> None:
        if not self._access_token or time.time() >= self._expires_at:
            if not self._refresh_token:
                raise RuntimeError("No Supabase session available; sign in first.")
            data = refresh_session(
                base_url=self._supabase_url,
                anon_key=self._anon_key,
                refresh_token=self._refresh_token,
                timeout=self._timeout_seconds,
            )
            self.apply_auth_response(data)

    def _request(
        self,
        method: str,
        table: str,
        *,
        params: dict[str, str] | None = None,
        json_body: dict[str, Any] | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> Any:
        self._ensure_fresh_token()
        headers = {
            "apikey": self._anon_key,
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/json",
            **(extra_headers or {}),
        }
        response = self._session.request(
            method=method,
            url=f"{self._rest_url}/{table}",
            params=params,
            json=json_body,
            headers=headers,
            timeout=self._timeout_seconds,
        )
        if response.status_code >= 400:
            details = response.text.strip() or f"HTTP {response.status_code}"
            raise RuntimeError(f"Supabase request failed for '{table}': {details}")
        return response.json() if response.text.strip() else None

    def get_or_create_device_id(self, device_name: str) -> str:
        rows = self._request(
            "GET",
            "devices",
            params={
                "select": "id",
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
            json_body={"user_id": self.user_id, "name": device_name},
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
