# pc-agent

Monitors this PC and reports events to your organization's Monitorix
dashboard: file/folder changes in watched directories, USB drive/device
insert-remove, and application open/close.

## Setup — deploy to another PC

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

Stop with Ctrl+C — it flushes remaining queued events before exiting.

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
