import { z } from "zod";
import { runPatternChecks, limitsFromRubric } from "./patternChecks.js";
import { runA11yChecks } from "./a11yChecks.js";
import { RubricInput } from "./getDesignConstraints.js";
import type { Finding } from "./types.js";

export const RunStaticChecksInput = z
  .object({
    code: z.string().min(1),
    format: z.enum(["html", "jsx"]),
    /** Optional rubric — forward the output of get_design_constraints to
     * check against context-specific budgets instead of the defaults. */
    rubric: RubricInput.optional(),
  })
  .strict();

export type RunStaticChecksArgs = z.infer<typeof RunStaticChecksInput>;

/**
 * Deterministic design + accessibility lint pass.
 *
 * Pattern checks run on raw source for both formats, against the
 * caller's rubric limits when provided (Phase 1 defaults otherwise).
 * The axe-core pass only runs for html input (Phase 1 decision): for
 * jsx, the source is not a real DOM, and faking a conversion would risk
 * silent false negatives.
 */
export async function runStaticChecks(args: RunStaticChecksArgs): Promise<Finding[]> {
  const limits = limitsFromRubric(args.rubric);
  const findings: Finding[] = runPatternChecks(args.code, limits);

  if (args.format === "html") {
    try {
      findings.push(...(await runA11yChecks(args.code)));
    } catch (err) {
      findings.push({
        rule: "axe-internal-error",
        severity: "error",
        message: `Accessibility check failed to run: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return findings;
}
