import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Which AI reads the student's question. The model only classifies the problem and reads its numbers into JSON; the
 * drawing itself always comes from the deterministic solvers, so any capable vision model can do this job.
 *
 *   AI_PROVIDER=anthropic (default)  ANTHROPIC_API_KEY, optional ANTHROPIC_MODEL
 *   AI_PROVIDER=nvidia | gemini | openrouter | groq | together   AI_API_KEY + AI_MODEL (base URL is known)
 *   AI_PROVIDER=openai-compatible    AI_BASE_URL + AI_MODEL (+ AI_API_KEY if the server needs one):
 *                                    any server speaking the OpenAI chat-completions API, e.g. your own vLLM or Ollama
 *
 * Pick a model that accepts images, or photo uploads will fail; typed questions work with text-only models.
 */
export type ProviderConfig =
  | { kind: "anthropic"; label: string; model: string; apiKey: string }
  | { kind: "openai"; label: string; model: string; baseUrl: string; apiKey?: string };

export const PRESETS: Record<string, { label: string; baseUrl: string }> = {
  nvidia: { label: "NVIDIA", baseUrl: "https://integrate.api.nvidia.com/v1" },
  gemini: { label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  groq: { label: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
  together: { label: "Together AI", baseUrl: "https://api.together.xyz/v1" },
};

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

/** The configured provider, or null when solving is switched off (no key / incomplete settings). */
export function providerConfig(env: Record<string, string | undefined> = process.env): ProviderConfig | null {
  const name = (env.AI_PROVIDER ?? "anthropic").trim().toLowerCase();
  if (name === "anthropic" || name === "claude") {
    if (!env.ANTHROPIC_API_KEY) return null;
    return { kind: "anthropic", label: "Anthropic", model: env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL, apiKey: env.ANTHROPIC_API_KEY };
  }
  const model = env.AI_MODEL?.trim();
  if (!model) return null;
  if (name === "openai-compatible" || name === "custom" || name === "self-hosted") {
    const baseUrl = env.AI_BASE_URL?.trim();
    if (!baseUrl) return null;
    return { kind: "openai", label: env.AI_PROVIDER_LABEL || "our AI provider", model, baseUrl: baseUrl.replace(/\/+$/, ""), apiKey: env.AI_API_KEY || undefined };
  }
  const preset = PRESETS[name];
  if (!preset || !env.AI_API_KEY) return null;
  return { kind: "openai", label: preset.label, model, baseUrl: (env.AI_BASE_URL?.trim() || preset.baseUrl).replace(/\/+$/, ""), apiKey: env.AI_API_KEY };
}

/** Why a call failed, in terms the route can act on (refund, message, status code). */
export class ProviderError extends Error {
  constructor(public kind: "rate_limit" | "auth" | "timeout" | "outage", message: string) {
    super(message);
  }
}

export type AskInput = { system: string; image?: string; mediaType: string; text?: string; signal: AbortSignal };

/** Sends the question to the configured model and returns its raw text answer. Throws ProviderError for provider trouble. */
export async function askModel(cfg: ProviderConfig, input: AskInput): Promise<string> {
  return cfg.kind === "anthropic" ? askAnthropic(cfg, input) : askOpenAICompatible(cfg, input);
}

const userText = (text?: string) => (text?.trim() ? `Problem text: ${text.trim()}` : "Classify the problem in this image.");

async function askAnthropic(cfg: Extract<ProviderConfig, { kind: "anthropic" }>, { system, image, mediaType, text, signal }: AskInput): Promise<string> {
  const content: Anthropic.ContentBlockParam[] = [];
  if (image) content.push({ type: "image", source: { type: "base64", media_type: mediaType as "image/jpeg", data: image } });
  content.push({ type: "text", text: userText(text) });
  const client = new Anthropic({ apiKey: cfg.apiKey, maxRetries: 1 });
  try {
    const response = await client.beta.messages.create({
      model: cfg.model,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
    }, { signal });
    return response.content.find((b) => b.type === "text")?.text ?? "";
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new ProviderError("rate_limit", e.message);
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new ProviderError("auth", e.message);
    if (e instanceof Anthropic.APIUserAbortError || e instanceof Anthropic.APIConnectionTimeoutError) throw new ProviderError("timeout", e.message);
    if (e instanceof Anthropic.APIError) throw new ProviderError("outage", e.message);
    throw e;
  }
}

async function askOpenAICompatible(cfg: Extract<ProviderConfig, { kind: "openai" }>, { system, image, mediaType, text, signal }: AskInput): Promise<string> {
  const content: unknown[] = [{ type: "text", text: userText(text) }];
  if (image) content.push({ type: "image_url", image_url: { url: `data:${mediaType};base64,${image}` } });
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}) },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 2000,
        temperature: 0,
        messages: [{ role: "system", content: system }, { role: "user", content }],
      }),
    });
  } catch (e) {
    if (signal.aborted || (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError"))) throw new ProviderError("timeout", "timed out");
    throw new ProviderError("outage", e instanceof Error ? e.message : "network error");
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    if (res.status === 429) throw new ProviderError("rate_limit", detail);
    if (res.status === 401 || res.status === 403) throw new ProviderError("auth", detail);
    throw new ProviderError("outage", `${res.status} ${detail}`);
  }
  const data = (await res.json().catch(() => null)) as { choices?: { message?: { content?: unknown } }[] } | null;
  const msg = data?.choices?.[0]?.message?.content;
  // most servers send a string; some send content parts
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg)) return msg.map((p) => (p && typeof p === "object" && "text" in p ? String((p as { text: unknown }).text) : "")).join("");
  return "";
}

/** The JSON object in a model's answer: drops "thinking" blocks and any prose or code fence around it. Throws SyntaxError if there is none. */
export function extractJson(raw: string): unknown {
  const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new SyntaxError("no JSON object in the answer");
  return JSON.parse(text.slice(start, end + 1));
}
