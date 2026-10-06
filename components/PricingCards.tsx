"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PLANS, type Plan } from "@/lib/pricing";
import { useEntitlements } from "./useEntitlements";

type RazorpayOptions = Record<string, unknown>;
declare global {
  interface Window {
    Razorpay?: new (o: RazorpayOptions) => { open(): void };
  }
}

function loadCheckoutScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function PricingCards() {
  const router = useRouter();
  const { me, refresh } = useEntitlements();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const polling = useRef(false);

  // the webhook may land a few seconds after the browser says "paid"
  const waitForPro = async () => {
    if (polling.current) return;
    polling.current = true;
    for (let i = 0; i < 12; i++) {
      const m = await refresh();
      if (m?.isPro) { setMsg({ tone: "info", text: "You're Pro now. Thank you! 3D models and unlimited solves are unlocked." }); polling.current = false; return; }
      await sleep(3000);
    }
    polling.current = false;
    setMsg({ tone: "info", text: "Payment received. Your Pro access is being activated and will show up in your account shortly." });
  };

  const buy = async (plan: Plan) => {
    setMsg(null);
    if (plan.id === "free") { router.push(me?.signedIn ? "/#upload" : "/login?next=" + encodeURIComponent("/#upload")); return; }
    if (!me) return;
    if (!me.configured.auth) { setMsg({ tone: "info", text: "Sign-in isn't set up on this site yet, so plans can't be bought right now." }); return; }
    if (!me.signedIn) { router.push("/login?next=" + encodeURIComponent("/#pricing")); return; }
    if (!me.configured.payments) { setMsg({ tone: "info", text: "Payments aren't switched on yet. Please check back soon." }); return; }

    setBusy(plan.id);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ planId: plan.id }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.reason ?? "Could not start the payment.");
      if (!(await loadCheckoutScript()) || !window.Razorpay) throw new Error("Could not load the payment window. Check your connection and try again.");

      const options: RazorpayOptions = {
        key: data.keyId,
        name: "EasyUnderstand 製図",
        description: data.label,
        prefill: { email: data.email },
        theme: { color: "#ffb347" },
        ...(data.kind === "subscription" ? { subscription_id: data.id } : { order_id: data.id, amount: data.amountPaise, currency: "INR" }),
        modal: { ondismiss: () => setBusy(null) },
        handler: async (r: Record<string, string>) => {
          try {
            const v = await fetch("/api/checkout/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(r) });
            const out = await v.json();
            if (!out.ok) throw new Error(out.reason);
            if (out.pro) { await refresh(); setMsg({ tone: "info", text: "You're Pro now. Thank you! 3D models and unlimited solves are unlocked." }); }
            else await waitForPro();
          } catch (e) {
            setMsg({ tone: "error", text: (e instanceof Error ? e.message : "We couldn't confirm the payment.") + " If money was deducted, access is added automatically within a few minutes." });
          } finally {
            setBusy(null);
          }
        },
      };
      new window.Razorpay(options).open();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : "Something went wrong." });
      setBusy(null);
    }
  };

  const current = me?.signedIn && me.isPro ? me.planId : null;
  return (
    <>
      <div className="cards">
        {PLANS.map((p) => {
          const isCurrent = (p.id === "free" && me?.signedIn && !me.isPro) || (current !== null && p.id === current);
          return (
            <div key={p.id} className={`card plan ${p.highlight ? "hl" : ""}`}>
              {p.highlight && <span className="badge">Best value</span>}
              <h3>{p.name}</h3>
              <div className="price">{p.price}</div>
              <div className="muted -mt-1 text-sm">{p.note}</div>
              <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
              <button className={`btn ${p.highlight ? "btn-primary" : ""}`} disabled={busy !== null || isCurrent || !me} onClick={() => buy(p)}>
                {busy === p.id ? "Opening payment…" : isCurrent ? "Your current plan" : p.id === "free" ? "Start free" : `Get ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>
      {msg && <p role={msg.tone === "error" ? "alert" : "status"} className={`callout ${msg.tone === "info" ? "info" : ""} mt-4`}>{msg.text}</p>}
      <p className="muted mt-4 text-xs">
        Payments by Razorpay (UPI, cards, netbanking). Subscriptions renew automatically and you can cancel any time from your account; you keep Pro until the end of the period you paid for.
        See the <a href="/legal/refunds" className="underline">refund policy</a>.
      </p>
    </>
  );
}
