import "server-only";
import { computeEntitlements, type Entitlements } from "./entitlements";
import { supabaseAdmin } from "./supabase/admin";

/** Today's date in India, matching consume_solve() in the database. India has no daylight saving. */
export const indiaDay = (now = Date.now()) => new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);

export async function loadEntitlements(userId: string): Promise<Entitlements> {
  const sb = supabaseAdmin();
  const [e, u] = await Promise.all([
    sb.from("entitlements").select("pro_until,subscription_id,subscription_status,plan_id").eq("user_id", userId).maybeSingle(),
    sb.from("usage").select("solves").eq("user_id", userId).eq("day", indiaDay()).maybeSingle(),
  ]);
  return computeEntitlements(e.data ?? null, u.data?.solves ?? 0);
}
