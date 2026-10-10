import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/http";

describe("safeNext", () => {
  it("keeps real in-site paths", () => {
    expect(safeNext("/")).toBe("/");
    expect(safeNext("/solve/custom?x=1#top")).toBe("/solve/custom?x=1#top");
    expect(safeNext("/%09/evil.com")).toBe("/%09/evil.com"); // stays a path on this site
  });
  it("falls back for anything that could leave the site", () => {
    for (const bad of [null, undefined, "", "evil.com", "https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/\u0000/evil.com", "/\u007f/x"]) {
      expect(safeNext(bad)).toBe("/");
    }
    expect(safeNext("//evil.com", "/home")).toBe("/home");
  });
  it("never resolves to another origin", () => {
    for (const s of ["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/a/../..//evil.com"]) {
      const out = safeNext(s);
      expect(new URL(out, "https://app.example.com").origin).toBe("https://app.example.com");
    }
  });
});
