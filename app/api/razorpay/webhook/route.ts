import { serviceRoleConfigured, webhookSecret } from "@/lib/env";
import { supabaseStore } from "@/lib/supabase/admin";
import { handleWebhook } from "@/lib/payments/webhook";

export async function POST(req: Request) {
  if (!serviceRoleConfigured()) return new Response("not configured", { status: 503 });
  // the signature covers the exact bytes Razorpay sent, so read the body as text and never re-serialise it
  const rawBody = await req.text();
  const out = await handleWebhook({
    rawBody,
    signature: req.headers.get("x-razorpay-signature"),
    eventId: req.headers.get("x-razorpay-event-id"),
    secret: webhookSecret(),
    store: supabaseStore(),
  });
  return new Response(out.body, { status: out.status });
}
