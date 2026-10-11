import Link from "next/link";
import { redirect } from "next/navigation";
import { CancelSubscription } from "@/components/AccountActions";
import { AccountPrefs } from "@/components/AccountPrefs";
import { AuthWall } from "@/components/site/AuthWall";
import { pageTitle } from "@/lib/brand";
import { serviceRoleConfigured, supabaseConfigured } from "@/lib/env";
import { loadEntitlements } from "@/lib/me";
import { PAID_PLANS, rupees } from "@/lib/pricing";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: pageTitle("Your account"), robots: { index: false } };
export const dynamic = "force-dynamic";

const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

export default async function AccountPage() {
  if (!supabaseConfigured() || !serviceRoleConfigured()) return <AuthWall copy="" next="/account" configured={false} />;
  const user = await currentUser();
  if (!user) redirect("/login?next=" + encodeURIComponent("/account"));

  const ent = await loadEntitlements(user.id);
  const sb = await supabaseServer();
  const [{ data: payments }, { count }] = await Promise.all([
    sb.from("payments").select("id,plan_id,amount,created_at").order("created_at", { ascending: false }).limit(20),
    sb.from("lessons").select("id", { count: "exact", head: true }),
  ]);
  const email = user.email ?? "";
  const name = (user.user_metadata?.full_name as string | undefined) ?? email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const planName = ent.isPro ? (ent.planId && ent.planId in PAID_PLANS ? PAID_PLANS[ent.planId as keyof typeof PAID_PLANS].label.replace(/^linewise\. /, "") : "Pro") : "Free";
  const used = ent.dailyLimit - ent.solvesLeftToday;

  return (
    <div className="app-shell">
      <main className="page">
        <div className="screen-heading">
          <div className="eyebrow">YOUR SPACE</div>
          <h1>Account & study<br />settings.</h1>
        </div>
        <section className="account-grid">
          <article className="account-card">
            <div className="profile-head">
              <div className="profile-avatar">{(name || "?").slice(0, 1).toUpperCase()}</div>
              <div><h3>{name}</h3><p>{email}</p></div>
            </div>
            <div className="account-stat">
              <div><b>{count ?? 0}</b><span>lessons saved</span></div>
              <div><b>{ent.isPro ? "Pro" : "Free"}</b><span>current plan</span></div>
              <div><b>{ent.solvesLeftToday}</b><span>solves left today</span></div>
            </div>
            <div className="meter" role="img" aria-label={`${used} of ${ent.dailyLimit} solves used today`}><i style={{ width: `${ent.dailyLimit ? Math.min(100, (used / ent.dailyLimit) * 100) : 0}%` }} /></div>
            <form action="/auth/signout" method="post"><button className="ghost" style={{ marginTop: 20 }}>Sign out</button></form>
          </article>
          <article className="account-card">
            <h2>Study preferences</h2>
            <AccountPrefs />
            <div className="setting"><span>Saved lessons</span>{ent.canSaveHistory ? <Link className="ghost" href="/history">Open history →</Link> : <span className="micro">Pro feature</span>}</div>
          </article>
          <article className="account-card">
            <h2>Your plan</h2>
            <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
              You’re on <strong style={{ color: "var(--ink)" }}>{planName}</strong>.{" "}
              {ent.isPro
                ? ent.hasSubscription ? `It renews automatically. The current period ends ${fmt(ent.proUntil!)}.` : `Pro access until ${fmt(ent.proUntil!)}. It won’t renew.`
                : `${ent.solvesLeftToday} of ${ent.dailyLimit} AI solves left today. 3D models and saved history are part of Pro.`}
            </p>
            {ent.isPro && ent.hasSubscription && <CancelSubscription proUntil={ent.proUntil!} />}
            {!ent.isPro && <Link className="primary" style={{ marginTop: 14 }} href="/pricing">View plans →</Link>}
          </article>
          <article className="account-card">
            <h2>Payments</h2>
            {payments?.length ? payments.map((p) => (
              <div className="pay-row" key={p.id}>
                <span>{p.plan_id && p.plan_id in PAID_PLANS ? PAID_PLANS[p.plan_id as keyof typeof PAID_PLANS].label : "Payment"}</span>
                <span className="micro">{fmt(p.created_at)} · {p.amount ? rupees(p.amount) : ""}</span>
              </div>
            )) : <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>No payments yet.</p>}
          </article>
        </section>
      </main>
    </div>
  );
}
