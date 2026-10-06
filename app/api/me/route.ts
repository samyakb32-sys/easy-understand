import { SIGNED_OUT } from "@/lib/entitlements";
import { razorpayConfigured, serviceRoleConfigured, supabaseConfigured } from "@/lib/env";
import { json } from "@/lib/http";
import { loadEntitlements } from "@/lib/me";
import { currentUser } from "@/lib/supabase/server";

export async function GET() {
  const configured = { auth: supabaseConfigured() && serviceRoleConfigured(), payments: razorpayConfigured() };
  if (!configured.auth) return json({ ...SIGNED_OUT, configured });
  const user = await currentUser();
  if (!user) return json({ ...SIGNED_OUT, configured });
  return json({ ...(await loadEntitlements(user.id)), email: user.email ?? null, configured });
}
