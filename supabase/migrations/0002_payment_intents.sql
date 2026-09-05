-- TSG — payment_intents (live fix: de derde per-process store)
--
-- NOT YET RUN FROM THIS SANDBOX. The egress policy blocks *.supabase.co
-- (re-confirmed for this change: CONNECT to bsrsalvuherllxottutx.supabase.co
-- answered 403), so this file has never been executed from here. It is
-- written to be run as-is against the live project and reviewed on that
-- basis, not on the basis of having passed.
--
-- Run with either:
--   supabase db push                          (Supabase CLI, linked project)
--   psql "$DATABASE_URL" -f 0002_payment_intents.sql
--
-- Idempotent throughout, so a partial run can be repeated safely.
--
-- ---------------------------------------------------------------------
-- payment_intents — the mock provider's intents across the payment gap
-- ---------------------------------------------------------------------
--
-- WHAT THIS FIXES, precisely. lib/payments/stripe-mock.ts kept its
-- PaymentIntents in a per-process globalThis Map. On Vercel,
-- /rapport/betalen/voorbereiden (which creates an intent) and
-- /rapport/betalen (which reads it back) build as separate Serverless
-- Functions - separate entries with their own file traces - so they never
-- share memory. The page's retrievePaymentIntent() therefore always
-- returned null and its `if (intent === null) redirect("/rapport/nieuw/pand")`
-- sent every customer who finished step 4 back to step 1. Deterministic,
-- and invisible locally because `next start` runs every route in one
-- process where globalThis genuinely is shared.
--
-- This is the same swap pending_inputs already made one migration ago,
-- for the same reason, and it is the last per-process store left.
--
-- data is the whole PaymentIntent as jsonb rather than a column per
-- field, deliberately: Stripe owns that object's shape, and this table is
-- a short-lived record between two requests. Columns would freeze today's
-- mock shape into a migration and force a schema change when the real
-- SDK's richer object arrives - at which point this table disappears
-- entirely, because Stripe keeps intent state on its own servers.
--
-- id is text, not uuid: it holds Stripe's own id format (`pi_...`), which
-- the mock already imitates so the eventual swap changes no call site.
--
-- No user_id column, and not an oversight: an intent is created before
-- the customer is necessarily an authenticated Supabase user, exactly as
-- pending_inputs is. The pending-input row is what ties an intent to the
-- input it belongs to, and the httpOnly cookie is what grants access to
-- that.

create table if not exists public.payment_intents (
  id text primary key,
  data jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- The retention sweep deletes by expires_at on every run; without this
-- index that is a sequential scan of the whole table each time.
create index if not exists payment_intents_expires_at_idx
  on public.payment_intents (expires_at);

-- RLS on, and deliberately NO policies - the same posture pending_inputs
-- takes. In Supabase that means anon and authenticated can reach nothing
-- here; only the service-role key (lib/supabase/server-client.ts,
-- server-side only) can. This table decides whether something was paid
-- for, so no browser may read or write it under any circumstances: a
-- client that could set status to 'succeeded' would mint free EUR 49
-- reports.
alter table public.payment_intents enable row level security;

-- ---------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------
--
-- Intents live 24 hours (PAYMENT_INTENT_TTL_MS), deliberately far longer
-- than the pending input's 30 minutes. The input holds an address and a
-- household's finances and should go quickly; the intent holds none of
-- that, and is read again by the release route AFTER the customer pays.
-- Expiring both on one clock would let a customer paying at minute 29
-- race their own intent out of existence and be refused a report they had
-- just paid for.
--
-- Same belt-and-braces as pending_inputs: the application sweeps
-- opportunistically, and this function exists so a schedule can do it
-- without the application being involved at all.

create or replace function public.delete_expired_payment_intents()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.payment_intents where expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- pg_cron is available on Supabase but not enabled by default; if this
-- extension cannot be created (a plan without it), drop these two
-- statements and call the function from an external scheduler instead.
create extension if not exists pg_cron with schema extensions;

-- Hourly rather than the pending sweep's every-15-minutes: these rows
-- live 24 hours, so a quarter-hourly delete would be almost entirely
-- empty passes.
select cron.schedule(
  'delete-expired-payment-intents',
  '0 * * * *',
  $$select public.delete_expired_payment_intents()$$
);
