"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export function LoginForm({ next, configured, initialError }: { next: string; configured: boolean; initialError?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(initialError ? "That sign-in link didn’t work or has expired. Please request a new one and open it in the same browser you asked for it in." : null);

  if (!configured) return <p className="callout info">Sign-in isn’t switched on for this site yet. You can still use every sample lesson.</p>;
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
    <>
      {state === "sent" ? (
        <p role="status" className="callout info" style={{ marginTop: 20 }}>Check your inbox for a sign-in link. Open it in this same browser and device. Links expire after a while.</p>
      ) : (
        <form onSubmit={magic}>
          <button type="button" className="ghost" onClick={google}>Continue with Google</button>
          <span className="micro" style={{ textAlign: "center", margin: "6px 0" }}>or get a sign-in link by email</span>
          <label className="field-label" htmlFor="email">EMAIL ADDRESS</label>
          <input className="field" id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          <button className="primary" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send me a sign-in link →"}</button>
        </form>
      )}
      {error && <p role="alert" className="callout" style={{ marginTop: 14 }}>{error}</p>}
    </>
  );
}
