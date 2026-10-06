import type { PlanId } from "../pricing";
import type { EntitlementRow } from "../entitlements";

export type CheckoutRecord = { razorpayId: string; userId: string; planId: PlanId; kind: "subscription" | "order" };
export type PaymentRecord = {
  /** unique per real-world payment so retries and the verify call never double count */
  dedupeKey: string;
  userId: string;
  planId: string | null;
  paymentId?: string;
  orderId?: string;
  subscriptionId?: string;
  amount?: number;
};

/** Everything the payment logic needs from a database. Supabase in production, memory in tests. */
export interface Store {
  claimEvent(id: string): Promise<boolean>;
  saveCheckout(c: CheckoutRecord): Promise<void>;
  getCheckout(razorpayId: string): Promise<CheckoutRecord | null>;
  /** returns true only the first time this dedupeKey is seen */
  recordPayment(p: PaymentRecord): Promise<boolean>;
  /** pro_until becomes the later of its current value and `until` */
  extendPro(userId: string, until: Date, patch?: { subscriptionId?: string; subscriptionStatus?: string; planId?: string }): Promise<void>;
  setSubscriptionStatus(userId: string, subscriptionId: string, status: string): Promise<void>;
  getEntitlement(userId: string): Promise<EntitlementRow>;
  userForSubscription(subscriptionId: string): Promise<string | null>;
}

export class MemoryStore implements Store {
  events = new Set<string>();
  checkouts = new Map<string, CheckoutRecord>();
  payments = new Map<string, PaymentRecord>();
  ent = new Map<string, NonNullable<EntitlementRow>>();

  async claimEvent(id: string) { if (this.events.has(id)) return false; this.events.add(id); return true; }
  async saveCheckout(c: CheckoutRecord) { this.checkouts.set(c.razorpayId, c); }
  async getCheckout(id: string) { return this.checkouts.get(id) ?? null; }
  async recordPayment(p: PaymentRecord) { if (this.payments.has(p.dedupeKey)) return false; this.payments.set(p.dedupeKey, p); return true; }
  async extendPro(userId: string, until: Date, patch: { subscriptionId?: string; subscriptionStatus?: string; planId?: string } = {}) {
    const cur = this.ent.get(userId) ?? { pro_until: null, subscription_id: null, subscription_status: null, plan_id: null };
    const later = !cur.pro_until || new Date(cur.pro_until) < until ? until.toISOString() : cur.pro_until;
    this.ent.set(userId, {
      pro_until: later,
      subscription_id: patch.subscriptionId ?? cur.subscription_id,
      subscription_status: patch.subscriptionStatus ?? cur.subscription_status,
      plan_id: patch.planId ?? cur.plan_id,
    });
  }
  async setSubscriptionStatus(userId: string, subscriptionId: string, status: string) {
    const cur = this.ent.get(userId) ?? { pro_until: null, subscription_id: null, subscription_status: null, plan_id: null };
    this.ent.set(userId, { ...cur, subscription_id: subscriptionId, subscription_status: status });
  }
  async getEntitlement(userId: string) { return this.ent.get(userId) ?? null; }
  async userForSubscription(subscriptionId: string) {
    for (const [uid, e] of this.ent) if (e.subscription_id === subscriptionId) return uid;
    for (const c of this.checkouts.values()) if (c.razorpayId === subscriptionId) return c.userId;
    return null;
  }
}
