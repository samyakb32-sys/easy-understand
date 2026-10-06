import { razorpayConfigured, serviceRoleConfigured } from "@/lib/env";
import { json, sameOrigin } from "@/lib/http";
import { razorpayClient } from "@/lib/payments/razorpay";
import { supabaseStore } from "@/lib/supabase/admin";
import { currentUser } from "@/lib/supabase/server";

/** Stops renewals. The student keeps Pro until the end of the period they already paid for. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ ok: false, reason: "Bad origin." }, 403);
  if (!razorpayConfigured() || !serviceRoleConfigured()) return json({ ok: false, reason: "Payments aren't set up on this site yet." }, 503);
  const user = await currentUser();
  if (!user) return json({ ok: false, reason: "Please sign in first." }, 401);
  const store = supabaseStore();
  const ent = await store.getEntitlement(user.id);
  if (!ent?.subscription_id || !["active", "authenticated"].includes(ent.subscription_status ?? "")) {
    return json({ ok: false, reason: "You have no active subscription." }, 404);
  }
  try {
    await razorpayClient().cancelSubscription(ent.subscription_id, true);
    await store.setSubscriptionStatus(user.id, ent.subscription_id, "cancel_scheduled");
    return json({ ok: true, proUntil: ent.pro_until });
  } catch (e) {
    console.error("cancel failed", e);
    return json({ ok: false, reason: "We couldn't cancel right now. Please try again, or contact support." }, 502);
  }
}
