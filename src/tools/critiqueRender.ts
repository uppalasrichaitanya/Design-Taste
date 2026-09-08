/**
 * critique_render — Playwright renders the target HTML, captures a
 * screenshot, and a vision-capable model scores it against the rubric
 * fields (spacing, contrast, hierarchy), per the staged render-critique
 * pattern adapted from hoainho/img2threejs (generate → render → vision
 * review). The vision pass is a pluggable provider (visionProvider.ts).
 *
 * Honesty rules: no fabricated scores. If no provider is configured,
 * the tool returns a setup hint. If the vision response won't parse, the
 * raw response is returned in an error field. If the vision pass finds
 * nothing wrong, findings come back empty.
 */

import { z } from "zod";
import { chromium } from "playwright";
import { RubricInput } from "./getDesignConstraints.js";
import { resolveVisionProvider, VisionNotConfiguredError } from "./visionProvider.js";

export const CritiqueRenderInput = z
  .object({
    /** Full HTML document to render. */
    html: z.string().min(1),
    /** Rubric — forward the output of get_design_constraints. */
    rubric: RubricInput,
    /** Viewport width (default 1280). */
    width: z.number().int().min(320).max(3840).optional(),
    /** Viewport height (default 800). */
    height: z.number().int().min(240).max(2160).optional(),
  })
  .strict();

export type CritiqueRenderArgs = z.infer<typeof CritiqueRenderInput>;

export interface CritiqueFinding {
  issue: string;
  severity: string;
  suggestion: string;
  rubricField?: string;
}

// Type alias (not interface): the MCP SDK's structuredContent requires an
// implicit index signature, which TS only grants to object type aliases.
export type CritiqueResult = {
  score: number | null;
  provider: string | null;
  model: string | null;
  findings: CritiqueFinding[];
  error?: string;
  rawResponse?: string;
};

const RENDER_TIMEOUT_MS = 15_000;

export async function critiqueRender(args: CritiqueRenderArgs): Promise<CritiqueResult> {
  // Vision check first: if not configured, report the setup hint without
  // burning a render (fail fast, honest result).
  let provider;
  try {
    provider = resolveVisionProvider();
  } catch (err) {
    if (err instanceof VisionNotConfiguredError) {
      return {
        score: null,
        provider: null,
        model: null,
        findings: [],
        error: err.message,
      };
    }
    throw err;
  }

  const { base64, mimeType } = await renderScreenshot(
    args.html,
    args.width ?? 1280,
    args.height ?? 800
  );

  const prompt = buildPrompt(args.rubric);

  let raw: string;
  try {
    raw = await provider.critique({ imageBase64: base64, mimeType, prompt });
  } catch (err) {
    return {
      score: null,
      provider: provider.name,
      model: provider.model,
      findings: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const parsed = parseCritiqueResponse(raw);
  return {
    score: parsed.score,
    provider: provider.name,
    model: provider.model,
    findings: parsed.findings,
    ...(parsed.error ? { error: parsed.error, rawResponse: raw } : {}),
  };
}

async function renderScreenshot(
  html: string,
  width: number,
  height: number
): Promise<{ base64: string; mimeType: string }> {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(html, { waitUntil: "networkidle", timeout: RENDER_TIMEOUT_MS });
    const buf = await page.screenshot({ type: "png", fullPage: false });
    return { base64: buf.toString("base64"), mimeType: "image/png" };
  } finally {
    await browser?.close();
  }
}

/**
 * The critique prompt anchors the vision pass to the rubric fields, so
 * the output is checkable structure, not free-floating opinion.
 */
function buildPrompt(rubric: Record<string, unknown>): string {
  const r = JSON.stringify(rubric, null, 2);
  return [
    "You are critiquing a rendered web page screenshot against a design rubric.",
    "Score the page 0-10 on how well it satisfies the rubric, and list concrete findings.",
    "",
    "RUBRIC:",
    r,
    "",
    "Respond with ONLY a JSON object in this exact shape, no markdown fences, no prose:",
    '{"score": <number 0-10>, "findings": [{"issue": "<specific visual issue>", "severity": "error"|"warning"|"minor", "suggestion": "<concrete fix>", "rubricField": "<rubric field this relates to, e.g. maxAccentColors or contrastMinimum>"}]}',
    "",
    "Rules:",
    "- Tie every finding to a specific visual element you can see (name it, e.g. 'the three buttons row').",
    "- Tie every finding to a rubric field where one applies (spacingScale, maxFontWeights, maxFontFamilies, maxAccentColors, contrastMinimum, motion durations if visible artifacts exist).",
    "- If the page satisfies a rubric field, do not invent a finding for it.",
    "- If the page genuinely has no issues, return score 10 and an empty findings array.",
    "- Be specific: 'the hero heading overlaps the CTA button' not 'layout feels off'.",
  ].join("\n");
}

function parseCritiqueResponse(raw: string): {
  score: number | null;
  findings: CritiqueFinding[];
  error?: string;
} {
  let text = raw.trim();
  // Strip accidental markdown fences if the model added them.
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "");
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      score: null,
      findings: [],
      error: "Vision response was not parseable JSON (see rawResponse).",
    };
  }

  const obj = data as { score?: unknown; findings?: unknown };
  const score =
    typeof obj.score === "number" && Number.isFinite(obj.score)
      ? Math.max(0, Math.min(10, obj.score))
      : null;

  const findings: CritiqueFinding[] = Array.isArray(obj.findings)
    ? (obj.findings as unknown[])
        .map((f) => f as Record<string, unknown>)
        .filter(
          (f): f is Record<string, string> =>
            typeof f.issue === "string" &&
            typeof f.suggestion === "string" &&
            f.issue.length > 0
        )
        .map((f) => ({
          issue: f.issue,
          severity: typeof f.severity === "string" ? f.severity : "warning",
          suggestion: f.suggestion,
          ...(typeof f.rubricField === "string" ? { rubricField: f.rubricField } : {}),
        }))
    : [];

  return { score, findings };
}
