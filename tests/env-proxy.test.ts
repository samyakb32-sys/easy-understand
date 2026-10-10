import { afterEach, describe, expect, it, vi } from "vitest";

const KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  vi.resetModules();
  vi.doUnmock("@supabase/ssr");
});

describe("supabaseConfigured", () => {
  it("rejects a url without a scheme", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "k";
    const { supabaseConfigured } = await import("@/lib/env");
    for (const bad of ["", "myproj.supabase.co", "foo", "localhost:54321", "ftp://x.co"]) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = bad;
      expect(supabaseConfigured()).toBe(false);
    }
    for (const good of ["https://myproj.supabase.co", "http://127.0.0.1:54321"]) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = good;
      expect(supabaseConfigured()).toBe(true);
    }
  });
});

describe("proxy", () => {
  it("does not return a 500 when Supabase throws", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://myproj.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "k";
    vi.doMock("@supabase/ssr", () => ({ createServerClient: () => { throw new Error("boom"); } }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { proxy } = await import("../proxy");
    const { NextRequest } = await import("next/server");
    const res = await proxy(new NextRequest("https://app.example.com/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("proxy with a slow Supabase", () => {
  it("lets the request through quickly instead of waiting out the SDK's retries", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://myproj.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "k";
    vi.doMock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims: () => new Promise(() => {}) } }) }));
    vi.useFakeTimers();
    try {
      const { proxy } = await import("../proxy");
      const { NextRequest } = await import("next/server");
      const pending = proxy(new NextRequest("https://app.example.com/"));
      await vi.advanceTimersByTimeAsync(3000);
      const res = await pending;
      expect(res.headers.get("x-middleware-next")).toBe("1");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("withTimeout", () => {
  it("returns the value, or the fallback on timeout or failure", async () => {
    const { withTimeout } = await import("@/lib/supabase/timeout");
    expect(await withTimeout(Promise.resolve(1), 50, 0)).toBe(1);
    expect(await withTimeout(Promise.reject(new Error("x")), 50, 0)).toBe(0);
    expect(await withTimeout(new Promise<number>(() => {}), 10, 0)).toBe(0);
  });
});
