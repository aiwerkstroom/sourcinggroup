-- TSG — initial schema (fase 4 stap 3)
--
-- NOT YET RUN ANYWHERE. This sandbox has no reachable Supabase project
-- (its egress policy blocks *.supabase.co), so this file has never been
-- executed against a live database. It is written to be run as-is against
-- a fresh project, and reviewed on that basis, not on the basis of having
-- passed.
--
-- Run with either:
--   supabase db push                       (Supabase CLI, linked project)
--   psql "$DATABASE_URL" -f 0001_initial.sql
--
-- Idempotent throughout (if not exists / drop policy if exists), so a
-- partial run can be repeated safely.

-- ---------------------------------------------------------------------
-- users — the account row behind an authenticated customer
-- ---------------------------------------------------------------------
--
-- The shape lib/auth/supabase-mock.ts already exposes as AuthUser
-- ({ id, email }), now as a real table. It does NOT replace auth.users;
-- it hangs off it. Supabase owns identity, password hashing and email
-- confirmation in auth.users, and this table is the application's own row
-- for the same person - the place later phases hang a stored report,
-- a saved search or an alert off, none of which belong in an auth schema
-- we do not own.
--
-- id is both primary key and foreign key: one application row per
-- identity, deleted with it. That is what makes an account deletion
-- request (a GDPR erasure) a single delete on auth.users rather than a
-- hunt across tables.

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- A customer may read and update only their own row. No insert policy:
-- the row is created by the trigger below, not by the browser, so a
-- client cannot mint a row for an id that is not theirs.
drop policy if exists "users read own row" on public.users;
create policy "users read own row"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "users update own row" on public.users;
create policy "users update own row"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Keeps public.users in step with auth.users automatically, so a signup
-- through the Supabase SDK needs no second call from the application -
-- and cannot half-succeed by creating an identity with no application
-- row. security definer is required: the trigger runs in the auth
-- schema's context, where the caller has no rights on public.users.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------
-- pending_inputs — the wizard's input across the payment gap
-- ---------------------------------------------------------------------
--
-- Replaces the in-memory Map in app/rapport/betalen/_lib/pending-input.ts.
-- That Map is per-process, and Vercel gives separate invocations separate
-- processes - so an entry written while preparing a payment was not
-- reliably there when the customer came back from their bank. A row is.
--
-- data is the whole WizardData blob as jsonb rather than a column per
-- field, deliberately: this table is a short-lived parking space between
-- two requests, not the report's own storage. Giving it columns would
-- freeze the wizard's current shape into a migration and mean a schema
-- change every time a field is added.
--
-- No user_id column, and that is not an oversight: the row is written
-- before payment, on a flow that does not require the customer to be a
-- Supabase-authenticated user at that moment. The opaque token in an
-- httpOnly cookie is the only thing that grants access to it.

create table if not exists public.pending_inputs (
  token uuid primary key default gen_random_uuid(),
  data jsonb not null,
  payment_intent_id text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- The retention sweep deletes by expires_at on every run; without this
-- index that is a sequential scan of the whole table each time.
create index if not exists pending_inputs_expires_at_idx
  on public.pending_inputs (expires_at);

-- RLS on, and deliberately NO policies. In Supabase that means the anon
-- and authenticated roles can reach nothing here at all; only the
-- service-role key (lib/supabase/server-client.ts, server-side only) can.
-- This table holds a full address and a complete financial picture, so
-- "no browser can read this under any circumstances" is the intended
-- posture - not a policy that merely narrows which browser can.
alter table public.pending_inputs enable row level security;

-- ---------------------------------------------------------------------
-- Retention (COMPLIANCE_CHECKLIST.md §2.2)
-- ---------------------------------------------------------------------
--
-- The application sweeps opportunistically on read (pending-input-supabase.ts),
-- which is enough while there is traffic but guarantees nothing while
-- there is none: a table that stops being read stops being cleaned, and
-- the rows that outlive their purpose are exactly the ones nobody is
-- looking at. So the deletion also exists here, as a function a schedule
-- can call without the application being involved at all.
--
-- SCOPE NOTE, stated plainly rather than glossed: this enforces the
-- 30-minute pending-input TTL. It does NOT yet enforce the "1 week
-- toegang" rule, because the thing that rule governs - a stored, paid
-- report - has no table yet. What this establishes is the mechanism that
-- rule will use: an expires_at column plus a scheduled delete. When the
-- reports table lands, it gets the same two lines and this same schedule,
-- and the promise becomes enforced rather than merely made.

create or replace function public.delete_expired_pending_inputs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.pending_inputs where expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Schedule it. pg_cron is available on Supabase but not enabled by
-- default; if this extension cannot be created (a plan without it), drop
-- these two statements and call the function from an external scheduler
-- instead - a Vercel Cron hitting a route that runs
-- sweepExpiredPendingInputs() does the same job.
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'delete-expired-pending-inputs',
  '*/15 * * * *',
  $$select public.delete_expired_pending_inputs()$$
);
