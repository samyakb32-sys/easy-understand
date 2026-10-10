import Link from "next/link";
import { redirect } from "next/navigation";
import { serviceRoleConfigured, supabaseConfigured } from "@/lib/env";
import { loadEntitlements } from "@/lib/me";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "My lessons · EasyUnderstand 製図", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  if (!supabaseConfigured() || !serviceRoleConfigured()) {
    return <main className="lesson wrap"><h1>My lessons</h1><p className="callout info">Accounts aren't set up on this site yet.</p></main>;
  }
  const user = await currentUser();
  if (!user) redirect("/login?next=" + encodeURIComponent("/history"));
  const ent = await loadEntitlements(user.id);
  const sb = await supabaseServer();
  const { data: lessons } = await sb.from("lessons").select("id,title,created_at").order("created_at", { ascending: false }).limit(100);

  return (
    <main className="lesson wrap">
      <Link href="/" className="muted text-sm no-underline">← Back</Link>
      <h1>My lessons</h1>
      {!ent.canSaveHistory && <p className="callout info mt-4">Saving lessons is a Pro feature. <Link href="/#pricing" className="underline">See Pro plans</Link>. Lessons you saved while you were Pro are still listed below.</p>}
      {lessons?.length ? (
        <ul className="mt-6 grid gap-2">
          {lessons.map((l) => (
            <li key={l.id}>
              <Link href={`/history/${l.id}`} className="card flex justify-between gap-4 no-underline">
                <span>{l.title}</span>
                <span className="muted text-sm">{new Date(l.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted mt-6">No saved lessons yet. Solve a problem from the <Link href="/#upload" className="underline">upload section</Link> and it will appear here.</p>
      )}
    </main>
  );
}
