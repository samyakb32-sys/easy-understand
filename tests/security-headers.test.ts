import { describe, expect, it } from "vitest";
import { buildCsp, securityHeaders } from "@/lib/security-headers";
import nextConfig from "../next.config";

const get = (h: { key: string; value: string }[], k: string) => h.find((x) => x.key === k)?.value;

describe("security headers", () => {
  it("blocks framing and sniffing in production", () => {
    const h = securityHeaders(false);
    expect(get(h, "Content-Security-Policy")).toBe("frame-ancestors 'none'");
    expect(get(h, "X-Frame-Options")).toBe("DENY");
    expect(get(h, "X-Content-Type-Options")).toBe("nosniff");
    expect(get(h, "Referrer-Policy")).toBeTruthy();
    expect(get(h, "Strict-Transport-Security")).toMatch(/max-age=\d+/);
  });
  it("lets Razorpay checkout and Supabase through, and does not block the payment iframe", () => {
    const csp = buildCsp(false);
    expect(csp).toContain("https://checkout.razorpay.com");
    expect(csp).toMatch(/frame-src [^;]*https:\/\/api\.razorpay\.com/);
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).not.toContain("unsafe-eval");
    expect(get(securityHeaders(false), "Permissions-Policy")).not.toMatch(/payment/);
  });
  it("allows eval and local websockets only in dev", () => {
    expect(buildCsp(true)).toContain("'unsafe-eval'");
    expect(get(securityHeaders(true), "Strict-Transport-Security")).toBeUndefined();
  });
  it("next.config applies them to every path and hides X-Powered-By", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    const rules = await nextConfig.headers!();
    expect(rules[0].source).toBe("/:path*");
    expect(rules[0].headers.some((h) => h.key === "X-Frame-Options")).toBe(true);
  });
});
