import { razorpayConfigured, serviceRoleConfigured } from "@/lib/env";
import { json, sameOrigin } from "@/lib/http";
import { createCheckout } from "@/lib/payments/checkout";
import { razorpayClient } from "@/lib/payments/razorpay";
import { supabaseStore } from "@/lib/supabase/admin";
import { currentUser } from "@/lib/supabase/server";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ ok: false, reason: "Bad origin." }, 403);
  if (!razorpayConfigured() || !serviceRoleConfigured()) return json({ ok: false, reason: "Payments aren't set up on this site yet." }, 503);
  const user = await currentUser();
  if (!user) return json({ ok: false, code: "login_required", reason: "Please sign in first." }, 401);

  const body = await req.json().catch(() => null);
  try {
    const r = await createCheckout({ userId: user.id, planId: body?.planId, rzp: razorpayClient(), store: supabaseStore(), planIds: process.env });
    if (!r.ok) return json({ ok: false, reason: r.reason }, r.status);
    return json({ ...r, keyId: process.env.RAZORPAY_KEY_ID, email: user.email ?? "" });
  } catch (e) {
    console.error("checkout failed", e);
    return json({ ok: false, reason: "We couldn't start the payment. Please try again." }, 502);
  }
}
