/**
 * Scene guidance config — the three staged passes for get_scene_guidance,
 * per the settled Phase 4 decision: composition (camera/framing/focal
 * point), lighting/mood (direction, color temp, contrast), and
 * material/detail (surface treatment, texture density, pacing). Three
 * passes, not img2threejs's full eight — the staged-pass-with-gate
 * *pattern* is adapted from hoainho/img2threejs (MIT); pass content is
 * our own, written for Three.js/WebGL UI and product work.
 *
 * Each pass: a strict JSON contract the generating model must fill, a
 * vocabulary that keeps outputs concrete, and gate criteria the reviewer
 * model checks. Between passes, a text gate reviews the accumulated
 * draft (settled decision) and may trigger one self-correct revision.
 *
 * To tune the tool: edit pass contracts, vocabulary, or gate criteria
 * here — no tool-code changes required. To add a pass, append to
 * SCENE_PASSES (order matters: later passes see earlier ones' output).
 */

export interface ScenePass {
  /** Pass id, stable for callers to reference. */
  id: string;
  /** What this pass decides. */
  title: string;
  /** Instructions for the generating model: role, task, constraints. */
  instruction: string;
  /** Strict JSON shape the pass must return. Keys are field names,
   * values are one-line descriptions of what belongs in that field. */
  contract: Record<string, string>;
  /** Vocabulary anchors: phrases the model should draw from (or reject)
   * to keep guidance concrete rather than generic. */
  vocabulary: string[];
  /** What the gate checks for this pass before proceeding. */
  gateCriteria: string[];
}

export const SCENE_PASSES: ScenePass[] = [
  {
    id: "composition",
    title: "Composition (camera, framing, focal point)",
    instruction:
      "You are a senior 3D art director working in Three.js. For the given scene brief, decide the composition pass ONLY: camera placement and lens feel, framing, and the primary focal point. Nothing about lighting or materials yet. Every value must be concrete and buildable: exact-ish camera parameters (position as [x,y,z], a target, a field-of-view in degrees), a named focal point, and what is deliberately NOT in frame. Reject vague art direction ('dynamic angle', 'interesting composition') in favor of numbers and named decisions.",
    contract: {
      cameraPosition: "[x, y, z] camera position in world units, justified by the brief",
      cameraTarget: "[x, y, z] look-at target",
      fieldOfView: "vertical FOV in degrees (typically 35-60 for product/UI scenes)",
      framingNotes: "what is in frame, what is deliberately excluded, and why",
      focalPoint: "the single element the eye should land on first, named specifically",
      depthCues: "2-4 concrete cues that sell depth (foreground occluder, layered silhouettes, ground plane contact, atmospheric falloff)",
      ruleOfThirds: "how the focal point sits relative to thirds/center, and why that serves the brief's mood",
    },
    vocabulary: [
      "hero three-quarter view",
      "low angle for dominance",
      "eye-level for honesty",
      "top-down for system/map reads",
      "tight crop on the object",
      "negative space for calm",
      "foreground occluder for depth",
      "ground-plane contact for physicality",
      "symmetrical center framing for ritual/formality",
      "off-center framing for energy",
    ],
    gateCriteria: [
      "Camera position, target, and FOV are present, numeric, and mutually consistent (target not absurdly far from view direction).",
      "A single, specific focal point is named (not a vague 'the product').",
      "framingNotes states at least one deliberate exclusion.",
      "At least two depth cues are concrete (named object or technique, not adjectives).",
      "Nothing in the output discusses lighting, materials, color, or motion.",
    ],
  },
  {
    id: "lighting",
    title: "Lighting and mood (direction, color temperature, contrast)",
    instruction:
      "You are a senior 3D lighting designer working in Three.js. Given the scene brief AND the already-decided composition, decide the lighting pass ONLY: light sources (type, direction, intensity relationships), color temperature, and contrast strategy. Keep the composition fixed. Every choice must be buildable in Three.js: name light types (DirectionalLight, SpotLight, AreaLight via RectAreaLight, ambient/hemisphere fill), give directions as vectors or clock positions, give color temperature in Kelvin, and give relative intensities (key : fill ratios). Reject 'moody lighting' in favor of named sources and ratios.",
    contract: {
      keyLight: "primary source: type, direction (vector or clock position), color temperature in Kelvin, and its job",
      fillLight: "fill source: type, direction, temperature, and ratio to key (e.g. key:fill 4:1)",
      rimOrAccent: "optional rim/accent: what it grazes, direction, and why it exists (separation, highlight on focal point)",
      ambientStrategy: "ambient/hemisphere approach and roughly how much it lifts shadows",
      contrastStrategy: "overall key-to-fill contrast and what it expresses (e.g. '8:1, noir-ish' or '2:1, editorial soft')",
      shadowBehavior: "shadow softness/direction and what shadows ground or hide",
      moodStatement: "one sentence: the emotional register this lighting serves in the brief",
    },
    vocabulary: [
      "three-point classic",
      "single hard key for drama",
      "north-window soft key",
      "golden hour warmth (3200-3800K)",
      "overcast neutrality (6500K)",
      "cool tech blue (8000K+ against warm subject)",
      "rim separation on the focal object",
      "practical accent (in-scene glowing element)",
      "high-key clarity",
      "low-key noir",
    ],
    gateCriteria: [
      "A key light is described with a concrete direction and a Kelvin temperature.",
      "Key-to-fill contrast is stated as a ratio or equivalent numeric relationship.",
      "The lighting choices visibly serve the brief's stated mood (moodStatement ties back).",
      "No contradiction with the composition pass (e.g. lighting that requires camera changes).",
      "Nothing in the output discusses materials, textures, or motion.",
    ],
  },
  {
    id: "material",
    title: "Material and detail (surface treatment, texture density, pacing)",
    instruction:
      "You are a senior lookdev/3D artist working in Three.js. Given the scene brief AND the already-decided composition and lighting, decide the material pass ONLY: surface treatments per major scene element, texture/ornament density, and pacing (how detail is distributed so the eye travels). Composition and lighting are fixed. Name materials as buildable Three.js/physically-based choices (roughness/metalness ranges, transmission, clearcoat, matcap vs PBR) per named element from the earlier passes. State where detail concentrates and where it is deliberately plain. Reject 'rich textures' in favor of per-element parameters and a stated density budget.",
    contract: {
      materials: "array of per-element material decisions, each an object {element: <named element from earlier passes>, role: 'focal' or 'supporting', material: <physically-based description>, roughness: <0-1 number>, metalness: <0-1 number>, extras: <optional transmission/clearcoat/sheen notes>, why: <one line>}. MUST include the focal element with full parameters.",
      contrastOfSurfaces: "how focal vs supporting surfaces differ (e.g. glossy hero on matte field) so the focal point reads",
      textureDensity: "where fine detail concentrates, and the deliberate plain zones that let it read (a stated density budget)",
      microDetail: "1-3 specific micro-details that reward a second look (named, buildable)",
      pacingNotes: "how the eye is meant to travel: first fixation, second stop, resting (order the elements)",
    },
    vocabulary: [
      "matte field, glossy hero",
      "brushed vs polished metal",
      "frosted transmission",
      "clearcoat highlight",
      "fabric-rough planes for calm",
      "one ornate zone per scene",
      "plain negative-space materials",
      "anisotropic sheen for hair/fabric",
      "weathering only where story needs it",
      "detail budget spent at the focal point",
    ],
    gateCriteria: [
      "The materials array includes the focal element with named PBR parameters (roughness at minimum, as a number).",
      "The materials array covers at least three distinct named elements total.",
      "A texture-density decision states both where detail concentrates AND where it is deliberately plain.",
      "Materials do not contradict the lighting pass (e.g. a rim that needs a material the pass removed).",
      "pacingNotes names a first fixation consistent with the composition pass's focalPoint.",
    ],
  },
];

/** Gate prompt fragments reused per pass (text-gate, per the settled decision). */
export const GATE_INSTRUCTION =
  "You are a strict technical art director reviewing a draft scene-guidance pass. Judge the draft ONLY against the listed criteria. Be harsh on vagueness: a criterion is unmet if the draft satisfies it only with adjectives. Respond with ONLY a JSON object: {\"pass\": true|false, \"gaps\": [\"<specific missing or unmet thing>\", ...]}. If pass is true, gaps must be [].";

export const SELF_CORRECT_INSTRUCTION =
  "You previously produced a scene-guidance pass draft that failed review. Revise the SAME pass: keep the same JSON contract, fix every gap listed by the reviewer, change nothing that already satisfied the contract. Respond with ONLY the JSON object for the pass, no prose.";
