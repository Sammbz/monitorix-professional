# pc-agent

Monitors this PC and reports events to your organization's Monitorix
dashboard: file/folder changes in watched directories, USB drive/device
insert-remove, and application open/close.

## Deploy the easy way — a standalone .exe (no Python needed)

Build a single self-contained executable once (on a machine that has the
Python venv set up):

```powershell
powershell -ExecutionPolicy Bypass -File build-exe.ps1
```

This produces `dist\MonitorixAgent.exe`. Copy that one file to any Windows
PC — **no Python, no pip, no commands needed on the target**:

1. Double-click `MonitorixAgent.exe`.
2. Paste the enrollment code (from the dashboard) in the connect window.
3. In the tray menu, tick **Démarrer avec Windows** so it starts at every logon.

The exe keeps its files (`.env`, `spool.db`, `agent.log`) next to itself.

## Setup — run from source (for development)

Copy the `pc-agent/` folder (or clone the repo) onto the new machine, then:

```bash
cd pc-agent
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Fill in `.env`:

- `ENROLLMENT_TOKEN` — get this from the admin dashboard (Organization >
  Enrollment tokens). One token can be reused across every machine in the
  organization; there's no per-employee login.

Then:

```bash
python main.py
```

Each machine shows up as its own device in the dashboard, named after its
hostname. If you want a clearer name (or two PCs happen to share a
hostname), set `DEVICE_NAME` in `.env`.

On first launch without an `ENROLLMENT_TOKEN`, a small **connect window**
opens so you can paste the code from the dashboard — it's saved to `.env`
for next time. The same window is reachable later from the tray icon
(**Configurer le code…**).

Stop with Ctrl+C — it flushes remaining queued events before exiting.

## Tray icon

By default the agent shows a system-tray icon (set `SHOW_TRAY_ICON=false`
for a fully invisible agent). Right-click it to:

- **Mettre en pause / Reprendre** — pause event capture without disconnecting
- **Ouvrir les logs** — open the log file
- **Configurer le code…** — re-enter the enrollment code
- **Quitter** — stop the agent cleanly

## Start automatically at logon (recommended for deployment)

From the `pc-agent` folder, after the setup above:

```powershell
powershell -ExecutionPolicy Bypass -File install-autostart.ps1
```

This registers a per-user Scheduled Task (no admin rights needed) that runs
the agent invisibly via `pythonw.exe` at every logon, restarts it if it
crashes, and starts it immediately. Logs go to `agent.log` in this folder
(rotating, 5 MB × 2). Remove with:

```powershell
powershell -ExecutionPolicy Bypass -File uninstall-autostart.ps1
```

## How it works

- `supabase_client.py` calls two `SECURITY DEFINER` RPC functions —
  `enroll_device` and `submit_event` (see `supabase/schema.sql`) — passing
  the enrollment token on every call. The token is validated server-side
  each time; there is no user session, no password, no service_role key
  anywhere in this agent. A leaked token only grants write access to that
  one organization's devices/events, nothing else in the database.
- `watchers.py` runs three background watchers (file system via `watchdog`,
  USB via polling `Win32_PnPEntity`/removable drive letters, running
  processes via `psutil`) that all feed into one callback.
- Events are written to a local SQLite-backed queue (`spool.py`) first, so
  nothing is lost if Supabase is briefly unreachable, then drained to
  Supabase by a background sender thread.
