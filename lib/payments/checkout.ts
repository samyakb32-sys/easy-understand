import { PAID_PLANS, isPlanId, type PlanId } from "../pricing";
import { applyEffect } from "./apply";
import { verifyOrderSignature, verifySubscriptionSignature } from "./signature";
import type { Store } from "./store";

/** The few Razorpay calls we need, so the logic can be tested without the network. */
export interface RazorpayLike {
  createSubscription(p: { planId: string; totalCount: number; notes: Record<string, string> }): Promise<{ id: string }>;
  createOrder(p: { amount: number; receipt: string; notes: Record<string, string> }): Promise<{ id: string }>;
  fetchPlanAmount(planId: string): Promise<number>;
  fetchSubscription(id: string): Promise<{ id: string; status: string; current_end?: number | null }>;
  fetchPayment(id: string): Promise<{ id: string; status: string; amount: number }>;
  cancelSubscription(id: string, atCycleEnd: boolean): Promise<void>;
}

export type Fail = { ok: false; status: number; reason: string };
export type CheckoutStart = { ok: true; kind: "subscription" | "order"; id: string; amountPaise: number; label: string };

export async function createCheckout(args: {
  userId: string;
  planId: unknown;
  rzp: RazorpayLike;
  store: Store;
  planIds: Record<string, string | undefined>; // env values by env name
  now?: Date;
}): Promise<CheckoutStart | Fail> {
  const { userId, planId, rzp, store, planIds } = args;
  if (!isPlanId(planId)) return { ok: false, status: 400, reason: "Unknown plan." };
  const plan = PAID_PLANS[planId];

  if (plan.kind === "subscription") {
    const ent = await store.getEntitlement(userId);
    const live = ent?.subscription_id && ["active", "authenticated"].includes(ent.subscription_status ?? "") && ent.pro_until && new Date(ent.pro_until) > (args.now ?? new Date());
    if (live) return { ok: false, status: 409, reason: "You already have an active subscription. Manage it from your account." };

    const razorpayPlan = plan.razorpayPlanEnv ? planIds[plan.razorpayPlanEnv] : undefined;
    if (!razorpayPlan) return { ok: false, status: 503, reason: "This plan isn't set up yet. Please try again later." };
    // the price on the page must be the price the student is charged
    const real = await rzp.fetchPlanAmount(razorpayPlan);
    if (real !== plan.amountPaise) {
      console.error(`Razorpay plan ${razorpayPlan} costs ${real} paise but ${planId} is configured as ${plan.amountPaise}`);
      return { ok: false, status: 503, reason: "This plan's price is being updated. Please try again later." };
    }
    const sub = await rzp.createSubscription({ planId: razorpayPlan, totalCount: plan.totalCount ?? 12, notes: { user_id: userId, plan_id: planId } });
    await store.saveCheckout({ razorpayId: sub.id, userId, planId, kind: "subscription" });
    return { ok: true, kind: "subscription", id: sub.id, amountPaise: plan.amountPaise, label: plan.label };
  }

  const order = await rzp.createOrder({ amount: plan.amountPaise, receipt: `eu_${userId.slice(0, 8)}_${Date.now()}`, notes: { user_id: userId, plan_id: planId } });
  await store.saveCheckout({ razorpayId: order.id, userId, planId, kind: "order" });
  return { ok: true, kind: "order", id: order.id, amountPaise: plan.amountPaise, label: plan.label };
}

export type VerifyBody = { razorpay_payment_id?: unknown; razorpay_order_id?: unknown; razorpay_subscription_id?: unknown; razorpay_signature?: unknown };

/**
 * Runs after Checkout reports success in the browser. The signature proves the payment details were not forged and
 * the checkout record proves the payment belongs to this student. The webhook stays the source of truth for renewals.
 */
export async function verifyCheckout(args: { userId: string; body: VerifyBody; rzp: RazorpayLike; store: Store; keySecret: string; now?: Date }): Promise<{ ok: true; pro: boolean; pending: boolean } | Fail> {
  const { userId, body, rzp, store, keySecret } = args;
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  const paymentId = s(body.razorpay_payment_id), signature = s(body.razorpay_signature);
  const orderId = s(body.razorpay_order_id), subId = s(body.razorpay_subscription_id);
  const id = subId || orderId;
  if (!paymentId || !signature || !id) return { ok: false, status: 400, reason: "Incomplete payment details." };

  const checkout = await store.getCheckout(id);
  if (!checkout || checkout.userId !== userId) return { ok: false, status: 403, reason: "This payment does not belong to your account." };
  if (!isPlanId(checkout.planId)) return { ok: false, status: 400, reason: "Unknown plan." };

  if (checkout.kind === "subscription") {
    if (!verifySubscriptionSignature(paymentId, id, signature, keySecret)) return { ok: false, status: 400, reason: "Payment could not be verified." };
    const sub = await rzp.fetchSubscription(id);
    if (sub.status !== "active" || !sub.current_end) return { ok: true, pro: false, pending: true }; // the webhook finishes the job
    await applyEffect(store, { type: "subscription_paid", subscriptionId: id, userId, planId: checkout.planId, until: new Date(sub.current_end * 1000), paymentId }, args.now);
    return { ok: true, pro: true, pending: false };
  }

  if (!verifyOrderSignature(id, paymentId, signature, keySecret)) return { ok: false, status: 400, reason: "Payment could not be verified." };
  const pay = await rzp.fetchPayment(paymentId);
  if (pay.status !== "captured") return { ok: true, pro: false, pending: true };
  const r = await applyEffect(store, { type: "order_paid", orderId: id, userId, planId: checkout.planId as PlanId, amount: pay.amount, paymentId }, args.now);
  return r.applied ? { ok: true, pro: true, pending: false } : { ok: false, status: 400, reason: "Payment amount did not match." };
}
