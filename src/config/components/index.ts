/**
 * Component registry — the single place to add component families or
 * variants. Add a new family file (e.g. accordions.ts) exporting a
 * ComponentVariant[], then list it in ALL_COMPONENTS below.
 *
 * Seed set: 6 families, 16 variants, kokonutui-inspired.
 */

import type { ComponentVariant } from "./types.js";
import { BUTTONS } from "./buttons.js";
import { CARDS } from "./cards.js";
import { MODALS } from "./modals.js";
import { INPUTS } from "./inputs.js";
import { NAVBARS } from "./navbars.js";
import { BADGES } from "./badges.js";

export type { ComponentVariant } from "./types.js";

export const ALL_COMPONENTS: ComponentVariant[] = [
  ...BUTTONS,
  ...CARDS,
  ...MODALS,
  ...INPUTS,
  ...NAVBARS,
  ...BADGES,
];
