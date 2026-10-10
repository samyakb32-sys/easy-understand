import { PAID_PLANS } from "../pricing";
import type { Effect } from "./events";
import type { Store } from "./store";

export type ApplyResult = { applied: boolean; reason?: string };

/**
 * Applies one payment effect. Every step is idempotent: the webhook, its retries and the browser's verify call
 * can all deliver the same payment and the student still gets exactly what they paid for.
 */
export async function applyEffect(store: Store, effect: Effect, now: Date = new Date()): Promise<ApplyResult> {
  if (effect.type === "subscription_paid") {
    const userId = effect.userId ?? (await store.userForSubscription(effect.subscriptionId));
    if (!userId) return { applied: false, reason: "no user for subscription" };
    const planId = effect.planId ?? (await store.getCheckout(effect.subscriptionId))?.planId ?? "pro_monthly";
    if (effect.paymentId) {
      await store.recordPayment({ dedupeKey: `pay:${effect.paymentId}`, userId, planId, paymentId: effect.paymentId, subscriptionId: effect.subscriptionId, amount: effect.amount });
    }
    // A delayed or replayed charge must not revive a subscription that has since been halted, cancelled or
    // cancel-scheduled: it only counts as a renewal if it pays past the time we already hold.
    const cur = await store.getEntitlement(userId);
    const stale =
      cur?.subscription_id === effect.subscriptionId &&
      ["halted", "cancelled", "completed", "cancel_scheduled"].includes(cur.subscription_status ?? "") &&
      !!cur.pro_until && effect.until.getTime() <= new Date(cur.pro_until).getTime();
    await store.extendPro(userId, effect.until, { subscriptionId: effect.subscriptionId, ...(stale ? {} : { subscriptionStatus: "active" }), planId });
    return { applied: true };
  }

  if (effect.type === "subscription_status") {
    const userId = effect.userId ?? (await store.userForSubscription(effect.subscriptionId));
    if (!userId) return { applied: false, reason: "no user for subscription" };
    // access is never cut short here: pro_until already covers the period that was paid for
    const cur = await store.getEntitlement(userId);
    if (cur?.subscription_id !== effect.subscriptionId) return { applied: false, reason: "not the current subscription" };
    await store.setSubscriptionStatus(userId, effect.subscriptionId, effect.status);
    return { applied: true };
  }

  // one-time order
  const userId = effect.userId ?? (await store.getCheckout(effect.orderId))?.userId ?? null;
  if (!userId) return { applied: false, reason: "no user for order" };
  const plan = PAID_PLANS.exam;
  const planId = effect.planId ?? (await store.getCheckout(effect.orderId))?.planId ?? null;
  if (planId !== plan.id) return { applied: false, reason: "not an exam pack order" };
  if (effect.amount !== plan.amountPaise) return { applied: false, reason: `amount ${effect.amount} does not match the price` };
  // payment row and pro_until move in one atomic step, so a failed attempt leaves nothing behind and the retry still grants
  const fresh = await store.grantOrder({ dedupeKey: `order:${effect.orderId}`, userId, planId, orderId: effect.orderId, paymentId: effect.paymentId, amount: effect.amount }, plan.accessDays ?? 90, now);
  return fresh ? { applied: true } : { applied: true, reason: "already applied" };
}
