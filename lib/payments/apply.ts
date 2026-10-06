import { PAID_PLANS } from "../pricing";
import type { Effect } from "./events";
import type { Store } from "./store";

const DAY = 24 * 60 * 60 * 1000;

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
    await store.extendPro(userId, effect.until, { subscriptionId: effect.subscriptionId, subscriptionStatus: "active", planId });
    return { applied: true };
  }

  if (effect.type === "subscription_status") {
    const userId = effect.userId ?? (await store.userForSubscription(effect.subscriptionId));
    if (!userId) return { applied: false, reason: "no user for subscription" };
    // access is never cut short here: pro_until already covers the period that was paid for
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
  const fresh = await store.recordPayment({ dedupeKey: `order:${effect.orderId}`, userId, planId, orderId: effect.orderId, paymentId: effect.paymentId, amount: effect.amount });
  if (!fresh) return { applied: true, reason: "already applied" };
  const current = await store.getEntitlement(userId);
  const base = Math.max(now.getTime(), current?.pro_until ? new Date(current.pro_until).getTime() : 0);
  await store.extendPro(userId, new Date(base + (plan.accessDays ?? 90) * DAY), { planId });
  return { applied: true };
}
