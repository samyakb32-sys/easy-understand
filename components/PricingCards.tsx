"use client";

import { useState } from "react";
import { PLANS, startCheckout } from "@/lib/pricing";

export function PricingCards() {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <div className="cards">
        {PLANS.map((p) => (
          <div key={p.id} className={`card plan ${p.highlight ? "hl" : ""}`}>
            {p.highlight && <span className="badge">Most popular</span>}
            <h3>{p.name}</h3>
            <div className="price">{p.price}<span className="muted text-sm"> {p.note}</span></div>
            <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
            <button className={`btn ${p.highlight ? "btn-primary" : ""}`} onClick={() => { const r = startCheckout(p.id); if (!r.ok) setMsg(r.reason); }}>
              {p.id === "free" ? "Start free" : "Get " + p.name}
            </button>
          </div>
        ))}
      </div>
      {msg && <p role="status" className="callout info mt-4">{msg} Prices above are placeholders.</p>}
    </>
  );
}
