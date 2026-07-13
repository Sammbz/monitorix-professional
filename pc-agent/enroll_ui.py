"""Small GUI to paste the enrollment code and connect the agent.

Uses tkinter (bundled with Python, no install). Shown on first launch when
no ENROLLMENT_TOKEN is set, and reachable later from the tray menu. Writes
the token into the agent's .env so it persists across restarts.

Can also be run standalone:  python enroll_ui.py
"""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger("pc-agent")


def _write_token_to_env(env_path: Path, token: str) -> None:
    """Sets/updates ENROLLMENT_TOKEN in .env without touching other lines."""
    line = f"ENROLLMENT_TOKEN={token}"
    if env_path.exists():
        lines = env_path.read_text(encoding="utf-8").splitlines()
        replaced = False
        for i, existing in enumerate(lines):
            if existing.strip().startswith("ENROLLMENT_TOKEN="):
                lines[i] = line
                replaced = True
                break
        if not replaced:
            lines.append(line)
        env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    else:
        env_path.write_text(line + "\n", encoding="utf-8")


def prompt_for_token(env_path: Path, current: str = "") -> str | None:
    """Opens the connect window. Returns the saved token, or None if the user
    cancelled / a GUI isn't available. Must be called on the main thread."""
    try:
        import tkinter as tk
        from tkinter import messagebox
    except Exception:
        logger.warning("tkinter not available; cannot show the connect window")
        return None

    result: dict[str, str | None] = {"token": None}

    root = tk.Tk()
    root.title("Monitorix — Connexion")
    root.resizable(False, False)
    root.configure(bg="#0A0B0E")

    pad = {"padx": 20}

    tk.Label(root, text="MONITORIX", fg="#2DD4BF", bg="#0A0B0E",
             font=("Segoe UI", 11, "bold")).pack(pady=(20, 4), **pad)
    tk.Label(root, text="Collez votre code d'enrôlement", fg="#EDEEF0", bg="#0A0B0E",
             font=("Segoe UI", 12)).pack(**pad)
    tk.Label(root, text="Obtenu depuis le dashboard : Enrollment token.", fg="#8A8F98",
             bg="#0A0B0E", font=("Segoe UI", 9)).pack(pady=(0, 12), **pad)

    entry = tk.Entry(root, width=44, font=("Consolas", 11), justify="center")
    entry.insert(0, current)
    entry.pack(**pad)
    entry.focus_set()

    error_label = tk.Label(root, text="", fg="#F87171", bg="#0A0B0E", font=("Segoe UI", 9))
    error_label.pack(pady=(6, 0), **pad)

    def submit() -> None:
        token = entry.get().strip()
        if not token:
            error_label.config(text="Le code ne peut pas être vide.")
            return
        try:
            _write_token_to_env(env_path, token)
        except Exception as exc:  # pragma: no cover - filesystem edge
            error_label.config(text=f"Impossible d'enregistrer : {exc}")
            return
        result["token"] = token
        root.destroy()

    def cancel() -> None:
        root.destroy()

    button_row = tk.Frame(root, bg="#0A0B0E")
    button_row.pack(pady=18, **pad)
    tk.Button(button_row, text="Annuler", command=cancel, width=12,
              bg="#15171B", fg="#EDEEF0", relief="flat").pack(side="left", padx=6)
    tk.Button(button_row, text="Se connecter", command=submit, width=14,
              bg="#0D9488", fg="#F5FFFE", relief="flat").pack(side="left", padx=6)

    root.bind("<Return>", lambda _event: submit())
    root.bind("<Escape>", lambda _event: cancel())

    # Center on screen.
    root.update_idletasks()
    x = (root.winfo_screenwidth() - root.winfo_width()) // 2
    y = (root.winfo_screenheight() - root.winfo_height()) // 3
    root.geometry(f"+{x}+{y}")

    root.mainloop()
    return result["token"]


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    env = Path(__file__).resolve().parent / ".env"
    saved = prompt_for_token(env)
    print("Token enregistré." if saved else "Annulé.")
