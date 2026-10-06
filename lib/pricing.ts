/** Placeholder plans. Prices are not final and payments are not wired up yet. */
export type Plan = { id: string; name: string; price: string; note: string; features: string[]; highlight?: boolean };

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    note: "to get started",
    features: ["Example lessons", "Step-by-step 2D drawing", "A few AI solves a day"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "TBA",
    note: "per month",
    features: ["Unlimited AI solves", "3D model with front / top / side views", "Save your history", "Export drawings"],
    highlight: true,
  },
  {
    id: "exam",
    name: "Exam pack",
    price: "TBA",
    note: "one-time",
    features: ["Everything in Pro", "For the weeks before your exam"],
  },
];

/** Called by the pricing buttons. Real checkout will be added later. */
export function startCheckout(_planId: string): { ok: false; reason: string } {
  return { ok: false, reason: "Payments are coming soon." };
}
