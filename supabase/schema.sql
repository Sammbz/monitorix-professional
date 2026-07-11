-- Monitorix schema (multi-tenant / B2B)
-- Run this in the Supabase SQL Editor for your project.
--
-- Ownership model: devices/events belong to an ORGANIZATION, not directly
-- to a personal user account. Members of an organization with role='admin'
-- can see everything in their org (devices, events, enrollment tokens).
--
-- The PC agent never signs in as a user: it enrolls a device and submits
-- events using an organization-scoped enrollment token, via two
-- SECURITY DEFINER functions (enroll_device / submit_event) that validate
-- the token server-side. This is what lets IT deploy the agent across many
-- machines without a per-employee login.
--
-- "Employee" is a valid membership role but has no read access in this
-- pass — only admins can view org data through the app. Employee-facing
-- self-view (if ever wanted) is a separate, later phase.

create extension if not exists pgcrypto;

-- Organizations ---------------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'employee')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.enrollment_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_by uuid references auth.users(id) on delete set null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

-- Single-use codes for inviting another signed-up user into an org (the
-- safe replacement for letting users insert their own memberships).
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null unique default encode(gen_random_bytes(12), 'hex'),
  role text not null default 'admin' check (role in ('admin', 'employee')),
  created_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_invitations_org_id on public.invitations(organization_id);

-- Devices & events --------------------------------------------------------------

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  -- Bumped by submit_event/agent_heartbeat; the dashboard derives the
  -- online/offline pill from how recent this is.
  last_seen_at timestamptz,
  unique (organization_id, name)
);

-- Idempotent migration for databases created before last_seen_at existed.
alter table public.devices add column if not exists last_seen_at timestamptz;

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
create index if not exists idx_devices_organization_id on public.devices(organization_id);
create index if not exists idx_devices_created_at on public.devices(created_at desc);
create index if not exists idx_memberships_user_id on public.memberships(user_id);
create index if not exists idx_memberships_org_id on public.memberships(organization_id);
create index if not exists idx_enrollment_tokens_org_id on public.enrollment_tokens(organization_id);

-- Row Level Security --------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.enrollment_tokens enable row level security;
alter table public.devices enable row level security;
alter table public.events enable row level security;

-- Helper: is the signed-in user an admin member of this organization?
create or replace function public.is_org_admin(p_organization_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = p_organization_id
      and user_id = auth.uid()
      and role = 'admin'
  );
$$;

-- organizations: see the orgs you belong to
drop policy if exists "select own organizations" on public.organizations;
create policy "select own organizations" on public.organizations
  for select to authenticated
  using (
    exists (
      select 1 from public.memberships
      where memberships.organization_id = organizations.id
        and memberships.user_id = auth.uid()
    )
  );

-- No insert policy on purpose — organizations are only ever created via
-- create_organization() below, which also adds the creator as admin in the
-- same transaction. (A direct INSERT ... RETURNING from the client would
-- fail anyway: the SELECT policy above requires a membership that doesn't
-- exist yet at that point.)
drop policy if exists "insert organization" on public.organizations;

-- memberships: see your own membership rows, and (as an admin) your org's
-- other members
drop policy if exists "select own memberships" on public.memberships;
create policy "select own memberships" on public.memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_org_admin(organization_id)
  );

-- No insert policy on purpose — memberships are only ever created via
-- create_organization() below. Inviting other users safely needs a separate
-- invite-token flow — out of scope for this minimal pass.
drop policy if exists "insert own membership" on public.memberships;

-- enrollment_tokens: only org admins can see/create/revoke tokens
drop policy if exists "select own org tokens" on public.enrollment_tokens;
create policy "select own org tokens" on public.enrollment_tokens
  for select to authenticated
  using (public.is_org_admin(organization_id));

drop policy if exists "insert own org tokens" on public.enrollment_tokens;
create policy "insert own org tokens" on public.enrollment_tokens
  for insert to authenticated
  with check (public.is_org_admin(organization_id));

drop policy if exists "update own org tokens" on public.enrollment_tokens;
create policy "update own org tokens" on public.enrollment_tokens
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- invitations: only org admins can see/create/revoke them. Direct inserts
-- are fine here (unlike organizations): the SELECT policy already passes
-- for the admin creating the row, so INSERT ... RETURNING works.
alter table public.invitations enable row level security;

drop policy if exists "select own org invitations" on public.invitations;
create policy "select own org invitations" on public.invitations
  for select to authenticated
  using (public.is_org_admin(organization_id));

drop policy if exists "insert own org invitations" on public.invitations;
create policy "insert own org invitations" on public.invitations
  for insert to authenticated
  with check (public.is_org_admin(organization_id) and created_by = auth.uid());

drop policy if exists "update own org invitations" on public.invitations;
create policy "update own org invitations" on public.invitations
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- devices: admins see/manage devices in their organization. No insert policy
-- on purpose — devices are only ever created via enroll_device() below.
drop policy if exists "select org devices" on public.devices;
create policy "select org devices" on public.devices
  for select to authenticated
  using (public.is_org_admin(organization_id));

drop policy if exists "delete org devices" on public.devices;
create policy "delete org devices" on public.devices
  for delete to authenticated
  using (public.is_org_admin(organization_id));

-- events: admins see events for devices in their organization. No
-- insert/update/delete policy — events are only ever written via
-- submit_event() below, and are an append-only log even for admins.
drop policy if exists "select org events" on public.events;
create policy "select org events" on public.events
  for select to authenticated
  using (
    exists (
      select 1 from public.devices
      where devices.id = events.device_id
        and public.is_org_admin(devices.organization_id)
    )
  );

-- Onboarding RPC ---------------------------------------------------------------

-- Creates an organization and makes the caller its admin, atomically. This is
-- the only way organizations/memberships get created from the app.
create or replace function public.create_organization(p_name text)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if coalesce(trim(p_name), '') = '' or length(trim(p_name)) > 120 then
    raise exception 'Organization name must be 1-120 characters';
  end if;

  insert into public.organizations (name)
  values (trim(p_name))
  returning * into v_org;

  insert into public.memberships (organization_id, user_id, role)
  values (v_org.id, auth.uid(), 'admin');

  return v_org;
end;
$$;

grant execute on function public.create_organization(text) to authenticated;

-- Joins the caller to an organization using a single-use invitation code.
-- SECURITY DEFINER because the caller has no membership yet, so RLS would
-- hide both the invitation and the org from them.
create or replace function public.accept_invitation(p_code text)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.invitations;
  v_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into v_invitation
  from public.invitations
  where code = p_code
    and not revoked
    and accepted_by is null
    and expires_at > now()
  for update;

  if v_invitation.id is null then
    raise exception 'Invalid, expired, or already used invitation code';
  end if;

  if exists (
    select 1 from public.memberships
    where organization_id = v_invitation.organization_id and user_id = auth.uid()
  ) then
    raise exception 'You are already a member of this organization';
  end if;

  insert into public.memberships (organization_id, user_id, role)
  values (v_invitation.organization_id, auth.uid(), v_invitation.role);

  update public.invitations
  set accepted_by = auth.uid(), accepted_at = now()
  where id = v_invitation.id;

  select * into v_org from public.organizations where id = v_invitation.organization_id;
  return v_org;
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;

-- Hourly event counts for the dashboard activity chart. SECURITY INVOKER
-- (the default): RLS on events applies, so callers only ever aggregate
-- their own organization's events.
create or replace function public.events_activity(p_hours int default 24)
returns table (bucket timestamptz, event_count bigint)
language sql
stable
as $$
  select date_trunc('hour', created_at) as bucket, count(*) as event_count
  from public.events
  where created_at > now() - make_interval(hours => p_hours)
  group by 1
  order by 1;
$$;

grant execute on function public.events_activity(int) to authenticated;

-- Rate limiting -----------------------------------------------------------------
--
-- Fixed-window counters, entirely in Postgres so no extra infrastructure is
-- needed. Three protections on the public (anon-callable) RPCs:
--   1. an IP that keeps presenting invalid tokens gets blocked (brute force);
--   2. enrollments are capped per organization;
--   3. events/heartbeats are capped per device.
-- Keys never contain the raw token (only org/device ids and IPs).

create table if not exists public.rpc_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  call_count int not null default 0
);

-- Locked down: only the SECURITY DEFINER functions below ever touch it.
alter table public.rpc_rate_limits enable row level security;

-- Increment the counter for a key, resetting it when its window expired.
-- Returns the count within the current window. Internal helper — no grants.
create or replace function public.bump_rate_counter(p_key text, p_window_seconds int)
returns int
language plpgsql
as $$
declare
  v_count int;
begin
  insert into public.rpc_rate_limits as r (key, window_start, call_count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    call_count = case
      when r.window_start > now() - make_interval(secs => p_window_seconds)
      then r.call_count + 1 else 1 end,
    window_start = case
      when r.window_start > now() - make_interval(secs => p_window_seconds)
      then r.window_start else now() end
  returning call_count into v_count;

  -- Opportunistic cleanup so stale keys (old IPs) don't accumulate forever.
  if random() < 0.001 then
    delete from public.rpc_rate_limits where window_start < now() - interval '2 days';
  end if;

  return v_count;
end;
$$;

-- Bump + enforce: raises once the cap for the window is exceeded.
create or replace function public.check_rate_limit(p_key text, p_max_calls int, p_window_seconds int)
returns void
language plpgsql
as $$
begin
  if public.bump_rate_counter(p_key, p_window_seconds) > p_max_calls then
    raise exception 'Rate limit exceeded, try again later';
  end if;
end;
$$;

-- Read-only check used BEFORE token validation: blocks callers that already
-- accumulated too many auth failures, without counting legitimate calls.
create or replace function public.assert_not_blocked(p_key text, p_max_failures int, p_window_seconds int)
returns void
language plpgsql
stable
as $$
declare
  v_count int;
begin
  select call_count into v_count
  from public.rpc_rate_limits
  where key = p_key
    and window_start > now() - make_interval(secs => p_window_seconds);

  if coalesce(v_count, 0) >= p_max_failures then
    raise exception 'Too many failed attempts, try again later';
  end if;
end;
$$;

-- Best-effort client IP as seen by the API gateway. Falls back to a shared
-- bucket when the header is absent (then abusers and their own retries share
-- the same block).
create or replace function public.client_ip()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(trim(split_part(
      (current_setting('request.headers', true))::json ->> 'x-forwarded-for', ',', 1)), ''),
    'unknown'
  );
$$;

-- RPC functions for the PC agent (token-based, no personal login) ---------------

create or replace function public.enroll_device(p_token text, p_device_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_device_id uuid;
begin
  -- Input bounds: a leaked token must not let anyone stuff the devices
  -- table with garbage names.
  if coalesce(trim(p_device_name), '') = '' or length(p_device_name) > 120 then
    raise exception 'Device name must be 1-120 characters';
  end if;

  -- Brute force: an IP with 20+ invalid-token attempts in 15 min is blocked.
  perform public.assert_not_blocked('authfail:ip:' || public.client_ip(), 20, 900);

  select organization_id into v_org_id
  from public.enrollment_tokens
  where token = p_token and not revoked;

  if v_org_id is null then
    perform public.bump_rate_counter('authfail:ip:' || public.client_ip(), 900);
    raise exception 'Invalid or revoked enrollment token';
  end if;

  -- Cap enrollments per organization (120/hour is far above any legitimate
  -- mass deployment, but stops a leaked token creating devices in a loop).
  perform public.check_rate_limit('enroll:org:' || v_org_id::text, 120, 3600);

  select id into v_device_id
  from public.devices
  where organization_id = v_org_id and name = p_device_name;

  if v_device_id is null then
    insert into public.devices (organization_id, name)
    values (v_org_id, p_device_name)
    returning id into v_device_id;
  end if;

  return v_device_id;
end;
$$;

grant execute on function public.enroll_device(text, text) to anon, authenticated;

create or replace function public.submit_event(
  p_token text,
  p_device_id uuid,
  p_event_type text,
  p_message text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_device_org_id uuid;
  v_event_id uuid;
begin
  -- Input bounds: cap what a (possibly leaked) token can write, so the
  -- events table can't be flooded with oversized payloads.
  if coalesce(trim(p_event_type), '') = '' or length(p_event_type) > 64 then
    raise exception 'Event type must be 1-64 characters';
  end if;
  if p_message is null or length(p_message) > 4000 then
    raise exception 'Message must be at most 4000 characters';
  end if;
  if pg_column_size(coalesce(p_metadata, '{}'::jsonb)) > 16384 then
    raise exception 'Metadata must be at most 16 KB';
  end if;

  perform public.assert_not_blocked('authfail:ip:' || public.client_ip(), 20, 900);

  select organization_id into v_org_id
  from public.enrollment_tokens
  where token = p_token and not revoked;

  if v_org_id is null then
    perform public.bump_rate_counter('authfail:ip:' || public.client_ip(), 900);
    raise exception 'Invalid or revoked enrollment token';
  end if;

  select organization_id into v_device_org_id
  from public.devices
  where id = p_device_id;

  if v_device_org_id is null or v_device_org_id != v_org_id then
    raise exception 'Device does not belong to this token''s organization';
  end if;

  -- Cap events per device: 600 per 10 minutes (~1/second sustained) absorbs
  -- real activity bursts while bounding what a hijacked device can write.
  perform public.check_rate_limit('events:device:' || p_device_id::text, 600, 600);

  insert into public.events (device_id, event_type, message, metadata)
  values (p_device_id, p_event_type, p_message, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_event_id;

  update public.devices set last_seen_at = now() where id = p_device_id;

  return v_event_id;
end;
$$;

grant execute on function public.submit_event(text, uuid, text, text, jsonb) to anon, authenticated;

-- Lightweight liveness ping: bumps last_seen_at without writing an event, so
-- an idle-but-running agent still shows as online in the dashboard.
create or replace function public.agent_heartbeat(p_token text, p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_device_org_id uuid;
begin
  perform public.assert_not_blocked('authfail:ip:' || public.client_ip(), 20, 900);

  select organization_id into v_org_id
  from public.enrollment_tokens
  where token = p_token and not revoked;

  if v_org_id is null then
    perform public.bump_rate_counter('authfail:ip:' || public.client_ip(), 900);
    raise exception 'Invalid or revoked enrollment token';
  end if;

  select organization_id into v_device_org_id
  from public.devices
  where id = p_device_id;

  if v_device_org_id is null or v_device_org_id != v_org_id then
    raise exception 'Device does not belong to this token''s organization';
  end if;

  -- The agent pings every ~30s; 10/min leaves room without letting a rogue
  -- client spam device updates.
  perform public.check_rate_limit('hb:device:' || p_device_id::text, 10, 60);

  update public.devices set last_seen_at = now() where id = p_device_id;
end;
$$;

grant execute on function public.agent_heartbeat(text, uuid) to anon, authenticated;

-- Enable Realtime so the dashboard can subscribe to live inserts.
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
