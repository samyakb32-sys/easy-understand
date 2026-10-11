import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthWall } from "@/components/site/AuthWall";
import { pageTitle } from "@/lib/brand";
import { serviceRoleConfigured, supabaseConfigured } from "@/lib/env";
import { loadEntitlements } from "@/lib/me";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: pageTitle("My lessons"), robots: { index: false } };
export const dynamic = "force-dynamic";

const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function HistoryPage() {
  if (!supabaseConfigured() || !serviceRoleConfigured()) return <AuthWall copy="" next="/history" configured={false} />;
  const user = await currentUser();
  if (!user) redirect("/login?next=" + encodeURIComponent("/history"));
  const ent = await loadEntitlements(user.id);
  const sb = await supabaseServer();
  const { data: lessons } = await sb.from("lessons").select("id,title,created_at").order("created_at", { ascending: false }).limit(100);

  return (
    <div className="app-shell">
      <main className="page">
        <div className="screen-heading">
          <div className="eyebrow">YOUR STUDY TRAIL</div>
          <h1>Keep your wins<br />within reach.</h1>
          <p>Every problem you solve on Pro is saved here, with the exact construction you followed.</p>
        </div>
        {!ent.canSaveHistory && <p className="callout info" style={{ marginBottom: 16 }}>Saving lessons is a Pro feature. <Link href="/pricing">See Pro plans</Link>. Lessons you saved while you were Pro are still listed below.</p>}
        {lessons?.length ? (
          <section className="history-list">
            {lessons.map((l, i) => (
              <Link key={l.id} href={`/history/${l.id}`} className="history-row">
                <div className="history-ico">{String(i + 1).padStart(2, "0")}</div>
                <div><h3>{l.title}</h3><p>Solved {fmt(l.created_at)}</p></div>
                <span className="ghost">Open →</span>
              </Link>
            ))}
          </section>
        ) : (
          <section className="history-empty">
            <div className="empty-icon" aria-hidden="true">✦</div>
            <h2>No saved lessons yet.</h2>
            <p>Solve a question and it will appear here, ready to replay before your exam.</p>
            <Link className="primary" href="/solve">Solve a question ↗</Link>
          </section>
        )}
      </main>
    </div>
  );
}
