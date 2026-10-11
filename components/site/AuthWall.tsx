import Link from "next/link";

/** The design's "save the good stuff" card, for pages that need an account. */
export function AuthWall({ copy, next, configured }: { copy: string; next: string; configured: boolean }) {
  return (
    <div className="app-shell">
      <main className="page">
        <section className="history-empty">
          <div className="empty-icon" aria-hidden="true">⌁</div>
          <h2>{configured ? "Save the good stuff." : "Accounts are coming soon."}</h2>
          <p>{configured ? copy : "Sign-in isn’t switched on for this site yet. Every sample lesson works without an account."}</p>
          {configured ? <Link className="primary" href={`/login?next=${encodeURIComponent(next)}`}>Sign in to continue ↗</Link> : <Link className="primary" href="/lessons">Browse lessons ↗</Link>}
        </section>
      </main>
    </div>
  );
}
