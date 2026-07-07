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

- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — same values as the mobile app
  (Supabase Project Settings > API > anon public). This is not a secret
  admin key.

Everything else has a sensible default — see the comments in `.env.example`.

## Run

```bash
python main.py
```

On first run it asks for the email/password of the account whose devices
this agent should report under (the same account used in the mobile app).
It then stores a renewable session token in `.session.json` (gitignored) so
you're never prompted again on this machine — the password itself is never
written to disk. If that stored session is later revoked, it just asks
again.

Stop with Ctrl+C — it flushes remaining queued events before exiting.

## How it works

- `auth.py` signs in against Supabase Auth (email/password once, then
  refresh tokens) and hands `main.py` a session to keep alive.
- `supabase_client.py` talks to Supabase's REST API as that signed-in user —
  Row Level Security scopes every read/write to their own devices/events,
  exactly like the mobile app. No service_role key is used anywhere in this
  agent, so there's no highly-privileged secret sitting on the machine it
  runs on.
- `watchers.py` runs three background watchers (file system via `watchdog`,
  USB via polling `Win32_PnPEntity`/removable drive letters, running
  processes via `psutil`) that all feed into one callback.
- Events are written to a local SQLite-backed queue (`spool.py`) first, so
  nothing is lost if Supabase is briefly unreachable, then drained to
  Supabase by a background sender thread.
