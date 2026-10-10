"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export function LoginForm({ next, configured, initialError }: { next: string; configured: boolean; initialError?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(initialError ? "That sign-in link didn't work or has expired. Please request a new one and open it in the same browser you asked for it in." : null);

  if (!configured) {
    return <p className="callout info">Sign-in isn't set up on this site yet. You can still use all the example lessons.</p>;
  }
  const redirectTo = () => `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const google = async () => {
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (error) setError(error.message);
  };
  const magic = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setState("sending");
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
    if (error) { setError(error.message); setState("idle"); } else setState("sent");
  };

  return (
    <div className="upload-card" style={{ maxWidth: 420 }}>
      <button className="btn w-full" onClick={google}>Continue with Google</button>
      <div className="muted text-center text-xs">or get a sign-in link by email</div>
      {state === "sent" ? (
        <p role="status" className="callout info">Check your inbox for a sign-in link. Open it in this same browser and device, or it won't work. Links expire after a while.</p>
      ) : (
        <form onSubmit={magic} className="grid gap-3">
          <label className="field">
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"
              className="rounded-xl border border-[var(--line)] bg-[#070f1b] p-3 text-[var(--text)]" />
          </label>
          <button className="btn btn-primary" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Email me a link"}</button>
        </form>
      )}
      {error && <p role="alert" className="callout">{error}</p>}
    </div>
  );
}
