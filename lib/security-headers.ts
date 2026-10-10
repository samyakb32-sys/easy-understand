/**
 * Response headers for every page (wired up in next.config.ts).
 *
 * Enforced: clickjacking protection (frame-ancestors + X-Frame-Options), nosniff, referrer and permissions policy.
 * The full script/connect CSP is sent as Report-Only first: Next inlines bootstrap <script> tags, so 'unsafe-inline'
 * is needed, and a mistake would break checkout. Watch the browser console for violations on a preview deploy, then
 * rename `Content-Security-Policy-Report-Only` to `Content-Security-Policy`.
 * Razorpay checkout needs checkout.razorpay.com (script) and api.razorpay.com (iframe). Do not add `payment=()` to
 * Permissions-Policy: it blocks that iframe. If Supabase moves to a custom domain, add it to connect-src.
 */
export function buildCsp(isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://checkout.razorpay.com https://cdn.razorpay.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.razorpay.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.razorpay.com" + (isDev ? " ws://localhost:* http://localhost:*" : ""),
    "frame-src https://api.razorpay.com https://checkout.razorpay.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function securityHeaders(isDev: boolean): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
    { key: "Content-Security-Policy-Report-Only", value: buildCsp(isDev) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), usb=()" },
    // Vercel also sends HSTS on its own domains. No includeSubDomains/preload: those are hard to undo.
    ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000" }]),
  ];
}
