-- Records an Exam-pack payment and extends pro_until in ONE transaction, so a failure between the two can never leave
-- a paid order without access (the retry would otherwise see the payment row and skip the grant).
-- Safe to run more than once. Returns false, changing nothing, when the dedupe key was already recorded.
create or replace function public.apply_order_payment(
  p_user uuid, p_dedupe text, p_plan text, p_payment text, p_order text, p_amount integer, p_days integer, p_now timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.payments (user_id, dedupe_key, plan_id, razorpay_payment_id, razorpay_order_id, amount)
  values (p_user, p_dedupe, p_plan, p_payment, p_order, p_amount)
  on conflict (dedupe_key) do nothing;
  if not found then
    return false;
  end if;

  insert into public.entitlements (user_id, pro_until, plan_id, updated_at)
  values (p_user, p_now + make_interval(days => p_days), p_plan, now())
  on conflict (user_id) do update
    set pro_until = greatest(p_now, coalesce(public.entitlements.pro_until, p_now)) + make_interval(days => p_days),
        plan_id = excluded.plan_id,
        updated_at = now();
  return true;
end;
$$;

revoke all on function public.apply_order_payment(uuid, text, text, text, text, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_order_payment(uuid, text, text, text, text, integer, integer, timestamptz) to service_role;
