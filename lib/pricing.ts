/**
 * Plans and prices. Amounts are in paise (INR subunits) and are the single source of truth for what the
 * site shows and what an order is created for.
 *
 * !! The prices below are DEFAULTS, not a decision. Change them here, and for the two subscription plans also
 * !! create Razorpay plans with the SAME amount (checkout refuses to start if they differ).
 */
export type PlanId = "pro_monthly" | "pro_yearly" | "exam";

export type Plan = {
  id: PlanId | "free";
  name: string;
  /** shown big on the card */
  price: string;
  note: string;
  features: string[];
  highlight?: boolean;
};

export type PaidPlan = {
  id: PlanId;
  kind: "subscription" | "order";
  amountPaise: number;
  /** how long one payment buys access, for one-time plans */
  accessDays?: number;
  /** billing cycles to authorise for a subscription (the student can cancel any time) */
  totalCount?: number;
  /** env var holding the Razorpay plan id (subscriptions only) */
  razorpayPlanEnv?: string;
  label: string;
};

export const PAID_PLANS: Record<PlanId, PaidPlan> = {
  pro_monthly: { id: "pro_monthly", kind: "subscription", amountPaise: 19900, totalCount: 60, razorpayPlanEnv: "RAZORPAY_PLAN_MONTHLY", label: "EasyUnderstand Pro (monthly)" },
  pro_yearly: { id: "pro_yearly", kind: "subscription", amountPaise: 149900, totalCount: 10, razorpayPlanEnv: "RAZORPAY_PLAN_YEARLY", label: "EasyUnderstand Pro (yearly)" },
  exam: { id: "exam", kind: "order", amountPaise: 49900, accessDays: 90, label: "EasyUnderstand Exam pack (90 days)" },
};

export const isPlanId = (v: unknown): v is PlanId => typeof v === "string" && Object.hasOwn(PAID_PLANS, v);

export const rupees = (paise: number) => "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });

/** AI solves per India-time day. Pro is "unlimited" with a fair-use ceiling so one account cannot run up the bill. */
export const FREE_DAILY_SOLVES = 3;
export const PRO_DAILY_SOLVES = 100;

export const PLANS: Plan[] = [
  { id: "free", name: "Free", price: "₹0", note: "to get started", features: [`${FREE_DAILY_SOLVES} AI solves a day`, "All example lessons", "Step-by-step 2D drawing"] },
  {
    id: "pro_monthly",
    name: "Pro monthly",
    price: rupees(PAID_PLANS.pro_monthly.amountPaise),
    note: "per month, cancel any time",
    features: ["Unlimited AI solves (fair use)", "3D model with front / top / side views", "Saved history of your lessons"],
  },
  {
    id: "pro_yearly",
    name: "Pro yearly",
    price: rupees(PAID_PLANS.pro_yearly.amountPaise),
    note: `per year · about ${rupees(Math.round(PAID_PLANS.pro_yearly.amountPaise / 12))}/month`,
    features: ["Everything in Pro monthly", "Best value for the whole course"],
    highlight: true,
  },
  {
    id: "exam",
    name: "Exam pack",
    price: rupees(PAID_PLANS.exam.amountPaise),
    note: `one-time · ${PAID_PLANS.exam.accessDays} days of Pro`,
    features: ["Everything in Pro", "No subscription, no auto-renewal"],
  },
];
