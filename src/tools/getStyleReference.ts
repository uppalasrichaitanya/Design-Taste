import { z } from "zod";
import { STYLE_REFERENCES, type StyleReference } from "../config/styleReferences.js";

export const GetStyleReferenceInput = z
  .object({
    brand_or_mood: z.string().min(1),
  })
  .strict();

export type GetStyleReferenceArgs = z.infer<typeof GetStyleReferenceInput>;

/**
 * Resolve a brand/mood phrase to a style reference profile. Matches on
 * id, name, aliases, and mood keywords — all case-insensitive. Exact
 * alias/id matches rank above mood-keyword matches. Returns null when
 * nothing matches: callers get an honest "no profile for that" rather
 * than a nearest-guess.
 */
export function getStyleReference(args: GetStyleReferenceArgs): StyleReference | null {
  const query = args.brand_or_mood.trim().toLowerCase();

  // Pass 1: exact id/alias/name match.
  for (const ref of STYLE_REFERENCES) {
    if (
      ref.id === query ||
      ref.name.toLowerCase() === query ||
      ref.aliases.some((a) => a === query)
    ) {
      return ref;
    }
  }

  // Pass 2: query phrase contains an id/alias/name as a whole word.
  for (const ref of STYLE_REFERENCES) {
    const candidates = [ref.id, ref.name.toLowerCase(), ...ref.aliases];
    if (candidates.some((c) => new RegExp(`\\b${escapeRegExp(c)}\\b`).test(query))) {
      return ref;
    }
  }

  // Pass 3: mood keyword overlap.
  let best: { ref: StyleReference; hits: number } | null = null;
  const queryWords = new Set(query.split(/[^a-z0-9]+/).filter(Boolean));
  for (const ref of STYLE_REFERENCES) {
    let hits = 0;
    for (const mood of ref.moods) {
      if (queryWords.has(mood) || query.includes(mood)) hits++;
    }
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { ref, hits };
    }
  }
  return best?.ref ?? null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
