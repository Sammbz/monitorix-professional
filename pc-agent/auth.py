from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import requests

logger = logging.getLogger("pc-agent")


class AuthError(RuntimeError):
    pass


def _token_request(
    *, base_url: str, anon_key: str, grant_type: str, payload: dict[str, Any], timeout: float
) -> dict[str, Any]:
    response = requests.post(
        f"{base_url.rstrip('/')}/auth/v1/token",
        params={"grant_type": grant_type},
        headers={"apikey": anon_key, "Content-Type": "application/json"},
        json=payload,
        timeout=timeout,
    )
    if response.status_code >= 400:
        details = response.text.strip() or f"HTTP {response.status_code}"
        raise AuthError(f"Supabase sign-in failed: {details}")
    return response.json()


def sign_in_with_password(
    *, base_url: str, anon_key: str, email: str, password: str, timeout: float
) -> dict[str, Any]:
    return _token_request(
        base_url=base_url,
        anon_key=anon_key,
        grant_type="password",
        payload={"email": email, "password": password},
        timeout=timeout,
    )


def refresh_session(*, base_url: str, anon_key: str, refresh_token: str, timeout: float) -> dict[str, Any]:
    return _token_request(
        base_url=base_url,
        anon_key=anon_key,
        grant_type="refresh_token",
        payload={"refresh_token": refresh_token},
        timeout=timeout,
    )


def prompt_for_credentials() -> tuple[str, str]:
    # Plain input() rather than getpass(): some terminals (e.g. IDE-integrated
    # consoles on Windows) mis-capture keystrokes under getpass's hidden-input
    # mode, silently corrupting the password. This is a one-time prompt (the
    # session is cached afterwards), so visible input is an acceptable trade.
    print("Sign in with your Monitorix account (same email/password as the mobile app).")
    email = input("Email: ").strip()
    password = input("Password: ")
    return email, password


def load_stored_session(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return None


def save_stored_session(path: Path, *, refresh_token: str, user_id: str, email: str) -> None:
    try:
        path.write_text(json.dumps({"refresh_token": refresh_token, "user_id": user_id, "email": email}))
    except OSError:
        logger.exception("Failed to persist session to %s", path)
