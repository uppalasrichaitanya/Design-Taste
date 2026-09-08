/**
 * Static design rubric config — the single place to edit constraints, dial
 * defaults per context, or add new contexts.
 *
 * The three-dial calibration (variance / motion / density, each 1-10) is a
 * concept adapted from Leonxlnx/taste-skill (MIT); values here are our own.
 *
 * Phase 1 scope note: the spec defines per-context rubric values and
 * per-context dial defaults, but does not define how dial *overrides*
 * modulate individual rubric fields. So the rubric is per-context static;
 * effective dials (defaults + caller overrides) are echoed in the output
 * for the caller to reason about. Dial→field scaling is a future decision.
 */

export type DesignContext = "marketing" | "dashboard" | "portfolio" | "form";

export interface DialDefaults {
  variance: number;
  motion: number;
  density: number;
}

export interface SpacingScale {
  unit: string;
  /** Base step in px; full scale is base × each multiplier, in order. */
  base: number;
  multipliers: number[];
}

// Type alias (not interface): the MCP SDK's structuredContent requires an
// implicit index signature, which TS only grants to object type aliases.
export type Rubric = {
  context: DesignContext;
  /** Effective dial values after applying caller overrides. */
  dials: Required<DialDefaults>;
  spacingScale: SpacingScale;
  /** Max distinct font weights allowed across the UI. */
  maxFontWeights: number;
  /** Max distinct font families allowed across the UI. */
  maxFontFamilies: number;
  /** Max distinct accent (non-neutral) colors allowed. */
  maxAccentColors: number;
  /** Minimum text contrast ratio (WCAG-style, 1-21). */
  contrastMinimum: number;
  motion: {
    /** [min, max] duration in ms for interactive transitions. */
    durationMs: [number, number];
    /** Allowed CSS easing keywords/cubic-beziers. */
    easings: string[];
  };
};

export const RUBRIC_PROFILES: Record<
  DesignContext,
  { dialDefaults: DialDefaults } & Omit<Rubric, "context" | "dials">
> = {
  // marketing: expressive, spacious, bold motion
  marketing: {
    dialDefaults: { variance: 8, motion: 7, density: 3 },
    spacingScale: { unit: "px", base: 4, multipliers: [0, 1, 2, 4, 6, 10, 16] },
    maxFontWeights: 3,
    maxFontFamilies: 2,
    maxAccentColors: 2,
    contrastMinimum: 4.5,
    motion: {
      durationMs: [150, 600],
      easings: ["ease-out", "cubic-bezier(0.22, 1, 0.36, 1)", "cubic-bezier(0.16, 1, 0.3, 1)"],
    },
  },
  // dashboard: restrained, information-dense, subtle motion
  dashboard: {
    dialDefaults: { variance: 3, motion: 3, density: 8 },
    spacingScale: { unit: "px", base: 4, multipliers: [0, 1, 2, 3, 4, 6, 8] },
    maxFontWeights: 2,
    maxFontFamilies: 1,
    maxAccentColors: 1,
    contrastMinimum: 4.5,
    motion: {
      durationMs: [100, 250],
      easings: ["ease-out", "cubic-bezier(0.22, 1, 0.36, 1)"],
    },
  },
  // portfolio: expressive but disciplined, medium motion and density
  portfolio: {
    dialDefaults: { variance: 6, motion: 5, density: 5 },
    spacingScale: { unit: "px", base: 4, multipliers: [0, 1, 2, 4, 6, 8, 12] },
    maxFontWeights: 3,
    maxFontFamilies: 2,
    maxAccentColors: 2,
    contrastMinimum: 4.5,
    motion: {
      durationMs: [120, 450],
      easings: ["ease-out", "cubic-bezier(0.22, 1, 0.36, 1)"],
    },
  },
  // form: conservative, calm, tight and legible
  form: {
    dialDefaults: { variance: 2, motion: 2, density: 7 },
    spacingScale: { unit: "px", base: 4, multipliers: [0, 1, 2, 3, 4, 6, 8] },
    maxFontWeights: 2,
    maxFontFamilies: 1,
    maxAccentColors: 1,
    contrastMinimum: 7,
    motion: { durationMs: [100, 200], easings: ["ease-out"] },
  },
};
