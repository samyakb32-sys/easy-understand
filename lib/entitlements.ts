import { FREE_DAILY_SOLVES, PRO_DAILY_SOLVES } from "./pricing";

export type EntitlementRow = {
  pro_until: string | null;
  subscription_id: string | null;
  subscription_status: string | null;
  plan_id: string | null;
} | null;

export type Entitlements = {
  signedIn: boolean;
  isPro: boolean;
  proUntil: string | null;
  planId: string | null;
  /** true when the subscription will not renew (cancelled, halted or one-time pack) */
  endsAtPeriodEnd: boolean;
  hasSubscription: boolean;
  dailyLimit: number;
  solvesUsedToday: number;
  solvesLeftToday: number;
  canUse3D: boolean;
  canSaveHistory: boolean;
};

export const SIGNED_OUT: Entitlements = {
  signedIn: false, isPro: false, proUntil: null, planId: null, endsAtPeriodEnd: false, hasSubscription: false,
  dailyLimit: 0, solvesUsedToday: 0, solvesLeftToday: 0, canUse3D: false, canSaveHistory: false,
};

/** Pro is simply "pro_until is in the future". Payments and webhooks only ever move that date. */
export function computeEntitlements(row: EntitlementRow, solvesUsedToday: number, now: Date = new Date()): Entitlements {
  const until = row?.pro_until ? new Date(row.pro_until) : null;
  const isPro = !!until && until.getTime() > now.getTime();
  const status = row?.subscription_status ?? null;
  const dailyLimit = isPro ? PRO_DAILY_SOLVES : FREE_DAILY_SOLVES;
  const renewing = !!row?.subscription_id && (status === "active" || status === "authenticated" || status === "created");
  return {
    signedIn: true,
    isPro,
    proUntil: isPro ? until!.toISOString() : null,
    planId: isPro ? row?.plan_id ?? null : null,
    endsAtPeriodEnd: isPro && !renewing,
    hasSubscription: !!row?.subscription_id && isPro && renewing,
    dailyLimit,
    solvesUsedToday,
    solvesLeftToday: Math.max(0, dailyLimit - solvesUsedToday),
    canUse3D: isPro,
    canSaveHistory: isPro,
  };
}
