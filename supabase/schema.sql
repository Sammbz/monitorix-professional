-- Monitorix base schema (MVP)
-- Run this in the Supabase SQL Editor for your project.
--
-- Ownership model: each device belongs to exactly one auth user. The
-- mobile app AND the pc-agent both connect as a signed-in user (anon key +
-- session), so Row Level Security scopes everything to whoever is signed
-- in on each side — no admin-only service_role key involved anywhere.

create extension if not exists pgcrypto;

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_device_id on public.events(device_id);
create index if not exists idx_events_created_at on public.events(created_at desc);
create index if not exists idx_devices_user_id on public.devices(user_id);
create index if not exists idx_devices_created_at on public.devices(created_at desc);

-- Row Level Security: every user only ever sees their own devices/events.
alter table public.devices enable row level security;
alter table public.events enable row level security;

-- create policy has no "if not exists" — drop first so this script can be
-- re-run safely (e.g. after schema changes) without erroring.
drop policy if exists "select own devices" on public.devices;
create policy "select own devices" on public.devices
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "insert own devices" on public.devices;
create policy "insert own devices" on public.devices
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "update own devices" on public.devices;
create policy "update own devices" on public.devices
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "delete own devices" on public.devices;
create policy "delete own devices" on public.devices
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "select own events" on public.events;
create policy "select own events" on public.events
  for select to authenticated
  using (
    exists (
      select 1 from public.devices
      where devices.id = events.device_id
        and devices.user_id = auth.uid()
    )
  );

drop policy if exists "insert own events" on public.events;
create policy "insert own events" on public.events
  for insert to authenticated
  with check (
    exists (
      select 1 from public.devices
      where devices.id = events.device_id
        and devices.user_id = auth.uid()
    )
  );

-- No update/delete policy for events on purpose: once written, events are
-- an append-only log — nobody, including the owning user, can edit them
-- through the API.

-- Enable Realtime so the dashboard can subscribe to live inserts.
-- alter publication ... add table has no "if not exists" either.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'devices'
  ) then
    execute 'alter publication supabase_realtime add table public.devices';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events'
  ) then
    execute 'alter publication supabase_realtime add table public.events';
  end if;
end $$;
