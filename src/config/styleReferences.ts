/**
 * Style reference registry — DESIGN.md-style token profiles (palette,
 * type scale, voice), the convention used by VoltAgent/awesome-design-md
 * and Google Stitch's DESIGN.md files. Our token structure follows that
 * convention; profile content is written for this project.
 *
 * The profiles sit at opposite ends of the taste-skill DESIGN_VARIANCE
 * spectrum (a calibration concept adapted from Leonxlnx/taste-skill,
 * MIT): clean-minimal anchors the low end, bold-editorial the high end.
 * No middle-ground default is provided, by design.
 *
 * To add a profile: append an entry to STYLE_REFERENCES below and extend
 * its alias/mood lists — the lookup tool matches on id, aliases, and
 * moods.
 */

export interface PaletteColor {
  /** Token name, e.g. "bg" or "accent". */
  name: string;
  /** Any CSS color: hex, rgb(), etc. */
  value: string;
  /** What it's for. */
  usage: string;
}

export interface TypeScaleStep {
  /** Token name, e.g. "body" or "h1". */
  name: string;
  /** CSS font-size, e.g. "1rem" or "0.875rem". */
  size: string;
  /** CSS font-weight number. */
  weight: number;
  /** Optional line-height, e.g. "1.25". */
  lineHeight?: string;
  usage?: string;
}

export interface StyleReference {
  /** Kebab-case unique id, e.g. "clean-minimal". */
  id: string;
  /** Human label. */
  name: string;
  /** Alternate names callers might use (matched case-insensitively). */
  aliases: string[];
  /** Mood keywords this profile expresses (matched case-insensitively). */
  moods: string[];
  /** Where this sits on taste-skill's DESIGN_VARIANCE dial (1-10). */
  designVariance: number;
  palette: PaletteColor[];
  typeScale: TypeScaleStep[];
  /** One-paragraph guidance on writing tone and visual voice. */
  voice: string;
  source?: string;
}

export const STYLE_REFERENCES: StyleReference[] = [
  {
    id: "clean-minimal",
    name: "Clean Minimal",
    aliases: ["minimal", "swiss", "quiet", "simple", "modern-saas", "stripe-like"],
    moods: ["calm", "professional", "trustworthy", "precise", "airy", "restrained", "quiet luxury", "understated"],
    designVariance: 2,
    palette: [
      { name: "bg", value: "#ffffff", usage: "Page background" },
      { name: "surface", value: "#f8f9fa", usage: "Cards, subtle section fills" },
      { name: "text-primary", value: "#111827", usage: "Headings, primary copy" },
      { name: "text-secondary", value: "#6b7280", usage: "Body, captions" },
      { name: "border", value: "#e5e7eb", usage: "Hairlines, dividers, input borders" },
      { name: "accent", value: "#2563eb", usage: "Links, primary buttons, focus; the only loud color on the page" },
      { name: "accent-subtle", value: "#eff6ff", usage: "Accent-tinted backgrounds: selected states, soft highlights" },
    ],
    typeScale: [
      { name: "h1", size: "3rem", weight: 600, lineHeight: "1.1", usage: "Page title, once per page" },
      { name: "h2", size: "2rem", weight: 600, lineHeight: "1.2", usage: "Section headings" },
      { name: "h3", size: "1.25rem", weight: 600, lineHeight: "1.3", usage: "Card titles, sub-sections" },
      { name: "body", size: "1rem", weight: 400, lineHeight: "1.6", usage: "Default body copy" },
      { name: "small", size: "0.875rem", weight: 400, lineHeight: "1.5", usage: "Captions, secondary text" },
    ],
    voice:
      "Precise and quiet. Say less, mean it. Short declarative sentences; no exclamation points; no hype adjectives. Let the layout breathe: generous whitespace, one accent color, hairline borders instead of shadows. If an element could be removed without losing meaning, remove it.",
    source: "DESIGN.md token convention (VoltAgent/awesome-design-md, Google Stitch)",
  },
  {
    id: "bold-editorial",
    name: "Bold Editorial",
    aliases: ["editorial", "bold", "vibrant", "magazine", "poster", "brutalist", "startup-landing"],
    moods: ["energetic", "loud", "playful", "confident", "young", "expressive", "optimistic", "disruptive"],
    designVariance: 9,
    palette: [
      { name: "bg", value: "#fdfcf8", usage: "Warm paper-like page background" },
      { name: "ink", value: "#0f0e0c", usage: "Near-black text, thick rules, oversized headings" },
      { name: "primary", value: "#ff4d00", usage: "Primary accent: CTAs, underlines, headline highlights" },
      { name: "secondary", value: "#ffd400", usage: "Secondary accent: badges, sticker shapes, hover states" },
      { name: "tertiary", value: "#4d3dff", usage: "Tertiary accent: sparingly, for gradients in illustration only; never for text" },
      { name: "highlight", value: "#00c48c", usage: "Occasional highlight fill behind key words" },
      { name: "paper", value: "#f0ede4", usage: "Contrasting panel backgrounds, torn-paper sections" },
    ],
    typeScale: [
      { name: "display", size: "5.5rem", weight: 800, lineHeight: "0.95", usage: "Hero statement, condensed tight leading" },
      { name: "h1", size: "3.5rem", weight: 800, lineHeight: "1.0", usage: "Section openers" },
      { name: "h2", size: "2.25rem", weight: 700, lineHeight: "1.1", usage: "Sub-sections, pull quotes" },
      { name: "body", size: "1.125rem", weight: 400, lineHeight: "1.55", usage: "Body copy, slightly larger than default for presence" },
      { name: "caption", size: "0.875rem", weight: 500, lineHeight: "1.4", usage: "Kickers, bylines, eyebrow labels; often uppercase" },
    ],
    voice:
      "Loud, confident, a little cheeky. Big statements with typographic contrast: oversized display type against small precise captions. High-energy verbs, short punchy fragments, and at most one exclamation mark per page. Color is expressive (orange on paper, sticker-yellow badges, thick black rules), but typography does the shouting, not gradients. Rotated sticker elements and highlight marks are on-brand when used sparingly.",
    source: "DESIGN.md token convention (VoltAgent/awesome-design-md, Google Stitch)",
  },
];
