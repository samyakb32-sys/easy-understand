import { razorpayConfigured, serviceRoleConfigured } from "@/lib/env";
import { json, sameOrigin } from "@/lib/http";
import { verifyCheckout } from "@/lib/payments/checkout";
import { razorpayClient } from "@/lib/payments/razorpay";
import { supabaseStore } from "@/lib/supabase/admin";
import { currentUser } from "@/lib/supabase/server";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ ok: false, reason: "Bad origin." }, 403);
  if (!razorpayConfigured() || !serviceRoleConfigured()) return json({ ok: false, reason: "Payments aren't set up on this site yet." }, 503);
  const user = await currentUser();
  if (!user) return json({ ok: false, reason: "Please sign in first." }, 401);
  const body = await req.json().catch(() => ({}));
  try {
    const r = await verifyCheckout({ userId: user.id, body, rzp: razorpayClient(), store: supabaseStore(), keySecret: process.env.RAZORPAY_KEY_SECRET! });
    return r.ok ? json(r) : json(r, r.status);
  } catch (e) {
    console.error("verify failed", e);
    return json({ ok: false, reason: "We couldn't confirm the payment yet. If money was taken, access will be added automatically within a few minutes." }, 502);
  }
}
