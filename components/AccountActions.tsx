"use client";

import { useState } from "react";

export function CancelSubscription({ proUntil }: { proUntil: string }) {
  const [state, setState] = useState<"idle" | "confirm" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const until = new Date(proUntil).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  const cancel = async () => {
    setState("busy");
    setError(null);
    try {
      const r = await fetch("/api/subscription/cancel", { method: "POST" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.reason);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel.");
      setState("confirm");
    }
  };

  if (state === "done") return <p role="status" className="callout info">Your subscription won't renew. You keep Pro until {until}.</p>;
  return (
    <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
      {state === "idle" ? (
        <button className="ghost" onClick={() => setState("confirm")}>Cancel subscription</button>
      ) : (
        <div className="callout">
          Stop renewing? You keep Pro until {until}, then your account goes back to Free.
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button className="primary" onClick={cancel} disabled={state === "busy"}>{state === "busy" ? "Cancelling…" : "Yes, stop renewing"}</button>
            <button className="ghost" onClick={() => setState("idle")} disabled={state === "busy"}>Keep it</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="callout">{error}</p>}
    </div>
  );
}
