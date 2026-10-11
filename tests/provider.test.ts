import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askModel, extractJson, providerConfig, ProviderError } from "@/lib/solver/provider";

describe("providerConfig", () => {
  it("defaults to Anthropic and is off without a key", () => {
    expect(providerConfig({})).toBeNull();
    expect(providerConfig({ ANTHROPIC_API_KEY: "k" })).toMatchObject({ kind: "anthropic", model: "claude-opus-5-5" });
    expect(providerConfig({ ANTHROPIC_API_KEY: "k", ANTHROPIC_MODEL: "claude-sonnet-5-5" })).toMatchObject({ model: "claude-sonnet-5-5" });
  });
  it("knows the base URL of the hosted presets and needs a key and a model", () => {
    expect(providerConfig({ AI_PROVIDER: "nvidia", AI_API_KEY: "k", AI_MODEL: "m" })).toEqual({ kind: "openai", label: "NVIDIA", model: "m", baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: "k" });
    expect(providerConfig({ AI_PROVIDER: "Gemini", AI_API_KEY: "k", AI_MODEL: "m" })).toMatchObject({ baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" });
    expect(providerConfig({ AI_PROVIDER: "nvidia", AI_MODEL: "m" })).toBeNull();
    expect(providerConfig({ AI_PROVIDER: "nvidia", AI_API_KEY: "k" })).toBeNull();
    expect(providerConfig({ AI_PROVIDER: "nope", AI_API_KEY: "k", AI_MODEL: "m" })).toBeNull();
  });
  it("takes any OpenAI-compatible server, with or without a key", () => {
    expect(providerConfig({ AI_PROVIDER: "openai-compatible", AI_BASE_URL: "https://gpu.example.com/v1/", AI_MODEL: "qwen" })).toMatchObject({ kind: "openai", baseUrl: "https://gpu.example.com/v1", apiKey: undefined });
    expect(providerConfig({ AI_PROVIDER: "openai-compatible", AI_MODEL: "qwen" })).toBeNull();
  });
});

describe("extractJson", () => {
  it("finds the object in prose, fences and thinking blocks", () => {
    expect(extractJson('```json\n{"template":"pentagon","side":30}\n```')).toEqual({ template: "pentagon", side: 30 });
    expect(extractJson('<think>maybe {"a":1}? no</think>{"template":"pentagon","side":30}')).toEqual({ template: "pentagon", side: 30 });
    expect(() => extractJson("no idea")).toThrow(SyntaxError);
  });
});

describe("askModel over the OpenAI-compatible API", () => {
  const cfg = { kind: "openai" as const, label: "Test", model: "m", baseUrl: "https://ai.example.com/v1", apiKey: "secret" };
  const input = (image?: string) => ({ system: "SYS", image, mediaType: "image/jpeg", text: "a line 60 mm", signal: new AbortController().signal });
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
  afterEach(() => vi.unstubAllGlobals());

  it("sends the system prompt, the text and the photo, and returns the answer", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"template":"pentagon","side":30}' } }] }), { status: 200 }));
    expect(await askModel(cfg, input("QUJD"))).toBe('{"template":"pentagon","side":30}');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ai.example.com/v1/chat/completions");
    expect(init.headers.authorization).toBe("Bearer secret");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("m");
    expect(body.messages[0]).toEqual({ role: "system", content: "SYS" });
    expect(body.messages[1].content).toEqual([{ type: "text", text: "Problem text: a line 60 mm" }, { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } }]);
  });

  it("joins content parts", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: [{ type: "text", text: "{\"a\":" }, { type: "text", text: "1}" }] } }] }), { status: 200 }));
    expect(await askModel(cfg, input())).toBe('{"a":1}');
  });

  it("maps provider errors so the route can refund and explain", async () => {
    for (const [status, kind] of [[429, "rate_limit"], [401, "auth"], [403, "auth"], [400, "outage"], [503, "outage"]] as const) {
      fetchMock.mockResolvedValueOnce(new Response("nope", { status }));
      await expect(askModel(cfg, input())).rejects.toMatchObject({ kind });
    }
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("t"), { name: "TimeoutError" }));
    await expect(askModel(cfg, input())).rejects.toBeInstanceOf(ProviderError);
  });
});
