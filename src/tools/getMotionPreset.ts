import { z } from "zod";
import { MOTION_PRESETS, type MotionPreset } from "../config/motionPresets.js";

export const GetMotionPresetInput = z
  .object({
    interaction: z.string().min(1),
  })
  .strict();

export type GetMotionPresetArgs = z.infer<typeof GetMotionPresetInput>;

/**
 * Resolve an interaction phrase to a motion preset. Exact id/alias match
 * first, then whole-word containment in the interaction/alias text.
 * Returns null when nothing matches — callers should re-ask with a
 * standard interaction name rather than receiving a nearest-guess.
 */
export function getMotionPreset(args: GetMotionPresetArgs): MotionPreset | null {
  const query = args.interaction.trim().toLowerCase();

  // Pass 1: exact id/alias/interaction match.
  for (const preset of MOTION_PRESETS) {
    if (preset.id === query || preset.interaction === query) return preset;
    if (preset.aliases.some((a) => a === query)) return preset;
  }

  // Pass 2: whole-word containment (query inside an alias/interaction or
  // vice versa), e.g. "hover effect" contains "hover".
  for (const preset of MOTION_PRESETS) {
    const candidates = [preset.id, preset.interaction, ...preset.aliases];
    if (
      candidates.some(
        (c) =>
          new RegExp(`\\b${escapeRegExp(c)}\\b`).test(query) ||
          new RegExp(`\\b${escapeRegExp(query)}\\b`).test(c)
      )
    ) {
      return preset;
    }
  }

  return null;
}

/** All presets for a given interaction id, e.g. both hover presets. */
export function getMotionPresetsByInteraction(interaction: string): MotionPreset[] {
  return MOTION_PRESETS.filter((p) => p.interaction === interaction);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
