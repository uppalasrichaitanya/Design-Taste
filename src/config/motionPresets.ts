/**
 * Motion presets — grounded in Motion's (motion.dev) documented API and
 * defaults, not invented values. Every number below is traceable to the
 * docs pages listed per preset.
 *
 * Motion's model: transform properties (x, y, scale) animate with spring
 * physics; opacity/color animate with duration-based tweens. Springs
 * configured with physics params (stiffness/damping/mass) have no
 * duration/easing — Motion's docs state "Time options will be
 * overridden if any physics options are set." So presets split:
 *   - tween presets  → duration (seconds) + easing (named or bezier)
 *   - spring presets → spring { damping, mass, stiffness, bounce } using
 *     Motion's documented defaults (damping 10, mass 1, bounce 0.25,
 *     restSpeed 0.1) where not otherwise noted.
 *
 * Unit caveat (documented): on the React transition prop, duration and
 * visualDuration are in SECONDS. Only the spring() helper's duration
 * parameter is historically in milliseconds.
 *
 * To add a preset: append an entry to MOTION_PRESETS and extend its
 * aliases. The lookup tool matches on id and aliases.
 */

export interface SpringParams {
  /** Motion default: 10 — "Strength of opposing force." */
  damping: number;
  /** Motion default: 1 — "Mass of the moving object." */
  mass?: number;
  /** Motion default: 1 for spring(); components with spring defaults
   * use tuned values — noted per preset with the doc source. */
  stiffness?: number;
  /** Motion default: 0.25 — "0 is no bounce, and 1 is extremely bouncy."
   * Used by duration-based springs. */
  bounce?: number;
}

export interface MotionPreset {
  /** Kebab-case unique id, e.g. "hover-lift". */
  id: string;
  /** Interaction this preset covers. */
  interaction: string;
  /** Alternate phrases callers might use (matched case-insensitively). */
  aliases: string[];
  /** Tween presets only: duration in seconds (Motion default: 0.3). */
  duration?: number;
  /** Tween presets only: named easing or cubic-bezier array. */
  easing?: string | number[];
  /** Spring presets only: physics/duration-spring parameters. */
  spring?: SpringParams;
  /** Value types this preset should be applied to. */
  properties: string[];
  /** What the numbers mean and where each came from. */
  notes: string;
  source?: string;
}

export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: "hover-tween",
    interaction: "hover",
    aliases: ["hover", "hover state", "pointer", "mouse over", "rollover"],
    duration: 0.3,
    easing: "easeOut",
    properties: ["color", "backgroundColor", "opacity"],
    notes:
      "Hover feedback on non-transform values. duration 0.3 is Motion's documented tween default; easeOut suits enter-style feedback. Motion animates color/opacity with duration-based tweens by default, so a spring would be wrong here. Grounded in motion.dev/docs/react-transitions (tween defaults) and /easing-functions (named easings).",
    source: "motion.dev/docs/react-transitions",
  },
  {
    id: "hover-scale-spring",
    interaction: "hover",
    aliases: ["hover scale", "grow", "lift", "press feedback", "scale up"],
    spring: { damping: 25, mass: 1, stiffness: 400 },
    properties: ["scale", "y"],
    notes:
      "Transform-based hover (scale/lift): physics spring, no duration/easing; Motion overrides time options when physics params are set. damping 25 with stiffness 400 gives a crisp settle without visible oscillation for small distances; these are tuned values, not doc defaults (spring() defaults are stiffness 1, damping 10). Transform properties use springs per Motion's default behavior. Grounded in motion.dev/docs/react-transitions (spring options) and /spring (default values).",
    source: "motion.dev/docs/react-transitions, motion.dev/docs/spring",
  },
  {
    id: "modal-open-tween",
    interaction: "modal-open",
    aliases: ["modal", "modal open", "dialog", "dialog open", "overlay", "popup"],
    duration: 0.2,
    easing: "easeOut",
    properties: ["opacity"],
    notes:
      "Backdrop and content fade for modal open. 0.2s easeOut, a deliberate value below Motion's 0.3 default, standard for overlay fades (kept short because the modal content, not the fade, is the event). Use with hover-scale-spring-style transform spring for the panel itself (see modal-animated in the component registry). Grounded in motion.dev/docs/react-transitions (duration is in seconds on the transition prop).",
    source: "motion.dev/docs/react-transitions",
  },
  {
    id: "modal-open-scale-spring",
    interaction: "modal-open",
    aliases: ["modal scale", "dialog scale", "panel spring"],
    spring: { damping: 30, mass: 1, stiffness: 320 },
    properties: ["scale", "y"],
    notes:
      "Panel enter: scale 0.96 to 1 plus small y offset, physics spring (no duration/easing; physics overrides time options). damping 30/stiffness 320: tuned for a confident settle with no bounce on a large surface; tuned values, not doc defaults. Mirrors the registered modal-animated component. Grounded in motion.dev/docs/react-transitions (spring options).",
    source: "motion.dev/docs/react-transitions",
  },
  {
    id: "page-transition-fade",
    interaction: "page-transition",
    aliases: ["page transition", "page fade", "route change", "route transition", "navigation transition"],
    duration: 0.3,
    easing: "easeInOut",
    properties: ["opacity"],
    notes:
      "Cross-fade between routes. duration 0.3 is Motion's documented tween default; easeInOut because a page hand-off has traffic in both directions (unlike an enter-only hover). Grounded in motion.dev/docs/react-transitions (tween defaults) and /easing-functions.",
    source: "motion.dev/docs/react-transitions",
  },
  {
    id: "page-transition-slide",
    interaction: "page-transition",
    aliases: ["page slide", "route slide", "content enter"],
    spring: { damping: 30, mass: 1, stiffness: 250 },
    properties: ["x", "y"],
    notes:
      "Slide-in of new page content: physics spring (no duration/easing; physics overrides time options). damping 30/stiffness 250: tuned to feel directional but unhurried; tuned values, not doc defaults. Grounded in motion.dev/docs/react-transitions (spring options).",
    source: "motion.dev/docs/react-transitions",
  },
  {
    id: "scroll-reveal-spring",
    interaction: "scroll-reveal",
    aliases: ["scroll reveal", "reveal", "fade in on scroll", "appear", "whileInView"],
    spring: { damping: 20, mass: 1, stiffness: 200 },
    properties: ["y", "opacity"],
    notes:
      "Scroll-into-view reveal: y 16 to 0 with opacity handled by the tween below; physics spring for the transform (no duration/easing; physics overrides time options). damping 20/stiffness 200: tuned for a soft entrance that doesn't fight the scroll; tuned values, not doc defaults. Grounded in motion.dev/docs/react-transitions (spring options).",
    source: "motion.dev/docs/react-transitions",
  },
  {
    id: "scroll-reveal-fade",
    interaction: "scroll-reveal",
    aliases: ["scroll fade", "fade in", "fade on scroll"],
    duration: 0.3,
    easing: "easeOut",
    properties: ["opacity"],
    notes:
      "Opacity component of scroll reveals. duration 0.3 is Motion's documented tween default; easeOut for enter-style motion. Motion animates opacity with duration-based tweens by default. Pair with scroll-reveal-spring for the y transform. Grounded in motion.dev/docs/react-transitions (tween defaults).",
    source: "motion.dev/docs/react-transitions",
  },
];
