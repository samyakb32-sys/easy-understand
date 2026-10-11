import { pageTitle } from "@/lib/brand";
import Link from "next/link";
import { redirect } from "next/navigation";
import { serviceRoleConfigured, supabaseConfigured } from "@/lib/env";
import { loadEntitlements } from "@/lib/me";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: pageTitle("My lessons"), robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  if (!supabaseConfigured() || !serviceRoleConfigured()) {
    return <main className="page shell"><h1>My lessons</h1><p className="callout info" style={{ maxWidth: 560 }}>Accounts aren't set up on this site yet.</p></main>;
  }
  const user = await currentUser();
  if (!user) redirect("/login?next=" + encodeURIComponent("/history"));
  const ent = await loadEntitlements(user.id);
  const sb = await supabaseServer();
  const { data: lessons } = await sb.from("lessons").select("id,title,created_at").order("created_at", { ascending: false }).limit(100);

  return (
    <main className="page shell">
      <Link href="/" className="back">← back home</Link>
      <h1>My lessons</h1>
      {!ent.canSaveHistory && <p className="callout info" style={{ maxWidth: 720 }}>Saving lessons is a Pro feature. <Link href="/pricing" className="underline">See Pro plans</Link>. Lessons you saved while you were Pro are still listed below.</p>}
      {lessons?.length ? (
        <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "grid", gap: 10, maxWidth: 820 }}>
          {lessons.map((l) => (
            <li key={l.id}>
              <Link href={`/history/${l.id}`} className="panel" style={{ display: "flex", justifyContent: "space-between", gap: 16, fontWeight: 600 }}>
                <span>{l.title}</span>
                <span className="muted text-sm">{new Date(l.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="lede" style={{ marginTop: 20 }}>No saved lessons yet. <Link href="/#solve" className="underline">Solve a problem</Link> and it will appear here.</p>
      )}
    </main>
  );
}
