import { SAMPLES } from "@/lib/samples";
import { describe, expect, it } from "vitest";
import robots from "../app/robots";
import sitemap from "../app/sitemap";

describe("robots and sitemap", () => {
  it("hides private routes", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    for (const p of ["/api/", "/account", "/history", "/auth/", "/login"]) expect(rule.disallow).toContain(p);
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/);
  });
  it("lists the main pages, legal pages and every sample lesson", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls.length).toBe(4 + 4 + Object.keys(SAMPLES).length);
    for (const p of ["/solve", "/lessons", "/pricing", "/legal/refunds", "/lessons/isometric-prism"]) expect(urls.some((u) => u.endsWith(p))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
