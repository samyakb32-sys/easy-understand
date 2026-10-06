import { applyEffect } from "./apply";
import { interpretEvent } from "./events";
import { verifyWebhookSignature } from "./signature";
import type { Store } from "./store";

export type WebhookInput = { rawBody: string; signature: string | null; eventId: string | null; secret: string; store: Store; now?: Date };
export type WebhookOutput = { status: number; body: string };

/** Verifies and applies a Razorpay webhook. Non-2xx makes Razorpay retry, so only real failures return one. */
export async function handleWebhook({ rawBody, signature, eventId, secret, store, now }: WebhookInput): Promise<WebhookOutput> {
  if (!secret) return { status: 503, body: "webhook secret not configured" };
  if (!verifyWebhookSignature(rawBody, signature, secret)) return { status: 401, body: "bad signature" };

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: "invalid json" };
  }

  const effect = interpretEvent(event);
  if (!effect) return { status: 200, body: "ignored" };
  try {
    const result = await applyEffect(store, effect, now);
    if (eventId) await store.claimEvent(eventId);
    if (!result.applied) console.warn("razorpay webhook not applied:", effect.type, result.reason);
    return { status: 200, body: result.applied ? "ok" : "skipped" };
  } catch (e) {
    console.error("razorpay webhook failed", e);
    return { status: 500, body: "error" };
  }
}
