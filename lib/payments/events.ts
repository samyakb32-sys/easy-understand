/** Turns a Razorpay webhook event into what it means for us. Pure, so it can be tested with real payload shapes. */
export type Effect =
  | { type: "subscription_paid"; subscriptionId: string; userId: string | null; planId: string | null; until: Date; paymentId?: string; amount?: number }
  | { type: "subscription_status"; subscriptionId: string; userId: string | null; status: string }
  | { type: "order_paid"; orderId: string; userId: string | null; planId: string | null; amount: number; paymentId?: string };

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

const entity = (payload: Obj | null, key: string): Obj | null => obj(obj(payload?.[key])?.entity);

export function interpretEvent(event: unknown): Effect | null {
  const e = obj(event);
  const name = str(e?.event);
  const payload = obj(e?.payload);
  if (!name) return null;

  if (name.startsWith("subscription.")) {
    const sub = entity(payload, "subscription");
    const id = str(sub?.id);
    if (!sub || !id) return null;
    const notes = obj(sub.notes);
    const userId = str(notes?.user_id);
    const planId = str(notes?.plan_id);
    const currentEnd = num(sub.current_end);
    const pay = entity(payload, "payment");

    if ((name === "subscription.charged" || name === "subscription.activated") && currentEnd && str(sub.status) === "active") {
      return { type: "subscription_paid", subscriptionId: id, userId, planId, until: new Date(currentEnd * 1000), paymentId: name === "subscription.charged" ? str(pay?.id) ?? undefined : undefined, amount: name === "subscription.charged" ? num(pay?.amount) ?? undefined : undefined };
    }
    if (["subscription.cancelled", "subscription.halted", "subscription.completed", "subscription.paused", "subscription.pending", "subscription.resumed"].includes(name)) {
      return { type: "subscription_status", subscriptionId: id, userId, status: str(sub.status) ?? name.split(".")[1] };
    }
    return null;
  }

  if (name === "order.paid") {
    const order = entity(payload, "order");
    const id = str(order?.id);
    if (!order || !id) return null;
    const notes = obj(order.notes);
    return { type: "order_paid", orderId: id, userId: str(notes?.user_id), planId: str(notes?.plan_id), amount: num(order.amount_paid) ?? num(order.amount) ?? 0, paymentId: str(entity(payload, "payment")?.id) ?? undefined };
  }
  return null;
}
