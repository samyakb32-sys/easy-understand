import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { EntitlementRow } from "../entitlements";
import type { CheckoutRecord, PaymentRecord, Store } from "../payments/store";
import { supabaseUrl } from "../env";

/** Service-role client: bypasses row level security. Server code only, never import from a client component. */
export function supabaseAdmin() {
  return createClient(supabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });
}

const fail = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

export function supabaseStore(): Store {
  const sb = supabaseAdmin();
  return {
    async claimEvent(id) {
      const { error } = await sb.from("webhook_events").insert({ id });
      if (error?.code === "23505") return false;
      fail("claimEvent", error);
      return true;
    },
    async saveCheckout(c: CheckoutRecord) {
      fail("saveCheckout", (await sb.from("checkouts").insert({ razorpay_id: c.razorpayId, user_id: c.userId, plan_id: c.planId, kind: c.kind })).error);
    },
    async getCheckout(id) {
      const { data, error } = await sb.from("checkouts").select("razorpay_id,user_id,plan_id,kind").eq("razorpay_id", id).maybeSingle();
      fail("getCheckout", error);
      return data ? { razorpayId: data.razorpay_id, userId: data.user_id, planId: data.plan_id, kind: data.kind } : null;
    },
    async recordPayment(p: PaymentRecord) {
      const { error } = await sb.from("payments").insert({
        user_id: p.userId, dedupe_key: p.dedupeKey, plan_id: p.planId, razorpay_payment_id: p.paymentId, razorpay_order_id: p.orderId,
        razorpay_subscription_id: p.subscriptionId, amount: p.amount,
      });
      if (error?.code === "23505") return false;
      fail("recordPayment", error);
      return true;
    },
    async extendPro(userId, until, patch = {}) {
      const { data, error } = await sb.from("entitlements").select("pro_until").eq("user_id", userId).maybeSingle();
      fail("extendPro read", error);
      const later = data?.pro_until && new Date(data.pro_until) > until ? new Date(data.pro_until) : until;
      const row: Record<string, unknown> = { user_id: userId, pro_until: later.toISOString(), updated_at: new Date().toISOString() };
      if (patch.subscriptionId) row.subscription_id = patch.subscriptionId;
      if (patch.subscriptionStatus) row.subscription_status = patch.subscriptionStatus;
      if (patch.planId) row.plan_id = patch.planId;
      fail("extendPro write", (await sb.from("entitlements").upsert(row, { onConflict: "user_id" })).error);
    },
    async setSubscriptionStatus(userId, subscriptionId, status) {
      // update, never upsert: a late event for an old subscription must not replace the current one
      fail("setSubscriptionStatus", (await sb.from("entitlements").update({ subscription_status: status, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("subscription_id", subscriptionId)).error);
    },
    async grantOrder(p, days, now) {
      // one transaction in Postgres (supabase/migrations/0002_atomic_order.sql): payment row + pro_until move together
      const { data, error } = await sb.rpc("apply_order_payment", {
        p_user: p.userId, p_dedupe: p.dedupeKey, p_plan: p.planId, p_payment: p.paymentId ?? null, p_order: p.orderId ?? null,
        p_amount: p.amount ?? null, p_days: days, p_now: now.toISOString(),
      });
      fail("grantOrder", error);
      return data === true;
    },
    async getEntitlement(userId): Promise<EntitlementRow> {
      const { data, error } = await sb.from("entitlements").select("pro_until,subscription_id,subscription_status,plan_id").eq("user_id", userId).maybeSingle();
      fail("getEntitlement", error);
      return data ?? null;
    },
    async userForSubscription(subscriptionId) {
      const a = await sb.from("entitlements").select("user_id").eq("subscription_id", subscriptionId).maybeSingle();
      if (a.data?.user_id) return a.data.user_id;
      const b = await sb.from("checkouts").select("user_id").eq("razorpay_id", subscriptionId).maybeSingle();
      return b.data?.user_id ?? null;
    },
  };
}
