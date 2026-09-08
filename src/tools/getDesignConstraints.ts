import { z } from "zod";
import { RUBRIC_PROFILES, type Rubric } from "../config/rubric.js";

export const GetDesignConstraintsInput = z
  .object({
    context: z.enum(["marketing", "dashboard", "portfolio", "form"]),
    variance: z.number().int().min(1).max(10).optional(),
    motion: z.number().int().min(1).max(10).optional(),
    density: z.number().int().min(1).max(10).optional(),
  })
  .strict();

export type GetDesignConstraintsArgs = z.infer<typeof GetDesignConstraintsInput>;

/**
 * The rubric object — the output shape of get_design_constraints. Kept
 * loose (partial-friendly, passthrough) so callers can forward a rubric
 * they received earlier without field-level coupling breaking the call.
 */
export const RubricInput = z
  .object({
    context: z.string().optional(),
    dials: z
      .object({
        variance: z.number().optional(),
        motion: z.number().optional(),
        density: z.number().optional(),
      })
      .partial()
      .optional(),
    spacingScale: z
      .object({
        unit: z.string(),
        base: z.number(),
        multipliers: z.array(z.number()),
      })
      .optional(),
    maxFontWeights: z.number().optional(),
    maxFontFamilies: z.number().optional(),
    maxAccentColors: z.number().optional(),
    contrastMinimum: z.number().optional(),
    motion: z
      .object({
        durationMs: z.tuple([z.number(), z.number()]),
        easings: z.array(z.string()),
      })
      .optional(),
  })
  .strict();

export type RubricInput = z.infer<typeof RubricInput>;

/**
 * Build the effective rubric: static per-context values, with the
 * caller's dial overrides (if any) applied to the echoed dial block.
 */
export function buildRubric(args: GetDesignConstraintsArgs): Rubric {
  const profile = RUBRIC_PROFILES[args.context];
  return {
    context: args.context,
    dials: {
      variance: args.variance ?? profile.dialDefaults.variance,
      motion: args.motion ?? profile.dialDefaults.motion,
      density: args.density ?? profile.dialDefaults.density,
    },
    spacingScale: profile.spacingScale,
    maxFontWeights: profile.maxFontWeights,
    maxFontFamilies: profile.maxFontFamilies,
    maxAccentColors: profile.maxAccentColors,
    contrastMinimum: profile.contrastMinimum,
    motion: profile.motion,
  };
}
