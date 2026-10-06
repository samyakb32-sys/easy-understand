import { createHmac, timingSafeEqual } from "node:crypto";

const hmacHex = (secret: string, message: string) => createHmac("sha256", secret).update(message).digest("hex");

/** Constant-time comparison that also copes with a signature of the wrong length. */
export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8"), y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Webhook: HMAC-SHA256 of the RAW request body with the webhook secret, sent in X-Razorpay-Signature. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  return safeEqualHex(hmacHex(secret, rawBody), signature);
}

/** Standard Checkout for an order: HMAC-SHA256 of "order_id|payment_id" with the key secret. */
export function verifyOrderSignature(orderId: string, paymentId: string, signature: string, keySecret: string): boolean {
  if (!orderId || !paymentId || !signature || !keySecret) return false;
  return safeEqualHex(hmacHex(keySecret, `${orderId}|${paymentId}`), signature);
}

/** Standard Checkout for a subscription: HMAC-SHA256 of "payment_id|subscription_id" with the key secret. */
export function verifySubscriptionSignature(paymentId: string, subscriptionId: string, signature: string, keySecret: string): boolean {
  if (!paymentId || !subscriptionId || !signature || !keySecret) return false;
  return safeEqualHex(hmacHex(keySecret, `${paymentId}|${subscriptionId}`), signature);
}
