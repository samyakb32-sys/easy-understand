import { pageTitle } from "@/lib/brand";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CancelSubscription } from "@/components/AccountActions";
import { serviceRoleConfigured, supabaseConfigured } from "@/lib/env";
import { loadEntitlements } from "@/lib/me";
import { PAID_PLANS, rupees } from "@/lib/pricing";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: pageTitle("Your account"), robots: { index: false } };
export const dynamic = "force-dynamic";

const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

export default async function AccountPage() {
  if (!supabaseConfigured() || !serviceRoleConfigured()) {
    return <main className="page shell"><h1>Account</h1><p className="callout info" style={{ maxWidth: 560 }}>Accounts aren't set up on this site yet.</p></main>;
  }
  const user = await currentUser();
  if (!user) redirect("/login?next=" + encodeURIComponent("/account"));

  const ent = await loadEntitlements(user.id);
  const sb = await supabaseServer();
  const { data: payments } = await sb.from("payments").select("id,plan_id,amount,created_at").order("created_at", { ascending: false }).limit(20);

  return (
    <main className="page shell">
      <Link href="/" className="back">← back home</Link>
      <h1>Your account</h1>
      <p className="lede">{user.email}</p>

      <section className="panel" style={{ maxWidth: 720 }}>
        <div className="eyebrow">Plan</div>
        <h2 className="prof-title" style={{ margin: "8px 0 0", display: "flex", gap: 10, alignItems: "center" }}>{ent.isPro ? "Pro" : "Free"}{ent.isPro && <span className="pro-badge">PRO</span>}</h2>
        {ent.isPro ? (
          <>
            <p className="muted mt-2">
              {ent.hasSubscription ? `Renews automatically. Current period ends ${fmt(ent.proUntil!)}.` : `Pro access until ${fmt(ent.proUntil!)}. It won't renew.`}
            </p>
            {ent.hasSubscription && <div className="mt-4"><CancelSubscription proUntil={ent.proUntil!} /></div>}
          </>
        ) : (
          <>
            <p className="muted mt-2">{ent.solvesLeftToday} of {ent.dailyLimit} AI solves left today. 3D models and history are part of Pro.</p>
            <Link href="/pricing" className="btn btn-primary mt-4">See Pro plans</Link>
          </>
        )}
      </section>

      <section className="panel" style={{ maxWidth: 720, marginTop: 16 }}>
        <div className="eyebrow">Payments</div>
        {payments?.length ? (
          <ul className="mt-3 grid gap-2 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-4">
                <span>{p.plan_id && p.plan_id in PAID_PLANS ? PAID_PLANS[p.plan_id as keyof typeof PAID_PLANS].label : "Payment"}</span>
                <span className="muted">{fmt(p.created_at)} · {p.amount ? rupees(p.amount) : ""}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted mt-2 text-sm">No payments yet.</p>
        )}
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
        {ent.canSaveHistory && <Link href="/history" className="btn">My lessons</Link>}
        <form action="/auth/signout" method="post"><button className="btn">Sign out</button></form>
      </div>
    </main>
  );
}
