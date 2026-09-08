/**
 * Component registry types — the shape every registered component
 * variant follows. This is the contract search_components returns.
 *
 * Seed components are kokonutui-inspired (React + Tailwind, Motion where
 * it animates): component concepts and interaction patterns are adapted
 * with attribution; all code here is written from scratch for this
 * project, not lifted from the kokonutui repo.
 */

export interface ComponentVariant {
  /** Kebab-case unique id, e.g. "button-primary". */
  id: string;
  /** Component family this variant belongs to, e.g. "button". */
  family: string;
  /** Human label, e.g. "Primary button". */
  name: string;
  description: string;
  /** runnable React (TSX) source */
  code: string;
  /** npm packages required beyond react itself, e.g. ["motion"]. */
  dependencies: string[];
  /** Search tags: type, variants, use-cases. */
  tags: string[];
  /** Free-form provenance, e.g. "kokonutui-inspired". */
  source?: string;
}
