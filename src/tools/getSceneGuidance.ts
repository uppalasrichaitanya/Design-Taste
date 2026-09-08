/**
 * get_scene_guidance — spatial/3D taste for Three.js/WebGL work.
 *
 * Three staged passes (composition → lighting → material/detail) with a
 * text-gated review between passes (settled Phase 4 decision): the same
 * provider reviews the accumulated draft against each pass's gate
 * criteria, and a failed gate triggers one self-correct revision before
 * proceeding. The staged-pass-with-gate pattern is adapted from
 * hoainho/img2threejs (MIT); pass content and criteria are our own.
 *
 * Reference image: optional; when provided (base64 or data-URI) it is
 * attached to every generating pass. URL references are a later
 * refinement — the tool says so explicitly rather than guessing.
 *
 * Honesty rules: no fabricated guidance. Without a configured provider
 * the tool returns a setup hint with null fields. Gate verdicts, gaps,
 * and self-corrections are all recorded in the visible gates trail.
 */

import { z } from "zod";
import {
  SCENE_PASSES,
  GATE_INSTRUCTION,
  SELF_CORRECT_INSTRUCTION,
  isPlausibleThreeJsPropertyName,
  type ScenePass,
} from "../config/sceneGuidance.js";
import {
  resolveVisionProvider,
  VisionNotConfiguredError,
  type VisionProvider,
  type VisionImage,
  type GenerationRequest,
} from "./visionProvider.js";

export const GetSceneGuidanceInput = z
  .object({
    context: z.string().min(1),
    /** Optional reference image: raw base64 or a data-URI. URLs are a later refinement. */
    referenceImage: z.string().optional(),
  })
  .strict();

export type GetSceneGuidanceArgs = z.infer<typeof GetSceneGuidanceInput>;

export interface SceneGateEntry {
  passId: string;
  title: string;
  passed: boolean | null;
  gaps: string[];
  selfCorrected: boolean;
  gateError?: string;
}

// Type alias (not interface): the MCP SDK's structuredContent requires an
// implicit index signature, which TS only grants to object type aliases.
export type SceneGuidanceResult = {
  camera: Record<string, unknown> | null;
  lighting: Record<string, unknown> | null;
  materials: Record<string, unknown>[] | null;
  pacingNotes: string | null;
  gates: SceneGateEntry[];
  provider: string | null;
  model: string | null;
  error?: string;
};

const PASS_MAX_TOKENS = 2000;
const GATE_MAX_TOKENS = 600;

interface DecidedPass {
  pass: ScenePass;
  data: Record<string, unknown>;
}

export async function getSceneGuidance(args: GetSceneGuidanceArgs): Promise<SceneGuidanceResult> {
  let provider: VisionProvider;
  try {
    provider = resolveVisionProvider();
  } catch (err) {
    if (err instanceof VisionNotConfiguredError) {
      return {
        camera: null,
        lighting: null,
        materials: null,
        pacingNotes: null,
        gates: [],
        provider: null,
        model: null,
        error: err.message,
      };
    }
    throw err;
  }

  const refImage = parseReferenceImage(args.referenceImage);
  const brief = args.context.trim();

  const decided: DecidedPass[] = [];
  const gates: SceneGateEntry[] = [];

  try {
    for (const pass of SCENE_PASSES) {
      let draft = await generatePass(provider, pass, brief, decided, refImage);
      let entry: SceneGateEntry = {
        passId: pass.id,
        title: pass.title,
        passed: null,
        gaps: [],
        selfCorrected: false,
      };

      const structuralGaps = structuralGapsFor(pass, draft);
      const review = await gatePass(provider, pass, brief, decided, draft);

      if ("gateError" in review) {
        // Reviewer could not produce a verdict; record honestly, keep draft.
        entry.gateError = review.gateError;
        entry.gaps = structuralGaps;
        gates.push(entry);
        decided.push({ pass, data: draft });
        continue;
      }

      const combinedGaps = [...structuralGaps, ...review.gaps];
      const passedFirstGate = review.pass && structuralGaps.length === 0;

      if (passedFirstGate) {
        entry.passed = true;
        entry.gaps = [];
        gates.push(entry);
        decided.push({ pass, data: draft });
        continue;
      }

      // Failed gate: one self-correct revision, then one re-gate.
      entry.gaps = combinedGaps;
      entry.selfCorrected = true;
      try {
        const corrected = await selfCorrectPass(provider, pass, brief, decided, draft, combinedGaps);
        const redoStructural = structuralGapsFor(pass, corrected);
        const redoReview = await gatePass(provider, pass, brief, decided, corrected);
        if ("gateError" in redoReview) {
          entry.gateError = redoReview.gateError;
          entry.passed = null;
        } else {
          entry.passed = redoReview.pass && redoStructural.length === 0;
        }
        draft = corrected;
      } catch (correctErr) {
        entry.gateError =
          `self-correct failed (${correctErr instanceof Error ? correctErr.message : String(correctErr)}); kept the original draft`;
      }
      gates.push(entry);
      decided.push({ pass, data: draft });
    }
  } catch (err) {
    return {
      camera: null,
      lighting: null,
      materials: null,
      pacingNotes: null,
      gates,
      provider: provider.name,
      model: provider.model,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const materialData = decided[2].data;
  const materialsRaw = materialData.materials;
  const materials = Array.isArray(materialsRaw) && materialsRaw.length > 0
    ? materialsRaw.filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === "object")
    : null;
  const pacingNotes = typeof materialData.pacingNotes === "string" ? materialData.pacingNotes : null;

  const result: SceneGuidanceResult = {
    camera: decided[0].data,
    lighting: decided[1].data,
    materials,
    pacingNotes,
    gates,
    provider: provider.name,
    model: provider.model,
  };
  if (materials === null || pacingNotes === null) {
    result.error =
      "material pass completed but its materials/pacingNotes fields were missing or malformed; " +
      "check the gates trail and re-run with a more specific brief if needed";
  }
  return result;
}

function parseReferenceImage(input: string | undefined): VisionImage | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    throw new Error(
      "referenceImage URLs are a later refinement; pass base64 image data (optionally as a data-URI) for now"
    );
  }
  const dataUri = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
  if (dataUri) return { mimeType: dataUri[1], base64: dataUri[2] };
  return { mimeType: "image/png", base64: trimmed };
}

function missingContractKeys(pass: ScenePass, draft: Record<string, unknown>): string[] {
  return Object.keys(pass.contract).filter((k) => {
    const v = draft[k];
    return v === undefined || v === null || v === "";
  }).map((k) => `contract field "${k}" is missing or empty`);
}

/**
 * Deterministic extras validation: material entries' extras strings must
 * only name real Three.js material properties (see the known-good list in
 * sceneGuidance.ts). Fabricated property names — confident-sounding but
 * nonexistent, like v1.0.0's `metalnessReflectivity` — become structural
 * gaps and flow into self-correct like any other contract violation.
 * Prose inside extras is allowed after the parameters; the check only
 * judges the `name=value` tokens.
 */
export function fabricatedPropertyGaps(draft: Record<string, unknown>): string[] {
  const materials = draft.materials;
  if (!Array.isArray(materials)) return [];
  const gaps: string[] = [];
  for (const entry of materials) {
    if (!entry || typeof entry !== "object") continue;
    const extras = (entry as Record<string, unknown>).extras;
    if (typeof extras !== "string" || extras.trim() === "" || /^n\/a/i.test(extras.trim())) continue;
    const tokens = extras.split(/[,;]\s*/);
    for (const token of tokens) {
      const nameMatch = token.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|:|\s)\s*/);
      if (!nameMatch) continue;
      const name = nameMatch[1];
      if (!isPlausibleThreeJsPropertyName(name)) {
        gaps.push(
          `materials extras token "${token.trim()}" names "${name}", which is not a real Three.js material property; replace it with a real property or drop the token`
        );
      }
    }
  }
  return gaps;
}

/**
 * All deterministic (non-model) gap checks for a pass draft: contract
 * completeness plus fabricated-Three.js-property detection for the
 * material pass. Used for both the first gate and the post-self-correct
 * re-gate.
 */
function structuralGapsFor(pass: ScenePass, draft: Record<string, unknown>): string[] {
  return [...missingContractKeys(pass, draft), ...fabricatedPropertyGaps(draft)];
}

/**
 * Normalize model output strings before they are used: U+2212 (true
 * minus) and U+2213 (minus-or-plus) → ASCII '-' so numeric strings like
 * "[−2.2, 0.6, 3.4]" parseFloat cleanly without callers pre-processing.
 * Applied to every string field in pass drafts.
 */
function normalizeDraftStrings(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/[\u2212\u2213]/g, "-");
  }
  if (Array.isArray(value)) return value.map(normalizeDraftStrings);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeDraftStrings(v);
    return out;
  }
  return value;
}

function priorPassesBlock(decided: DecidedPass[]): string {
  if (decided.length === 0) return "";
  return (
    "ALREADY DECIDED in earlier passes (fixed; do not contradict):\n\n" +
    decided
      .map((d) => `--- ${d.pass.title} ---\n${JSON.stringify(d.data, null, 2)}`)
      .join("\n\n")
  );
}

async function generatePass(
  provider: VisionProvider,
  pass: ScenePass,
  brief: string,
  decided: DecidedPass[],
  refImage: VisionImage | undefined
): Promise<Record<string, unknown>> {
  const prompt = [
    pass.instruction,
    "",
    `SCENE BRIEF: ${brief}`,
    ...(refImage
      ? ["(A reference image is attached; honor its look wherever the brief is silent.)"]
      : []),
    ...(priorPassesBlock(decided) ? ["", priorPassesBlock(decided)] : []),
    "",
    "VOCABULARY ANCHORS (use these or something sharper; reject vague equivalents):",
    pass.vocabulary.map((v) => `- ${v}`).join("\n"),
    "",
    "Respond with ONLY a JSON object with exactly these keys, each satisfying its description:",
    JSON.stringify(pass.contract, null, 2),
    "Numbers where numbers are asked for. No extra keys, no markdown fences, no prose.",
  ].join("\n");

  return callForJson(provider, { prompt, images: refImage ? [refImage] : undefined, maxTokens: PASS_MAX_TOKENS }, "pass draft");
}

interface GateVerdict {
  pass: boolean;
  gaps: string[];
}

async function gatePass(
  provider: VisionProvider,
  pass: ScenePass,
  brief: string,
  decided: DecidedPass[],
  draft: Record<string, unknown>
): Promise<GateVerdict | { gateError: string }> {
  const accumulated: Record<string, unknown> = {};
  for (const d of decided) accumulated[d.pass.id] = d.data;
  accumulated[pass.id] = draft;

  const prompt = [
    GATE_INSTRUCTION,
    "",
    `SCENE BRIEF (the contract the draft must ultimately serve): ${brief}`,
    `PASS UNDER REVIEW: ${pass.title}`,
    "CRITERIA (every one must be met; be strict about vagueness):",
    pass.gateCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n"),
    "",
    "FULL DRAFT SO FAR:",
    JSON.stringify(accumulated, null, 2),
    "",
    'Respond with ONLY: {"pass": true|false, "gaps": ["<specific unmet thing>", ...]}',
    "gaps must contain only unmet criteria as short factual statements — no deliberation, no retracted items, no reasoning trace.",
  ].join("\n");

  try {
    const parsed = await callForJson(
      provider,
      { prompt, maxTokens: GATE_MAX_TOKENS },
      "gate verdict"
    );
    const pass_ = parsed.pass === true;
    const gaps = Array.isArray(parsed.gaps)
      ? parsed.gaps.filter((g): g is string => typeof g === "string" && g.length > 0)
      : [];
    return { pass: pass_, gaps };
  } catch (err) {
    return {
      gateError: `gate could not produce a verdict (${err instanceof Error ? err.message : String(err)})`,
    };
  }
}

async function selfCorrectPass(
  provider: VisionProvider,
  pass: ScenePass,
  brief: string,
  decided: DecidedPass[],
  draft: Record<string, unknown>,
  gaps: string[]
): Promise<Record<string, unknown>> {
  const prompt = [
    SELF_CORRECT_INSTRUCTION,
    "",
    `SCENE BRIEF: ${brief}`,
    ...(priorPassesBlock(decided) ? [priorPassesBlock(decided), ""] : []),
    `PASS: ${pass.title}`,
    "CONTRACT:",
    JSON.stringify(pass.contract, null, 2),
    "YOUR PREVIOUS DRAFT:",
    JSON.stringify(draft, null, 2),
    "REVIEWER GAPS TO FIX:",
    gaps.map((g) => `- ${g}`).join("\n"),
    "",
    "Respond with ONLY the corrected JSON object for this pass, no prose.",
  ].join("\n");

  return callForJson(
    provider,
    { prompt, images: undefined, maxTokens: PASS_MAX_TOKENS },
    "self-corrected pass draft"
  );
}

/**
 * Generate + strict JSON parse, with one formatting retry. The retry only
 * corrects JSON formatting; it never fabricates content.
 */
async function callForJson(
  provider: VisionProvider,
  req: GenerationRequest,
  label: string
): Promise<Record<string, unknown>> {
  let raw = await provider.generate(req);
  let parsed = tryParseJson(raw);
  if (parsed !== null) return parsed;

  raw = await provider.generate({
    ...req,
    prompt: req.prompt + "\n\nIMPORTANT: your previous response was not valid JSON. Return ONLY the JSON object, no fences, no prose.",
  });
  parsed = tryParseJson(raw);
  if (parsed !== null) return parsed;

  throw new Error(`${label}: model response was not valid JSON after one retry`);
}

function tryParseJson(raw: string): Record<string, unknown> | null {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "");
  }
  try {
    const data: unknown = JSON.parse(text);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      // Normalize U+2212/U+2213 to ASCII '-' in every string before the
      // draft is gated or returned (v1.0.1 fix: numeric vector strings
      // must parseFloat without caller-side pre-processing).
      return normalizeDraftStrings(data) as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
