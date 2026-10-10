"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="lesson wrap">
      <h1>Something went wrong</h1>
      <p className="muted mt-2" role="alert">Please try again. If it keeps happening, check your connection or come back in a few minutes.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
        <Link href="/" className="btn">Back to home</Link>
      </div>
    </main>
  );
}
