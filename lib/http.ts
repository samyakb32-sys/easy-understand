import { NextResponse } from "next/server";

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Browsers always send Origin on a POST. Rejecting a different one stops other sites from using a student's cookie. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Only allow redirects to a path on this site, never to another domain.
 * The URL parser silently drops tab, CR and LF, so "/<TAB>/evil.com" would become "//evil.com": reject control
 * characters, then resolve the value against a dummy origin and make sure it still lands on that origin.
 */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const u = new URL(next, "http://site.invalid");
    if (u.origin !== "http://site.invalid") return fallback;
  } catch {
    return fallback;
  }
  return next;
}
