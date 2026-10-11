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
  it("lists the one-page site", () => {
    expect(sitemap().map((e) => e.url)).toEqual([expect.stringMatching(/\/$/)]);
  });
});
