-- EasyUnderstand: accounts, entitlements, payments, daily usage and saved lessons.
-- Run this once in the Supabase SQL editor (or with the Supabase CLI).
--
-- Security model: the browser (anon key) can only READ its own rows. Every write goes through the
-- server with the service-role key, which bypasses RLS. Never expose the service-role key.

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Pro access lasts until this moment. Subscriptions and the Exam pack both just push it forward.
  pro_until timestamptz,
  subscription_id text,
  subscription_status text,          -- created | active | cancel_scheduled | cancelled | halted | completed ...
  plan_id text,                      -- pro_monthly | pro_yearly | exam
  updated_at timestamptz not null default now()
);

-- A checkout we created, so a payment can only be claimed by the user it was created for.
create table if not exists public.checkouts (
  razorpay_id text primary key,      -- order_... or sub_...
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null,
  kind text not null check (kind in ('subscription', 'order')),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  dedupe_key text not null unique,   -- makes webhook retries and the verify call idempotent
  plan_id text,
  razorpay_payment_id text,
  razorpay_order_id text,
  razorpay_subscription_id text,
  amount integer,                    -- paise
  currency text default 'INR',
  created_at timestamptz not null default now()
);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);

create table if not exists public.webhook_events (
  id text primary key,               -- x-razorpay-event-id
  received_at timestamptz not null default now()
);

create table if not exists public.usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  solves integer not null default 0,
  primary key (user_id, day)
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  solution jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists lessons_user_idx on public.lessons (user_id, created_at desc);

alter table public.entitlements enable row level security;
alter table public.checkouts enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.usage enable row level security;
alter table public.lessons enable row level security;

-- read-only access to your own rows (no insert/update policies: only the server writes)
create policy "own entitlement" on public.entitlements for select using (auth.uid() = user_id);
create policy "own payments" on public.payments for select using (auth.uid() = user_id);
create policy "own usage" on public.usage for select using (auth.uid() = user_id);
create policy "own lessons" on public.lessons for select using (auth.uid() = user_id);
create policy "delete own lessons" on public.lessons for delete using (auth.uid() = user_id);
-- checkouts and webhook_events have no policies on purpose: server only.

-- Atomically spends one solve for today (India time). Returns false when the limit is reached.
create or replace function public.consume_solve(p_user uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := (now() at time zone 'Asia/Kolkata')::date;
  n integer;
begin
  insert into public.usage (user_id, day, solves) values (p_user, d, 1)
  on conflict (user_id, day) do update set solves = public.usage.solves + 1
    where public.usage.solves < p_limit
  returning solves into n;
  return n is not null;
end;
$$;

-- Gives a solve back, for example when the AI could not read the problem.
create or replace function public.refund_solve(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.usage set solves = greatest(solves - 1, 0)
  where user_id = p_user and day = (now() at time zone 'Asia/Kolkata')::date;
$$;

-- Only the server (service role) may call these.
revoke all on function public.consume_solve(uuid, integer) from public, anon, authenticated;
revoke all on function public.refund_solve(uuid) from public, anon, authenticated;
grant execute on function public.consume_solve(uuid, integer) to service_role;
grant execute on function public.refund_solve(uuid) to service_role;
