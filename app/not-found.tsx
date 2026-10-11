import Link from "next/link";
import { pageTitle } from "@/lib/brand";

export const metadata = { title: pageTitle("Page not found") };

export default function NotFound() {
  return (
    <div className="app-shell">
      <main className="page">
        <section className="history-empty">
          <div className="empty-icon" aria-hidden="true">∠</div>
          <h2>We couldn’t find that page.</h2>
          <p>The link may be old or mistyped.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link className="primary" href="/">Back to home</Link>
            <Link className="ghost" href="/lessons">Browse lessons</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
