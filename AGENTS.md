# Expo version

This project is pinned to **Expo SDK 54** (deliberate downgrade for Expo Go
compatibility — see commit ae18d07). Read the exact versioned docs at
https://docs.expo.dev/versions/v54.0.0/ before writing any code, and match
dependency versions to what `npx expo install` resolves for SDK 54.

# Project layout

- `src/` — Expo (React Native) admin dashboard: mobile + web from the same
  code. Web is the primary "desktop" target for now.
- `pc-agent/` — Python agent deployed on monitored Windows PCs.
- `supabase/schema.sql` — full database schema, RLS policies, and RPC
  functions. Idempotent: re-run the whole file in the Supabase SQL Editor
  after any change.

# Architecture rules

- The PC agent never signs in as a user. It authenticates every call with an
  organization-scoped enrollment token, validated server-side by
  `SECURITY DEFINER` RPCs (`enroll_device`, `submit_event`). Keep it that way.
- Organizations/memberships are only created through the
  `create_organization` RPC — direct client inserts are blocked by RLS
  (INSERT ... RETURNING can't pass the SELECT policy before the membership
  exists).
- Only org admins can read org data through the app; the `employee` role has
  no read access in this phase.
