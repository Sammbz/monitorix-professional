# pc-agent

Monitors this PC and reports events to the Monitorix Supabase project:
file/folder changes in watched directories, USB drive/device insert-remove,
and application open/close.

## Setup

```bash
cd pc-agent
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Fill in `.env`:

- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — from Supabase Project
  Settings > API. The service_role key bypasses Row Level Security, which is
  what lets this agent write events without signing in as a user. Keep it out
  of the mobile app and out of git.
- `DEVICE_USER_ID` — the Supabase auth user id that should own devices this
  agent creates. Find it in Supabase Authentication > Users (the account you
  sign into the mobile app with).

Everything else has a sensible default — see the comments in `.env.example`.

## Run

```bash
python main.py
```

Stop with Ctrl+C — it flushes remaining queued events before exiting.

## How it works

- `watchers.py` runs three background watchers (file system via `watchdog`,
  USB via polling `Win32_PnPEntity`/removable drive letters, running
  processes via `psutil`) that all feed into one callback.
- Events are written to a local SQLite-backed queue (`spool.py`) first, so
  nothing is lost if Supabase is briefly unreachable, then drained to
  Supabase by a background sender thread.
- `supabase_client.py` creates the device row (or reuses an existing one for
  this `DEVICE_USER_ID` + `DEVICE_NAME`) and inserts events via Supabase's
  REST API.
