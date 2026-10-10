import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { computeEntitlements } from "@/lib/entitlements";
import { createCheckout, verifyCheckout, type RazorpayLike } from "@/lib/payments/checkout";
import { interpretEvent } from "@/lib/payments/events";
import { verifyOrderSignature, verifySubscriptionSignature, verifyWebhookSignature } from "@/lib/payments/signature";
import { MemoryStore } from "@/lib/payments/store";
import { handleWebhook } from "@/lib/payments/webhook";
import { FREE_DAILY_SOLVES, PAID_PLANS, PLANS, PRO_DAILY_SOLVES, isPlanId } from "@/lib/pricing";

const hmac = (secret: string, msg: string) => createHmac("sha256", secret).update(msg).digest("hex");
const SECRET = "whsec_test";
const KEY = "rzp_key_secret";
const USER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const NOW = new Date("2026-10-10T10:00:00Z");
const DAY = 86_400_000;

const sub = (event: string, status: string, extra: Record<string, unknown> = {}, pay?: Record<string, unknown>) => ({
  entity: "event", account_id: "acc_1", event, contains: pay ? ["subscription", "payment"] : ["subscription"],
  payload: {
    subscription: { entity: { id: "sub_1", plan_id: "plan_m", status, current_start: 1_790_000_000, current_end: 1_792_592_000, notes: { user_id: USER, plan_id: "pro_monthly" }, ...extra } },
    ...(pay ? { payment: { entity: pay } } : {}),
  },
  created_at: 1_790_000_100,
});
const orderPaid = (amount: number, notes: Record<string, string> = { user_id: USER, plan_id: "exam" }) => ({
  entity: "event", event: "order.paid", contains: ["payment", "order"],
  payload: { order: { entity: { id: "order_1", amount, amount_paid: amount, status: "paid", notes } }, payment: { entity: { id: "pay_1", amount } } },
});
const send = (store: MemoryStore, body: unknown, opts: { secret?: string; sig?: string | null; id?: string | null; raw?: string } = {}) => {
  const raw = opts.raw ?? JSON.stringify(body);
  return handleWebhook({ rawBody: raw, signature: opts.sig === undefined ? hmac(SECRET, raw) : opts.sig, eventId: opts.id === undefined ? "evt_1" : opts.id, secret: opts.secret ?? SECRET, store, now: NOW });
};

describe("signatures", () => {
  it("accepts the right webhook signature and rejects wrong, empty and different-length ones", () => {
    const body = '{"a":1}';
    expect(verifyWebhookSignature(body, hmac(SECRET, body), SECRET)).toBe(true);
    expect(verifyWebhookSignature(body, hmac("other", body), SECRET)).toBe(false);
    expect(verifyWebhookSignature(body + " ", hmac(SECRET, body), SECRET)).toBe(false); // body must be byte-exact
    expect(verifyWebhookSignature(body, "", SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, null, SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, "abc", SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, hmac(SECRET, body), "")).toBe(false);
  });
  it("uses order_id|payment_id for orders and payment_id|subscription_id for subscriptions", () => {
    expect(verifyOrderSignature("order_1", "pay_1", hmac(KEY, "order_1|pay_1"), KEY)).toBe(true);
    expect(verifyOrderSignature("order_1", "pay_1", hmac(KEY, "pay_1|order_1"), KEY)).toBe(false);
    expect(verifySubscriptionSignature("pay_1", "sub_1", hmac(KEY, "pay_1|sub_1"), KEY)).toBe(true);
    expect(verifySubscriptionSignature("pay_1", "sub_1", hmac(KEY, "sub_1|pay_1"), KEY)).toBe(false);
  });
});

describe("interpretEvent", () => {
  it("reads a subscription charge", () => {
    const e = interpretEvent(sub("subscription.charged", "active", {}, { id: "pay_9", amount: 19900 }));
    expect(e).toMatchObject({ type: "subscription_paid", subscriptionId: "sub_1", userId: USER, planId: "pro_monthly", paymentId: "pay_9", amount: 19900 });
    expect(e?.type === "subscription_paid" && e.until.getTime()).toBe(1_792_592_000 * 1000);
  });
  it.each(["cancelled", "halted", "completed", "paused", "pending"])("reads subscription.%s as a status change", (s) => {
    expect(interpretEvent(sub(`subscription.${s}`, s))).toMatchObject({ type: "subscription_status", status: s, userId: USER });
  });
  it("reads order.paid and ignores everything else or malformed input", () => {
    expect(interpretEvent(orderPaid(49900))).toMatchObject({ type: "order_paid", orderId: "order_1", userId: USER, planId: "exam", amount: 49900 });
    expect(interpretEvent({ event: "payment.failed", payload: {} })).toBeNull();
    expect(interpretEvent(sub("subscription.authenticated", "authenticated"))).toBeNull();
    expect(interpretEvent(null)).toBeNull();
    expect(interpretEvent("x")).toBeNull();
    expect(interpretEvent({ event: "subscription.charged", payload: { subscription: {} } })).toBeNull();
  });
  it("does not grant on a charge whose subscription is not active", () => {
    expect(interpretEvent(sub("subscription.charged", "halted"))).toBeNull();
  });
});

describe("webhook handler", () => {
  it("rejects a bad or missing signature without touching the store", async () => {
    const store = new MemoryStore();
    expect((await send(store, sub("subscription.charged", "active"), { sig: "deadbeef" })).status).toBe(401);
    expect((await send(store, sub("subscription.charged", "active"), { sig: null })).status).toBe(401);
    expect(store.ent.size).toBe(0);
  });
  it("refuses everything when the secret is not configured", async () => {
    expect((await send(new MemoryStore(), {}, { secret: "" })).status).toBe(503);
  });
  it("gives Pro until the end of the paid period, once even if delivered twice", async () => {
    const store = new MemoryStore();
    const ev = sub("subscription.charged", "active", {}, { id: "pay_9", amount: 19900 });
    expect((await send(store, ev, { id: "evt_a" })).status).toBe(200);
    expect((await send(store, ev, { id: "evt_a" })).status).toBe(200);
    expect(store.ent.get(USER)).toMatchObject({ pro_until: new Date(1_792_592_000 * 1000).toISOString(), subscription_id: "sub_1", subscription_status: "active", plan_id: "pro_monthly" });
    expect([...store.payments.keys()]).toEqual(["pay:pay_9"]);
  });
  it("keeps access to the end of the paid period after a cancellation", async () => {
    const store = new MemoryStore();
    await send(store, sub("subscription.charged", "active", {}, { id: "pay_9", amount: 19900 }));
    await send(store, sub("subscription.cancelled", "cancelled"), { id: "evt_b" });
    const e = store.ent.get(USER)!;
    expect(e.subscription_status).toBe("cancelled");
    expect(new Date(e.pro_until!).getTime()).toBe(1_792_592_000 * 1000);
  });
  it("adds 90 days for an exam pack, and only once per order", async () => {
    const store = new MemoryStore();
    await send(store, orderPaid(PAID_PLANS.exam.amountPaise), { id: "evt_1" });
    await send(store, orderPaid(PAID_PLANS.exam.amountPaise), { id: "evt_2" }); // Razorpay can also resend under a new event id
    expect(store.ent.get(USER)!.pro_until).toBe(new Date(NOW.getTime() + 90 * DAY).toISOString());
  });
  it("stacks an exam pack on top of remaining Pro time", async () => {
    const store = new MemoryStore();
    await store.extendPro(USER, new Date(NOW.getTime() + 10 * DAY));
    await send(store, orderPaid(PAID_PLANS.exam.amountPaise));
    expect(store.ent.get(USER)!.pro_until).toBe(new Date(NOW.getTime() + 100 * DAY).toISOString());
  });
  it("does not grant for a wrong amount or someone else's plan", async () => {
    const store = new MemoryStore();
    await send(store, orderPaid(100));
    await send(store, orderPaid(PAID_PLANS.exam.amountPaise, { user_id: USER, plan_id: "pro_yearly" }));
    expect(store.ent.size).toBe(0);
  });
  it("ignores unrelated events and answers 400 for a signed body that is not JSON", async () => {
    const store = new MemoryStore();
    expect(await send(store, { event: "payment.failed", payload: {} })).toEqual({ status: 200, body: "ignored" });
    expect((await send(store, null, { raw: "not json" })).status).toBe(400);
  });
  it("answers 500 when the database fails so Razorpay retries", async () => {
    const store = new MemoryStore();
    vi.spyOn(store, "extendPro").mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await send(store, sub("subscription.charged", "active", {}, { id: "pay_9", amount: 19900 }))).status).toBe(500);
  });
});

describe("failure recovery and ordering", () => {
  it("still grants the exam pack on the retry after the database failed mid-grant", async () => {
    const store = new MemoryStore();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const real = store.extendPro.bind(store);
    let calls = 0;
    vi.spyOn(store, "extendPro").mockImplementation(async (...a) => { if (calls++ === 0) throw new Error("db blip"); return real(...a); });
    expect((await send(store, orderPaid(PAID_PLANS.exam.amountPaise))).status).toBe(500);
    expect(store.payments.size).toBe(0);
    expect((await send(store, orderPaid(PAID_PLANS.exam.amountPaise))).status).toBe(200);
    expect(store.ent.get(USER)!.pro_until).toBe(new Date(NOW.getTime() + 90 * DAY).toISOString());
  });
  it("ignores a late event for an old subscription once a new one is current", async () => {
    const store = new MemoryStore();
    const charged = (id: string) => sub("subscription.charged", "active", { id, notes: { user_id: USER, plan_id: "pro_monthly" } }, { id: `pay_${id}`, amount: 19900 });
    await send(store, charged("sub_old"), { id: "e1" });
    await store.setSubscriptionStatus(USER, "sub_old", "cancel_scheduled");
    await send(store, charged("sub_new"), { id: "e2" });
    const r = await send(store, sub("subscription.cancelled", "cancelled", { id: "sub_old" }), { id: "e3" });
    expect(r.status).toBe(200);
    expect(store.ent.get(USER)).toMatchObject({ subscription_id: "sub_new", subscription_status: "active" });
  });
  it("does not let a replayed older charge revive a halted subscription", async () => {
    const store = new MemoryStore();
    const charged = sub("subscription.charged", "active", {}, { id: "pay_9", amount: 19900 });
    await send(store, charged, { id: "e1" });
    await send(store, sub("subscription.halted", "halted"), { id: "e2" });
    await send(store, charged, { id: "e3" });
    expect(store.ent.get(USER)!.subscription_status).toBe("halted");
    // a genuine later renewal still reactivates it
    await send(store, sub("subscription.charged", "active", { current_end: 1_795_000_000 }, { id: "pay_10", amount: 19900 }), { id: "e4" });
    expect(store.ent.get(USER)).toMatchObject({ subscription_status: "active", pro_until: new Date(1_795_000_000 * 1000).toISOString() });
  });
});

describe("input validation", () => {
  it("isPlanId rejects inherited object keys, and checkout answers 400", async () => {
    for (const k of ["constructor", "__proto__", "toString", "hasOwnProperty", "free", ""]) expect(isPlanId(k)).toBe(false);
    for (const k of Object.keys(PAID_PLANS)) expect(isPlanId(k)).toBe(true);
    expect(await createCheckout({ userId: USER, planId: "constructor", rzp: fakeRazorpay(), store: new MemoryStore(), planIds: {} })).toMatchObject({ ok: false, status: 400 });
  });
  it("verifyCheckout answers 400 for a JSON null body", async () => {
    expect(await verifyCheckout({ userId: USER, body: null as never, rzp: fakeRazorpay(), store: new MemoryStore(), keySecret: KEY })).toMatchObject({ ok: false, status: 400 });
  });
});

function fakeRazorpay(over: Partial<RazorpayLike> = {}): RazorpayLike & { cancelled: string[] } {
  const cancelled: string[] = [];
  return {
    cancelled,
    createSubscription: async () => ({ id: "sub_1" }),
    createOrder: async () => ({ id: "order_1" }),
    fetchPlanAmount: async () => PAID_PLANS.pro_monthly.amountPaise,
    fetchSubscription: async () => ({ id: "sub_1", status: "active", current_end: 1_792_592_000 }),
    fetchPayment: async () => ({ id: "pay_1", status: "captured", amount: PAID_PLANS.exam.amountPaise }),
    cancelSubscription: async (id) => { cancelled.push(id); },
    ...over,
  };
}
const PLAN_ENV = { RAZORPAY_PLAN_MONTHLY: "plan_m", RAZORPAY_PLAN_YEARLY: "plan_y" };

describe("createCheckout", () => {
  it("creates a subscription and remembers who it is for", async () => {
    const store = new MemoryStore();
    const r = await createCheckout({ userId: USER, planId: "pro_monthly", rzp: fakeRazorpay(), store, planIds: PLAN_ENV, now: NOW });
    expect(r).toMatchObject({ ok: true, kind: "subscription", id: "sub_1", amountPaise: 19900 });
    expect(await store.getCheckout("sub_1")).toMatchObject({ userId: USER, planId: "pro_monthly" });
  });
  it("creates an order for the exam pack at the server-side price", async () => {
    const store = new MemoryStore();
    const createOrder = vi.fn(async () => ({ id: "order_1" }));
    const r = await createCheckout({ userId: USER, planId: "exam", rzp: fakeRazorpay({ createOrder }), store, planIds: {}, now: NOW });
    expect(r).toMatchObject({ ok: true, kind: "order", id: "order_1" });
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: PAID_PLANS.exam.amountPaise, notes: { user_id: USER, plan_id: "exam" } }));
  });
  it("refuses unknown plans, missing Razorpay plan ids and price mismatches", async () => {
    const store = new MemoryStore();
    expect(await createCheckout({ userId: USER, planId: "free", rzp: fakeRazorpay(), store, planIds: PLAN_ENV })).toMatchObject({ ok: false, status: 400 });
    expect(await createCheckout({ userId: USER, planId: "pro_monthly", rzp: fakeRazorpay(), store, planIds: {} })).toMatchObject({ ok: false, status: 503 });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await createCheckout({ userId: USER, planId: "pro_monthly", rzp: fakeRazorpay({ fetchPlanAmount: async () => 29900 }), store, planIds: PLAN_ENV })).toMatchObject({ ok: false, status: 503 });
    expect(store.checkouts.size).toBe(0);
  });
  it("does not start a second subscription while one is active", async () => {
    const store = new MemoryStore();
    await store.extendPro(USER, new Date(NOW.getTime() + 5 * DAY), { subscriptionId: "sub_0", subscriptionStatus: "active", planId: "pro_monthly" });
    expect(await createCheckout({ userId: USER, planId: "pro_yearly", rzp: fakeRazorpay(), store, planIds: PLAN_ENV, now: NOW })).toMatchObject({ ok: false, status: 409 });
  });
});

describe("verifyCheckout", () => {
  const orderBody = (sig = hmac(KEY, "order_1|pay_1")) => ({ razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: sig });
  const subBody = (sig = hmac(KEY, "pay_1|sub_1")) => ({ razorpay_subscription_id: "sub_1", razorpay_payment_id: "pay_1", razorpay_signature: sig });
  const seeded = async () => {
    const store = new MemoryStore();
    await createCheckout({ userId: USER, planId: "exam", rzp: fakeRazorpay(), store, planIds: {} });
    await createCheckout({ userId: USER, planId: "pro_monthly", rzp: fakeRazorpay(), store, planIds: PLAN_ENV });
    return store;
  };

  it("grants the exam pack once, even if the browser calls verify twice", async () => {
    const store = await seeded();
    const rzp = fakeRazorpay();
    const a = await verifyCheckout({ userId: USER, body: orderBody(), rzp, store, keySecret: KEY, now: NOW });
    const b = await verifyCheckout({ userId: USER, body: orderBody(), rzp, store, keySecret: KEY, now: NOW });
    expect(a).toEqual({ ok: true, pro: true, pending: false });
    expect(b).toEqual({ ok: true, pro: true, pending: false });
    expect(store.ent.get(USER)!.pro_until).toBe(new Date(NOW.getTime() + 90 * DAY).toISOString());
  });
  it("grants a subscription until the end of its first period", async () => {
    const store = await seeded();
    const r = await verifyCheckout({ userId: USER, body: subBody(), rzp: fakeRazorpay(), store, keySecret: KEY, now: NOW });
    expect(r).toEqual({ ok: true, pro: true, pending: false });
    expect(store.ent.get(USER)).toMatchObject({ subscription_id: "sub_1", subscription_status: "active" });
  });
  it("rejects a forged signature", async () => {
    const store = await seeded();
    expect(await verifyCheckout({ userId: USER, body: orderBody("0".repeat(64)), rzp: fakeRazorpay(), store, keySecret: KEY })).toMatchObject({ ok: false, status: 400 });
    expect(store.ent.size).toBe(0);
  });
  it("rejects a payment that belongs to another account", async () => {
    const store = await seeded();
    expect(await verifyCheckout({ userId: OTHER, body: orderBody(), rzp: fakeRazorpay(), store, keySecret: KEY })).toMatchObject({ ok: false, status: 403 });
    expect(await verifyCheckout({ userId: USER, body: { ...orderBody(), razorpay_order_id: "order_unknown" }, rzp: fakeRazorpay(), store, keySecret: KEY })).toMatchObject({ ok: false, status: 403 });
    expect(store.ent.size).toBe(0);
  });
  it("waits for the webhook when the payment is not captured or the subscription not yet active", async () => {
    const store = await seeded();
    const notCaptured = fakeRazorpay({ fetchPayment: async () => ({ id: "pay_1", status: "authorized", amount: 49900 }) });
    expect(await verifyCheckout({ userId: USER, body: orderBody(), rzp: notCaptured, store, keySecret: KEY })).toEqual({ ok: true, pro: false, pending: true });
    const authenticated = fakeRazorpay({ fetchSubscription: async () => ({ id: "sub_1", status: "authenticated", current_end: null }) });
    expect(await verifyCheckout({ userId: USER, body: subBody(), rzp: authenticated, store, keySecret: KEY })).toEqual({ ok: true, pro: false, pending: true });
    expect(store.ent.size).toBe(0);
  });
  it("rejects incomplete bodies", async () => {
    expect(await verifyCheckout({ userId: USER, body: {}, rzp: fakeRazorpay(), store: new MemoryStore(), keySecret: KEY })).toMatchObject({ ok: false, status: 400 });
  });
});

describe("entitlements", () => {
  it("is Pro only while pro_until is in the future", () => {
    const row = (d: number) => ({ pro_until: new Date(NOW.getTime() + d).toISOString(), subscription_id: "sub_1", subscription_status: "active", plan_id: "pro_monthly" });
    expect(computeEntitlements(row(DAY), 0, NOW)).toMatchObject({ isPro: true, canUse3D: true, canSaveHistory: true, dailyLimit: PRO_DAILY_SOLVES, hasSubscription: true, endsAtPeriodEnd: false });
    expect(computeEntitlements(row(-1), 0, NOW)).toMatchObject({ isPro: false, canUse3D: false, dailyLimit: FREE_DAILY_SOLVES, proUntil: null });
    expect(computeEntitlements(null, 0, NOW)).toMatchObject({ isPro: false, signedIn: true });
  });
  it("counts the daily allowance and never goes negative", () => {
    expect(computeEntitlements(null, 1, NOW).solvesLeftToday).toBe(FREE_DAILY_SOLVES - 1);
    expect(computeEntitlements(null, 99, NOW).solvesLeftToday).toBe(0);
  });
  it("says the access ends when a subscription is cancelled or it is a one-time pack", () => {
    const until = new Date(NOW.getTime() + DAY).toISOString();
    expect(computeEntitlements({ pro_until: until, subscription_id: "sub_1", subscription_status: "cancelled", plan_id: "pro_monthly" }, 0, NOW)).toMatchObject({ isPro: true, endsAtPeriodEnd: true, hasSubscription: false });
    expect(computeEntitlements({ pro_until: until, subscription_id: null, subscription_status: null, plan_id: "exam" }, 0, NOW)).toMatchObject({ isPro: true, endsAtPeriodEnd: true });
  });
});

describe("pricing config", () => {
  it("has positive integer paise amounts and a card for every paid plan", () => {
    for (const p of Object.values(PAID_PLANS)) expect(Number.isInteger(p.amountPaise) && p.amountPaise > 0).toBe(true);
    for (const id of Object.keys(PAID_PLANS)) expect(PLANS.some((c) => c.id === id)).toBe(true);
    expect(PAID_PLANS.exam.accessDays).toBeGreaterThan(0);
  });
});
