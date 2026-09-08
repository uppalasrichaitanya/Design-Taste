import { z } from "zod";
import { ALL_COMPONENTS } from "../config/components/index.js";

export const SearchComponentsInput = z
  .object({
    query: z.string().min(1),
    /** Optional style hint, e.g. "minimal" or "animated" — biases ranking, never invents matches. */
    style: z.string().optional(),
  })
  .strict();

export type SearchComponentsArgs = z.infer<typeof SearchComponentsInput>;

export interface ComponentMatch {
  name: string;
  description: string;
  code: string;
  dependencies: string[];
}

/**
 * Deterministic search over the local registry. Scores:
 *  - family exact match (e.g. query "button" → the button family)
 *  - id / name / tag word overlap (multi-word queries score per word)
 *  - style-hint word overlap with tags/description
 * Returns variants sorted by score, best first. If nothing scores,
 * returns an honest empty array — the caller should widen the query.
 */
export function searchComponents(args: SearchComponentsArgs): ComponentMatch[] {
  const queryWords = tokenize(args.query);
  const styleWords = args.style ? tokenize(args.style) : [];

  const scored = ALL_COMPONENTS.map((c) => {
    const haystack = new Set([
      c.family,
      c.id,
      ...tokenize(c.name),
      ...c.tags.flatMap((t) => tokenize(t)),
      ...tokenize(c.description),
    ]);

    let score = 0;
    for (const w of queryWords) {
      if (c.family === w) score += 10; // direct family hit
      else if (haystack.has(w)) score += 2;
    }
    for (const w of styleWords) {
      if (haystack.has(w)) score += 3;
    }

    return { component: c, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.component.id.localeCompare(b.component.id))
    .map((s) => ({
      name: s.component.name,
      description: s.component.description,
      code: s.component.code,
      dependencies: s.component.dependencies,
    }));
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
