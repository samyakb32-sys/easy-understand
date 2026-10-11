"use client";

// Replaces the root layout when it fails, so it needs its own <html> and inline styles (globals.css is not loaded).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f7f6f1", color: "#171b29", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "4rem 1.25rem" }}>
          <h1>Something went wrong</h1>
          <p role="alert">Please try again. If it keeps happening, come back in a few minutes.</p>
          <button type="button" onClick={reset} style={{ padding: "0.6rem 1.1rem", borderRadius: 8, border: "2px solid #151b27", background: "#635bff", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
