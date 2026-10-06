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
    <div className="grid gap-3">
      {state === "idle" ? (
        <button className="btn" onClick={() => setState("confirm")}>Cancel subscription</button>
      ) : (
        <div className="callout">
          Stop renewing? You keep Pro until {until}, then your account goes back to Free.
          <div className="mt-3 flex gap-2">
            <button className="btn" onClick={cancel} disabled={state === "busy"}>{state === "busy" ? "Cancelling…" : "Yes, stop renewing"}</button>
            <button className="btn" onClick={() => setState("idle")} disabled={state === "busy"}>Keep it</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="callout">{error}</p>}
    </div>
  );
}
