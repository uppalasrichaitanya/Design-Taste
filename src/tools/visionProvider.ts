/**
 * Pluggable vision provider for critique_render and get_scene_guidance
 * — an interface plus three adapters (OpenAI, Anthropic, Gemini)
 * implemented with plain fetch calls, deliberately vendor-agnostic per
 * the Phase 3 decision. Phase 4 added generate(): generic text-first
 * generation with optional attached images, so non-critique flows
 * (staged scene guidance passes and gates) share the same providers
 * and the same env-driven resolution.
 *
 * Resolution order (documented in README):
 *   1. DESIGN_TASTE_VISION_PROVIDER (+ DESIGN_TASTE_VISION_API_KEY,
 *      + optional DESIGN_TASTE_VISION_MODEL) — fully explicit.
 *   2. Otherwise, the first vendor key present in the environment:
 *      OPENAI_API_KEY, then ANTHROPIC_API_KEY, then GEMINI_API_KEY or
 *      GOOGLE_API_KEY.
 *   3. Otherwise not configured — tools report a setup hint instead of
 *      guessing or faking output.
 *
 * DESIGN_TASTE_VISION_MODEL always overrides the provider default.
 */

export interface VisionImage {
  base64: string;
  mimeType: string;
}

export interface VisionCritiqueRequest {
  imageBase64: string;
  mimeType: string;
  prompt: string;
}

export interface GenerationRequest {
  prompt: string;
  /** Optional attached images (reference images, screenshots). */
  images?: VisionImage[];
  /** Output token budget; defaults to MAX_OUTPUT_TOKENS. */
  maxTokens?: number;
}

export interface VisionProvider {
  readonly name: string;
  readonly model: string;
  /** Single-image critique path used by critique_render. */
  critique(req: VisionCritiqueRequest): Promise<string>;
  /** Generic text (+ optional images) generation. */
  generate(req: GenerationRequest): Promise<string>;
}

const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  gemini: "gemini-3.6-flash",
  openrouter: "google/gemma-4-31b-it:free",
  bai: "qwen3.8-flash",
  nara: "agnes-2.5-flash",
};

/**
 * Per-provider base URLs. OpenAI-compatible providers (openrouter, bai,
 * nara) differ only in endpoint. b.ai hosts the qwen3.8-flash and
 * glm-5.3-flash models; router.bynara.id hosts agnes-2.5-flash and
 * muse-spark-1.2-contributor-free (both keyed via either BAI-style or
 * provider-specific env var names, whichever is present).
 */
const OPENAI_COMPAT_PROVIDER_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  bai: "https://api.b.ai/v1",
  nara: "https://router.bynara.id/v1",
};

/**
 * Optional OpenAI-compatible base-URL override: points any provider using
 * the OpenAI adapter (openai, openrouter, bai, nara) at a custom
 * endpoint (a private gateway, a proxy). Ignored for anthropic/gemini.
 */
const OPENAI_COMPAT_BASE_URL = process.env.DESIGN_TASTE_VISION_BASE_URL?.trim();

const REQUEST_TIMEOUT_MS = 150_000;
const MAX_OUTPUT_TOKENS = 1500;

export class VisionNotConfiguredError extends Error {
  constructor() {
    super(
      "No vision provider configured. Set DESIGN_TASTE_VISION_PROVIDER + DESIGN_TASTE_VISION_API_KEY " +
        "(+ optional DESIGN_TASTE_VISION_MODEL / DESIGN_TASTE_VISION_BASE_URL), or one of OPENAI_API_KEY / " +
        "ANTHROPIC_API_KEY / GEMINI_API_KEY / GOOGLE_API_KEY / OPENROUTER_API_KEY / BAI_API_KEY / NARA_API_KEY. " +
        "See README 'Vision providers' for the swap guide."
    );
    this.name = "VisionNotConfiguredError";
  }
}

/**
 * Resolve the vision provider from the environment. Throws a
 * descriptive error on contradictory configuration; returns via
 * VisionNotConfiguredError only when nothing is set at all.
 */
export function resolveVisionProvider(): VisionProvider {
  const explicitProvider = process.env.DESIGN_TASTE_VISION_PROVIDER?.toLowerCase().trim();
  const explicitKey = process.env.DESIGN_TASTE_VISION_API_KEY;
  const explicitModel = process.env.DESIGN_TASTE_VISION_MODEL?.trim();

  const vendorKeys: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    bai: process.env.BAI_API_KEY ?? process.env["GLM/QWEN_API_KEY"],
    nara: process.env.NARA_API_KEY ?? process.env.MUSE_SPARK_API_KEY,
  };

  let name: string;
  let apiKey: string | undefined;

  if (explicitProvider) {
    if (!(explicitProvider in vendorKeys)) {
      throw new Error(
        `Unknown DESIGN_TASTE_VISION_PROVIDER "${explicitProvider}". Supported: openai, anthropic, gemini, openrouter, bai, nara.`
      );
    }
    name = explicitProvider;
    apiKey = explicitKey ?? vendorKeys[name];
    if (!apiKey) {
      const keyHint =
        name === "gemini"
          ? "GEMINI_API_KEY / GOOGLE_API_KEY"
          : name === "bai"
            ? "BAI_API_KEY / GLM/QWEN_API_KEY"
            : name === "nara"
              ? "NARA_API_KEY / MUSE_SPARK_API_KEY"
              : name.toUpperCase() + "_API_KEY";
      throw new Error(
        `DESIGN_TASTE_VISION_PROVIDER is "${name}" but no API key is set. Provide DESIGN_TASTE_VISION_API_KEY or ${keyHint}.`
      );
    }
  } else if (explicitKey) {
    // A shared key with no provider: use whichever vendor key is also
    // present, else we cannot know which API to call.
    const inferred = Object.entries(vendorKeys).find(([, k]) => k)?.[0];
    if (!inferred) {
      throw new Error(
        "DESIGN_TASTE_VISION_API_KEY is set but DESIGN_TASTE_VISION_PROVIDER is not, and no vendor key " +
          "(OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY / GOOGLE_API_KEY / OPENROUTER_API_KEY / BAI_API_KEY / NARA_API_KEY) is present to infer the provider. Set DESIGN_TASTE_VISION_PROVIDER."
      );
    }
    name = inferred;
    apiKey = explicitKey;
  } else {
    const inferred = Object.entries(vendorKeys).find(([, k]) => k);
    if (!inferred) throw new VisionNotConfiguredError();
    name = inferred[0];
    apiKey = inferred[1];
  }

  const model = explicitModel ?? DEFAULT_MODELS[name];

  switch (name) {
    case "openai":
    case "openrouter":
    case "bai":
    case "nara": {
      // All OpenAI-compatible providers share the chat-completions shape;
      // only the base URL (and key) differs.
      const baseUrl = OPENAI_COMPAT_BASE_URL ?? OPENAI_COMPAT_PROVIDER_BASE_URLS[name];
      if (!baseUrl) throw new Error(`No base URL configured for provider "${name}".`);
      return {
        name,
        model,
        critique: (req) => generateWithOpenAI(apiKey!, model, critiqueToGeneration(req), baseUrl, name),
        generate: (req) => generateWithOpenAI(apiKey!, model, req, baseUrl, name),
      };
    }
    case "anthropic":
      return {
        name: "anthropic",
        model,
        critique: (req) => generateWithAnthropic(apiKey!, model, critiqueToGeneration(req)),
        generate: (req) => generateWithAnthropic(apiKey!, model, req),
      };
    case "gemini":
      return {
        name: "gemini",
        model,
        critique: (req) => generateWithGemini(apiKey!, model, critiqueToGeneration(req)),
        generate: (req) => generateWithGemini(apiKey!, model, req),
      };
    default:
      throw new Error(`Unhandled vision provider "${name}".`);
  }
}

function critiqueToGeneration(req: VisionCritiqueRequest): GenerationRequest {
  return {
    prompt: req.prompt,
    images: [{ base64: req.imageBase64, mimeType: req.mimeType }],
  };
}

/** HTTP statuses that are transient server-side; one retry is warranted. */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
/** Rate-limit windows need longer to roll than a transient 5xx. */
const RETRY_DELAY_MS = 8_000;
const RATE_LIMIT_RETRY_DELAY_MS = 30_000;

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  providerLabel: string
): Promise<unknown> {
  const attempt = async (): Promise<Response> =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

  let res = await attempt();
  if (RETRYABLE_STATUS.has(res.status)) {
    await new Promise((r) => setTimeout(r, res.status === 429 ? RATE_LIMIT_RETRY_DELAY_MS : RETRY_DELAY_MS));
    res = await attempt();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `${providerLabel} vision request failed: HTTP ${res.status} ${text.slice(0, 400)}`
    );
  }
  return res.json();
}

async function generateWithOpenAI(
  apiKey: string,
  model: string,
  req: GenerationRequest,
  baseUrl: string,
  providerName: string
): Promise<string> {
  const content: Record<string, unknown>[] = [{ type: "text", text: req.prompt }];
  for (const img of req.images ?? []) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
    });
  }
  const data = (await postJson(
    `${baseUrl}/chat/completions`,
    { authorization: `Bearer ${apiKey}` },
    {
      model,
      max_tokens: req.maxTokens ?? MAX_OUTPUT_TOKENS,
      messages: [{ role: "user", content }],
    },
    providerName
  )) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${providerName} vision response contained no message content.`);
  return text;
}

async function generateWithAnthropic(
  apiKey: string,
  model: string,
  req: GenerationRequest
): Promise<string> {
  const content: Record<string, unknown>[] = [{ type: "text", text: req.prompt }];
  for (const img of req.images ?? []) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: img.mimeType, data: img.base64 },
    });
  }
  const data = (await postJson(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    {
      model,
      max_tokens: req.maxTokens ?? MAX_OUTPUT_TOKENS,
      messages: [{ role: "user", content }],
    },
    "Anthropic"
  )) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content?.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Anthropic vision response contained no text block.");
  return text;
}

async function generateWithGemini(
  apiKey: string,
  model: string,
  req: GenerationRequest
): Promise<string> {
  const parts: Record<string, unknown>[] = [{ text: req.prompt }];
  for (const img of req.images ?? []) {
    parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } });
  }
  const data = (await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { "x-goog-api-key": apiKey },
    { contents: [{ parts }] },
    "Gemini"
  )) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini vision response contained no candidate text.");
  return text;
}
