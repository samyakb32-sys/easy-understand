import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  insert: { data: { id: "L1" } as { id: string } | null, error: null as unknown },
  user: vi.fn(),
  pro: false,
}));

vi.mock("@/lib/env", () => ({ solverNeedsLogin: () => true, serviceRoleConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ currentUser: () => h.user() }));
vi.mock("@/lib/me", () => ({ loadEntitlements: async () => ({ isPro: h.pro, dailyLimit: 3 }) }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: h.rpc,
    from: () => ({ insert: () => ({ select: () => ({ single: async () => h.insert }) }) }),
  }),
}));

import { POST } from "@/app/api/solve/route";

const reply = (text: string) =>
  new Response(JSON.stringify({ id: "m", type: "message", role: "assistant", model: "x", content: [{ type: "text", text }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { "content-type": "application/json" } });

const call = () =>
  POST(new Request("https://app.example.com/api/solve", {
    method: "POST",
    headers: { origin: "https://app.example.com", "x-forwarded-host": "app.example.com", "content-type": "application/json" },
    body: JSON.stringify({ text: "hello" }),
  }));

const rpcNames = () => h.rpc.mock.calls.map((c) => c[0]);
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test";
  h.pro = false;
  h.insert = { data: { id: "L1" }, error: null };
  h.user.mockResolvedValue({ id: "u1" });
  h.rpc.mockReset();
  h.rpc.mockImplementation(async (name: string) => ({ data: name === "consume_solve" || name === "refund_miss" ? true : null, error: null }));
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/solve refunds", () => {
  it("an 'unsupported' answer only gets the solve back through the limited miss allowance", async () => {
    fetchMock.mockResolvedValue(reply('{"template":"unsupported","reason":"not EGD"}'));
    const res = await call();
    expect(res.status).toBe(422);
    expect(rpcNames()).toEqual(["consume_solve", "refund_miss"]);
    expect(h.rpc).toHaveBeenCalledWith("refund_miss", { p_user: "u1", p_max: 5 });
    expect((await res.json()).reason).toBe("not EGD");
  });

  it("tells the student when the miss allowance is used up and the solve stays spent", async () => {
    h.rpc.mockImplementation(async (name: string) => ({ data: name === "consume_solve" ? true : false, error: null }));
    fetchMock.mockResolvedValue(reply('{"template":"unsupported","reason":"not EGD"}'));
    const body = await (await call()).json();
    expect(body.reason).toContain("not EGD");
    expect(body.reason).toContain("used one of today's solves");
    expect(rpcNames()).not.toContain("refund_solve");
  });

  it("a reply that is not JSON (prompt injection) is a miss, not a free retry", async () => {
    fetchMock.mockResolvedValue(reply("hello there"));
    const res = await call();
    expect(res.status).toBe(502);
    expect(rpcNames()).toEqual(["consume_solve", "refund_miss"]);
  });

  it("a solver rejection is a miss", async () => {
    fetchMock.mockResolvedValue(reply('{"template":"section_round","solid":"cylinder","diameter":40,"height":60,"angle":60,"axisHeight":30,"axisOffset":25}'));
    const res = await call();
    expect(res.status).toBe(422);
    expect(rpcNames()).toEqual(["consume_solve", "refund_miss"]);
    expect((await res.json()).reason).toMatch(/outside the solid/);
  });

  it("an Anthropic error is refunded in full", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "bad image" } }), { status: 400, headers: { "content-type": "application/json" } }));
    const res = await call();
    expect(res.status).toBe(500);
    expect(rpcNames()).toEqual(["consume_solve", "refund_solve"]);
  });

  it("a model call that hits our deadline answers in JSON and refunds in full", async () => {
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort());
    const res = await call();
    expect(res.status).toBe(504);
    expect((await res.json()).ok).toBe(false);
    expect(rpcNames()).toEqual(["consume_solve", "refund_solve"]);
  });

  it("caches the system prompt and bounds the call", async () => {
    fetchMock.mockResolvedValue(reply('{"template":"pentagon","side":30}'));
    await call();
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(sent.system[0].text).toContain("Engineering Graphics");
  });
});

describe("POST /api/solve robustness", () => {
  it("answers in JSON when the account lookup throws", async () => {
    h.user.mockRejectedValue(new Error("db down"));
    const res = await call();
    expect(res.status).toBe(500);
    expect((await res.json()).ok).toBe(false);
    expect(rpcNames()).toEqual([]);
  });

  it("tells the client when a Pro lesson could not be saved, and logs why", async () => {
    h.pro = true;
    h.insert = { data: null, error: { message: "relation lessons does not exist" } };
    fetchMock.mockResolvedValue(reply('{"template":"pentagon","side":30}'));
    const res = await call();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.saved).toBe(false);
    expect(body.savedId).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("reports saved for a Pro lesson that was kept", async () => {
    h.pro = true;
    fetchMock.mockResolvedValue(reply('{"template":"pentagon","side":30}'));
    const body = await (await call()).json();
    expect(body.saved).toBe(true);
    expect(body.savedId).toBe("L1");
  });
});
