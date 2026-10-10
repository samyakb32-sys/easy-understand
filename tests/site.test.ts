import { describe, expect, it } from "vitest";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { SAMPLES } from "@/lib/samples";

describe("robots and sitemap", () => {
  it("hides private routes", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    for (const p of ["/api/", "/account", "/history", "/auth/", "/login"]) expect(rule.disallow).toContain(p);
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/);
  });
  it("lists home, legal and every sample lesson", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls.length).toBe(1 + 4 + Object.keys(SAMPLES).length);
    expect(urls.some((u) => u.endsWith("/legal/refunds"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/solve/isometric-prism"))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
