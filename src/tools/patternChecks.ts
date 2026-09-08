/**
 * Hand-written pattern checks run against raw source (works for both
 * "html" and "jsx" input).
 *
 * Anti-pattern concepts (font-weight sprawl, accent-color sprawl) are
 * adapted from pbakaus/impeccable's no-LLM check style (Apache 2.0);
 * the em-dash ban is adapted from Leonxlnx/taste-skill (MIT).
 * All detection logic, thresholds, and messages are our own implementation.
 */

import type { Finding } from "./types.js";

/** Limits the pattern checks compare against. */
export interface PatternCheckLimits {
  maxFontWeights: number;
  maxFontFamilies: number;
  maxAccentColors: number;
}

/** Phase 1 defaults (build prompt: >2 weights, >2 families, >1 accent) — used when no rubric is passed. */
export const DEFAULT_PATTERN_CHECK_LIMITS: PatternCheckLimits = {
  maxFontWeights: 2,
  maxFontFamilies: 2,
  maxAccentColors: 1,
};

/**
 * Merge a caller-supplied rubric (output of get_design_constraints) into
 * the default limits. Present rubric fields win; missing ones fall back
 * to the Phase 1 defaults.
 */
export function limitsFromRubric(rubric: Partial<PatternCheckLimits> | undefined): PatternCheckLimits {
  return {
    maxFontWeights: rubric?.maxFontWeights ?? DEFAULT_PATTERN_CHECK_LIMITS.maxFontWeights,
    maxFontFamilies: rubric?.maxFontFamilies ?? DEFAULT_PATTERN_CHECK_LIMITS.maxFontFamilies,
    maxAccentColors: rubric?.maxAccentColors ?? DEFAULT_PATTERN_CHECK_LIMITS.maxAccentColors,
  };
}

const EM_DASH = /\u2014/;

interface ColorStats {
  weights: Map<string, string[]>;
  families: Map<string, string[]>;
  accents: Map<string, string[]>;
}

function pushWithLoc(map: Map<string, string[]>, key: string, loc: string) {
  const existing = map.get(key);
  if (existing) {
    if (!existing.includes(loc)) existing.push(loc);
  } else {
    map.set(key, [loc]);
  }
}

/**
 * A declaration value: either a quoted JS/CSS string ("#fff", 'Inter',
 * sans-serif) or a bare CSS value up to ; } " or newline. Two groups so
 * callers can unquote JS strings and still read bare CSS values.
 */
const VALUE = `(?:("[^"\\n]*"|'[^'\\n]*')|([^;"'\\n}]+))`;

/** Unwrap a matched value: prefer the quoted group, strip its quotes. */
function unwrapValue(m: RegExpMatchArray): string {
  const quoted = m[1];
  return (quoted !== undefined ? quoted.slice(1, -1) : m[2] ?? "").trim();
}

/**
 * Extract font-weight, font-family, and accent-color declarations from
 * raw HTML/CSS/JSX source. Covers CSS declarations (kebab-case, `;` or
 * `{` or inline-style `"` before the property) and JSX style-object
 * entries (camelCase, `{` or `,` before the property, quoted values).
 * Heuristic source-scanning for Phase 1 — not a full CSS parser.
 */
function extractColorStats(code: string): ColorStats {
  const weights = new Map<string, string[]>();
  const families = new Map<string, string[]>();
  const accents = new Map<string, string[]>();

  // --- Font weights: font-weight: 400 / fontWeight: "bold" / normal | bold ---
  const weightRe = new RegExp(`(?:font-weight|fontWeight)\\s*:\\s*${VALUE}`, "gi");
  for (const m of code.matchAll(weightRe)) {
    const raw = unwrapValue(m).toLowerCase();
    const norm = raw === "normal" ? "400" : raw === "bold" ? "700" : raw;
    if (norm) pushWithLoc(weights, norm, m[0].slice(0, 40));
  }

  // --- Font families (first family in the list is the chosen one) ---
  const familyRe = new RegExp(`(?:font-family|fontFamily)\\s*:\\s*${VALUE}`, "gi");
  for (const m of code.matchAll(familyRe)) {
    const value = unwrapValue(m);
    const first = value
      .split(",")[0]
      .trim()
      .replace(/['"]/g, "")
      .toLowerCase();
    if (first) pushWithLoc(families, first, m[0].slice(0, 40));
  }

  // --- Colors ---
  // CSS (kebab-case): property after start, {, ;, or inline-style ".
  // Includes border/outline/background shorthands; tokenized below.
  const cssColorRe = new RegExp(
    `(?:(?:font-|border-|background-|outline-|text-|column-|marker-)?color|background-color|background|border|outline)\\s*:\\s*${VALUE}`,
    "gi"
  );
  // JSX style objects (camelCase): property after { or ,.
  const jsColorRe = new RegExp(
    `(?<=[{,])(?:backgroundColor|borderColor|outlineColor|color|background|border|outline)\\s*:\\s*${VALUE}`,
    "g"
  );

  for (const re of [cssColorRe, jsColorRe]) {
    for (const m of code.matchAll(re)) {
      const decl = unwrapValue(m);
      for (const token of decl.split(/\s*[,\/]\s*|\s+/)) {
        const color = token.trim().toLowerCase().replace(/^["']|["']$/g, "");
        if (color && isAccentColor(color)) {
          pushWithLoc(accents, color, m[0].slice(0, 40));
        }
      }
    }
  }

  // Tailwind-ish arbitrary colors in class attributes: text-[#3b82f6] ...
  for (const m of code.matchAll(/\b(?:text|bg|border)-\[([^\]]+)\]/g)) {
    const color = m[1].trim().toLowerCase();
    if (isAccentColor(color)) pushWithLoc(accents, color, m[0]);
  }

  // Tailwind named palette classes (text-blue-500, bg-rose-400, ...),
  // normalized to the hue family so blue-500 and blue-600 count as one
  // accent hue. slate/zinc/stone/neutral are treated as Tailwind's
  // neutral scales and deliberately excluded, like grays.
  const tailwindHues =
    /red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose/;
  for (const m of code.matchAll(
    /\b(?:text|bg|border)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|\d{3})\b/g
  )) {
    const hue = m[0].match(tailwindHues)![0];
    pushWithLoc(accents, `tailwind:${hue}`, m[0]);
  }

  return { weights, families, accents };
}

/** The full CSS named-color set, so prose tokens (center, solid) can't pose as colors. */
const NAMED_COLORS = new Set(
  ("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet " +
    "brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue " +
    "darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange " +
    "darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise " +
    "darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia " +
    "gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo " +
    "ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
    "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue " +
    "lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon " +
    "mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue " +
    "mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin " +
    "navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen " +
    "paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red " +
    "rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue " +
    "slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white " +
    "whitesmoke yellow yellowgreen").split(" ")
);

/** Achromatic named colors — treated as neutrals, never accents. */
const NAMED_NEUTRALS = new Set([
  "black", "white", "whitesmoke", "snow", "gainsboro", "silver",
  "lightgray", "lightgrey", "gray", "grey", "darkgray", "darkgrey",
  "dimgray", "dimgrey", "slategray", "slategrey", "darkslategray",
  "darkslategrey", "lightslategray", "lightslategrey",
]);

/**
 * An accent color is any color value that isn't neutral
 * (black/white/gray) or transparent.
 */
function isAccentColor(color: string): boolean {
  if (!color) return false;
  if (color === "transparent" || color === "currentcolor" || color === "inherit") return false;
  if (/^(rgb|rgba|hsl|hsla|var|calc)\(/.test(color)) return false;

  if (/^[a-z]+$/.test(color)) {
    return NAMED_COLORS.has(color) && !NAMED_NEUTRALS.has(color);
  }

  if (/^#[0-9a-f]{3,8}$/i.test(color)) {
    const hex =
      color.length === 4 || color.length === 5
        ? color.slice(1).split("").map((c) => c + c).join("")
        : color.slice(1);
    return !isNeutralHex(hex);
  }

  const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
      const [r, g, b] = parts;
      return Math.max(r, g, b) - Math.min(r, g, b) > 16; // not near-grayscale
    }
    return true;
  }

  const hslMatch = color.match(/^hsla?\(([^)]+)\)$/);
  if (hslMatch) {
    const satPart = hslMatch[1].split(/[\s,]+/)[1];
    const sat = Number(satPart?.replace("%", ""));
    return Number.isFinite(sat) && sat > 10;
  }

  return false;
}

function isNeutralHex(hex: string): boolean {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return Math.max(r, g, b) - Math.min(r, g, b) <= 16;
}

export function runPatternChecks(
  code: string,
  limits: PatternCheckLimits = DEFAULT_PATTERN_CHECK_LIMITS
): Finding[] {
  const findings: Finding[] = [];
  const { weights, families, accents } = extractColorStats(code);

  if (weights.size > limits.maxFontWeights) {
    const list = [...weights.entries()]
      .map(([w, locs]) => `${w} (${locs.join(", ")})`)
      .join("; ");
    findings.push({
      rule: "font-weight-count",
      severity: "warning",
      message: `${weights.size} distinct font weights found (${list}) — more than the recommended max of ${limits.maxFontWeights}. Reduce to at most ${limits.maxFontWeights} weights for a consistent hierarchy.`,
    });
  }

  if (families.size > limits.maxFontFamilies) {
    const list = [...families.entries()]
      .map(([f, locs]) => `${f} (${locs.join(", ")})`)
      .join("; ");
    findings.push({
      rule: "font-family-count",
      severity: "warning",
      message: `${families.size} distinct font families found (${list}) — more than the recommended max of ${limits.maxFontFamilies}. Pick at most ${limits.maxFontFamilies} families and stay consistent.`,
    });
  }

  if (accents.size > limits.maxAccentColors) {
    const list = [...accents.entries()]
      .map(([c, locs]) => `${c} (${locs.join(", ")})`)
      .join("; ");
    findings.push({
      rule: "accent-color-count",
      severity: "warning",
      message: `${accents.size} distinct accent colors found (${list}) — more than the recommended max of ${limits.maxAccentColors}. Consolidate the palette.`,
    });
  }

  if (EM_DASH.test(code)) {
    const count = code.match(new RegExp(EM_DASH.source, "g"))?.length ?? 0;
    findings.push({
      rule: "em-dash",
      severity: "warning",
      message: `${count} em-dash character${count === 1 ? "" : "s"} (\u2014) found in the code. Em-dashes are a tell of machine-generated copy; rewrite as separate clauses or use a comma/period instead.`,
    });
  }

  return findings;
}
