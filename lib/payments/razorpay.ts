import Razorpay from "razorpay";
import type { RazorpayLike } from "./checkout";

/** Real Razorpay client behind the small interface the payment logic uses. */
export function razorpayClient(): RazorpayLike {
  const rz = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID!, key_secret: process.env.RAZORPAY_KEY_SECRET! });
  return {
    async createSubscription({ planId, totalCount, notes }) {
      const s = await rz.subscriptions.create({ plan_id: planId, total_count: totalCount, customer_notify: 1, notes });
      return { id: s.id };
    },
    async createOrder({ amount, receipt, notes }) {
      const o = await rz.orders.create({ amount, currency: "INR", receipt, notes });
      return { id: o.id };
    },
    async fetchPlanAmount(planId) {
      const p = await rz.plans.fetch(planId);
      return Number(p.item.amount);
    },
    async fetchSubscription(id) {
      const s = await rz.subscriptions.fetch(id);
      return { id: s.id, status: String(s.status), current_end: s.current_end ?? null };
    },
    async fetchPayment(id) {
      const p = await rz.payments.fetch(id);
      return { id: p.id, status: String(p.status), amount: Number(p.amount) };
    },
    async cancelSubscription(id, atCycleEnd) {
      await rz.subscriptions.cancel(id, atCycleEnd);
    },
  };
}
