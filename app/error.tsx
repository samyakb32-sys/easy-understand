"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="app-shell">
      <main className="page">
        <section className="history-empty">
          <div className="empty-icon" aria-hidden="true">⌁</div>
          <h2>Something went wrong.</h2>
          <p role="alert">Please try again. If it keeps happening, check your connection or come back in a few minutes.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" className="primary" onClick={reset}>Try again</button>
            <Link className="ghost" href="/">Back to home</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
