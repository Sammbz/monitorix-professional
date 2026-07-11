# Monitorix

Multi-tenant (B2B) PC fleet monitoring platform. Each customer company is an
**organization**: its admins sign in to a dashboard and see, in real time,
what happens on the company's enrolled Windows PCs — file/folder changes,
USB device insert/remove, and application open/close.

## Components

| Component | Tech | Where |
|---|---|---|
| Admin dashboard (mobile + web) | Expo SDK 54 / React Native, expo-router | [`src/`](src/) |
| PC monitoring agent | Python 3.12 (watchdog, psutil) | [`pc-agent/`](pc-agent/) |
| Backend (auth, DB, realtime) | Supabase (Postgres + RLS + RPC) | [`supabase/schema.sql`](supabase/schema.sql) |

## How it fits together

1. An admin signs up in the dashboard and creates an organization
   (`create_organization` RPC — org + admin membership, atomically).
2. The dashboard shows the org's **enrollment token** (Enrollment token card).
3. IT deploys `pc-agent/` on each company PC with that one token in `.env` —
   no per-employee login. The agent enrolls the machine as a device and
   streams events through two `SECURITY DEFINER` RPCs (`enroll_device`,
   `submit_event`) that validate the token server-side on every call.
4. Events land in Postgres; the dashboard subscribes via Supabase Realtime
   and updates live. Row Level Security guarantees admins only ever see
   their own organization's devices and events.

The agent spools events to a local SQLite queue first
([`pc-agent/spool.py`](pc-agent/spool.py)), so nothing is lost if Supabase
is briefly unreachable.

## Run the dashboard

```bash
npm install
npx expo start --web        # web (desktop) — or scan the QR code in Expo Go
```

Environment: `.env` at the repo root provides `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## Run the desktop app (Electron)

The desktop app wraps the static web export in a native window:

```bash
npx expo export --platform web   # build the dashboard into dist/
cd desktop
npm install
npm start                        # opens the Monitorix window
npm run dist                     # (optional) build a Windows installer into desktop/release/
```

## Run the PC agent

See [`pc-agent/README.md`](pc-agent/README.md). Short version:

```bash
cd pc-agent
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env      # fill in ENROLLMENT_TOKEN from the dashboard
python main.py
```

## Database

Run the whole of [`supabase/schema.sql`](supabase/schema.sql) in the
Supabase SQL Editor — it's idempotent, so re-run it in full after any schema
change.

## Roadmap

- Large-screen (desktop web) dashboard layout
- Device online/offline status, token revocation from the UI
- Agent as a Windows service (auto-start)
- Desktop app packaging (Electron/Tauri)
