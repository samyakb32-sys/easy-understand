-- Limits how many "the AI could not read / does not support this problem" attempts are given back per day.
-- Each of those attempts costs a paid model call, so refunding them without a limit would make junk input free.
-- Run once in the Supabase SQL editor (or with the Supabase CLI). Safe to run more than once.

alter table public.usage add column if not exists misses integer not null default 0;

-- Gives back one solve for today (India time) and counts it as a miss, but only while fewer than p_max misses
-- have been given back today. Returns true when the solve was given back.
create or replace function public.refund_miss(p_user uuid, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.usage set solves = greatest(solves - 1, 0), misses = misses + 1
  where user_id = p_user and day = (now() at time zone 'Asia/Kolkata')::date and misses < p_max;
  return found;
end;
$$;

revoke all on function public.refund_miss(uuid, integer) from public, anon, authenticated;
grant execute on function public.refund_miss(uuid, integer) to service_role;
