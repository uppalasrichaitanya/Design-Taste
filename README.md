# Design-Taste MCP

An MCP server that gives AI coding agents **design taste** as callable tools, reached for at each stage of a UI build. All seven tools are shipped: `get_design_constraints`, `run_static_checks`, `search_components`, `get_style_reference`, `get_motion_preset`, `critique_render`, and `get_scene_guidance`.

Spec lives in `../design-taste-mcp-full-build-prompt.md` (the master build prompt) and `../design-taste-mcp-build-brief-phase1.md` (the Phase 1 brief).

## Status

| Phase | Tools | State |
|---|---|---|
| 1 | `get_design_constraints`, `run_static_checks` | **Done — acceptance test passing** |
| 2 | `search_components`, `get_style_reference` | **Done — acceptance test passing** |
| 3 | `get_motion_preset`, `critique_render` | **Done — acceptance test passing (real vision critique verified)** |
| 4 | `get_scene_guidance` | **Done — acceptance test passing (real staged run verified on OpenRouter; gates + self-correct + full materials[] exercised)** |
| 5 | Hosting + registry decisions | **Settled — local stdio only, static TS registries (see Deployment); no further infrastructure** |

## Prerequisites

Three prerequisites, deliberately not managed by the tools at runtime:

1. **Node 20.18+** (build/runtime — the npm scripts use `--env-file-if-exists`, which requires ≥20.18).
2. **Playwright chromium** (for `critique_render` only) — install once per machine/CI runner:

   ```bash
   npx playwright install --with-deps chromium
   ```

   The `--with-deps` flag installs required OS libraries (Linux CI runners need it; Windows/macOS generally don't). The server does not download or manage browsers itself; if chromium is missing, `critique_render` returns the launch error rather than retrying or guessing.
3. **A vision provider API key** (for `critique_render` and `get_scene_guidance`) — see the Vision providers section. Without it, both tools return a setup hint and no fabricated output. `get_scene_guidance` needs the provider but NOT Playwright (text-only staged passes; no rendering).

## Install

```bash
npm install
npm run build
```

Optional, for the two vision-backed tools (`critique_render`, `get_scene_guidance`): create a `.env` file (gitignored) with a provider key, e.g.:

```bash
OPENROUTER_API_KEY=sk-or-...
# or OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY /
#    BAI_API_KEY (b.ai) / NARA_API_KEY (router.bynara.id) — see Vision providers
```

`npm test` and `npm start` auto-load `.env` when present. The other five tools work with no key at all. Keys in `.env` never leave the machine.

## Run

The server communicates over stdio (standard for local MCP servers) — no network exposure, no auth layer (settled Phase 5 decision):

```bash
npm start          # runs node dist/index.js
```

## Deployment (Phase 5 decision: stay local)

This server runs **locally over stdio** — the MCP host (Qwen Code, Claude Desktop, etc.) spawns it as a child process. That is the entire deployment story, deliberately:

- **No HTTP server, no ports, no auth layer.** Remote/networked hosting was considered and rejected for now: nothing beyond the local machine calls these tools. If a remote agent ever needs to call them, the decision to add transport + auth gets made then, not speculatively.
- **Registries stay static TS files** (`src/config/*.ts`, one file per family). No database, no versioning machinery. Revisit only if the registries grow to the point where editing them becomes genuinely unwieldy — not proactively.
- The MCP host needs the vision env vars in **its** server config (see the MCP host note in Vision providers) and Node 20+ on PATH.

## Test

```bash
npm test
```

Runs the acceptance test (`scripts/acceptance-test.mjs`): it spawns the built server as a child process, connects a real MCP client over stdio, and asserts every tool against the build prompt's acceptance criteria — Phase 1 (dirty HTML → matching findings, clean → `[]`, rubric defaults/overrides), Phase 2 (rubric-parameterized checks, real component/style lookups, honest empties), Phase 3 (Motion-grounded presets, spring presets honestly carry no duration/easing, unknown interactions → null), Phase 4 (scene brief → guidance with numeric camera values, Kelvin temperatures, PBR parameters, a full gates trail; URL reference rejection). The vision-dependent sections (`critique_render`, `get_scene_guidance`) adapt to the environment: with a vision key set (`.env` or environment) they run the full real-API paths; without one they assert the honest setup-hint paths. Exit code 0 means all assertions pass.

Quota discipline for keyed runs: the suite makes ~12 real model calls, and free-tier keys cap at roughly 20-50/day shared across *everything* that day — so plan **one keyed run per day**, probe a fresh key with a single minimal call before committing to a run, and never debug-rerun a keyed suite (run unkeyed while iterating; the deterministic assertions plus honest no-provider paths always pass and cost nothing).

## Trying it with the MCP Inspector

```bash
npx @modelcontextprotocol/inspector node --env-file-if-exists=.env dist/index.js
```

(The `--env-file-if-exists=.env` flag loads your provider keys into the spawned server — without it, the inspector's server won't see `.env` and the vision tools will report "No vision provider configured". Equivalent alternative: put the key in your shell environment before launching, or in your MCP host's env block — see the MCP host note below.)

The inspector opens a local web UI (URL printed in the terminal). Select the stdio transport — the command (`node`) and args (`dist/index.js`) should already be prefilled — and connect. Then:

1. **List tools** — you should see all seven: `get_design_constraints`, `run_static_checks`, `search_components`, `get_style_reference`, `get_motion_preset`, `critique_render`, and `get_scene_guidance`. (If you launched the inspector from a shell without `.env` vars, the two vision tools still list fine — they only need a key when actually called.)
2. **`get_design_constraints`** — try `{"context": "marketing"}`, then with overrides: `{"context": "dashboard", "variance": 7, "density": 2}`.
3. **`run_static_checks`** — paste this as `code` with `format: "html"`:

   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head><title>t</title>
     <style>
       body { font-family: 'Inter', sans-serif; }
       h1 { font-family: Georgia, serif; }
       .cta { font-family: 'Courier New', monospace; background: #2563eb; color: #fff; }
       .cta2 { background: #16a34a; color: #111; }
     </style>
   </head>
   <body>
     <main>
       <h1>Product — the smart way</h1>
       <img src="hero.png">
     </main>
   </body>
   </html>
   ```

   Expected: findings for `font-family-count`, `accent-color-count`, `em-dash`, and `axe:image-alt`.
4. Paste clean markup (one family, no accents beyond neutrals, `alt` present, no em-dashes) — expected: `[]`. The tool never fabricates findings.
5. **`search_components`** — try `{"query": "button"}`, `{"query": "modal", "style": "animated"}`, `{"query": "stat"}`. Each match returns runnable React + Tailwind code with its dependencies. Try `{"query": "calendar datepicker"}` — you get `[]`, honestly.
6. **`run_static_checks` with rubric** — first call `get_design_constraints` with `{"context": "marketing"}`, then pass its output as the `rubric` argument to `run_static_checks` (with the same dirty HTML): the `accent-color-count` finding disappears (marketing allows 2 accents), while `font-family-count` and `axe:image-alt` remain.
7. **`get_style_reference`** — try `{"brand_or_mood": "minimal"}`, `{"brand_or_mood": "bold editorial"}`, `{"brand_or_mood": "calm professional"}`, and `{"brand_or_mood": "gothic medieval castle"}` (returns `{ "styleReference": null }`).
8. **`get_motion_preset`** — try `{"interaction": "hover"}`, `{"interaction": "hover scale"}` (a spring — no duration/easing, by Motion's design), `{"interaction": "modal open"}`, and `{"interaction": "hologram shuffle"}` (returns `{ "motionPreset": null }`).
9. **`critique_render`** (needs a vision key + Playwright chromium) — get a rubric from step 2, then pass the same dirty HTML as `html` and the rubric as `rubric`: `{"html": "<the dirty HTML>", "rubric": {…}}`. Expect a 0-10 score and findings naming the font-family sprawl, accent colors, and missing alt text.
10. **`get_scene_guidance`** (needs a vision key; Playwright NOT required) — try `{"context": "A hero product scene: premium headphones floating over a dark reflective surface, calm tech-luxury mood, Three.js"}`. Expect camera/lighting/materials/pacingNotes plus the `gates[]` trail; takes 30-120s (several sequential model calls).

## Tools

### `get_design_constraints`

Returns a structured rubric for a UI context: spacing scale, max font weights, max font families, max accent colors, contrast minimum, motion duration/easing range.

- **Input:** `{ context: "marketing" | "dashboard" | "portfolio" | "form", variance?: 1-10, motion?: 1-10, density?: 1-10 }`
- Dials default per context (marketing → high variance/low density; dashboard → the reverse; portfolio → balanced; form → conservative). Caller-supplied dials override the defaults and are echoed in the output.
- Pure static config — no external calls.

### `run_static_checks`

Runs deterministic design + accessibility checks on source code.

- **Input:** `{ code: string, format: "html" | "jsx", rubric?: object }`
- **Output:** `findings[]`, each `{ rule, severity: "error" | "warning", message, location? }` — **empty array if clean**.
- **Rubric parameter:** forward the output of `get_design_constraints` as `rubric` to check against that context's limits instead of the built-in defaults. The rubric is partial-friendly: only `maxFontWeights`, `maxFontFamilies`, and `maxAccentColors` are consumed; any field you omit falls back to the default. Without a rubric, defaults apply.

Checks (default limits):

| Rule | Severity | What it flags |
|---|---|---|
| `axe:<rule-id>` | impact-mapped (critical/serious → error, else warning) | Accessibility violations via axe-core against a jsdom-rendered document |
| `font-weight-count` | warning | More distinct font weights than the limit (default 2) |
| `font-family-count` | warning | More distinct font families than the limit (default 2) |
| `accent-color-count` | warning | More distinct non-neutral colors than the limit (default 1) |
| `em-dash` | warning | Em-dash characters (an AI-slop copy tell) |

### Known limitation — JSX accessibility (deliberate)

For `format: "jsx"`, the hand-written pattern checks run on the source, but **the axe-core accessibility pass does not run**. JSX source isn't a real DOM; converting it naively (string surgery) would risk silent false negatives, which violates the project's no-fake-results rule. `critique_render` (Phase 3) renders and critiques full HTML documents — it never executes JSX components. Closing this gap for real would need a React-rendering pipeline (or JSX callers wrapping their components in a test harness that emits HTML); that's future work if it's ever wanted, not a shipped feature.

### `search_components`

Searches a curated local registry of real component code.

- **Input:** `{ query: string, style?: string }`
- **Output:** `components[]`, each `{ name, description, code, dependencies }` — best matches first, **empty array when nothing matches**.
- Scoring: exact family match (e.g. `"button"` → the button family) ranks above tag/description word overlap; the optional `style` hint biases ranking (e.g. `style: "animated"` lifts the Motion modal) but never invents matches.

Seed set (16 variants, all runnable React + Tailwind; the animated modal declares `motion` as a dependency):

| Family | Variants |
|---|---|
| button | Primary, Secondary, Icon |
| card | Basic, Feature, Stat |
| modal | Basic, Animated (Motion) |
| input | Basic, Error state, Floating label |
| navbar | Simple, Responsive with mobile menu |
| badge | Status, Count, Tag |

### `get_style_reference`

Resolves a brand/mood phrase to a DESIGN.md-style token profile.

- **Input:** `{ brand_or_mood: string }`
- **Output:** `{ styleReference: { id, name, aliases, moods, designVariance, palette, typeScale, voice, source } }` — or `{ styleReference: null }` when nothing matches (no nearest-guess fallback).
- Matching: exact id/alias/name first, then whole-word containment, then mood-keyword overlap — all case-insensitive.

Seed profiles — deliberately at opposite ends of the taste-skill DESIGN_VARIANCE spectrum, no middle-ground default:

| Profile | designVariance | Character |
|---|---|---|
| clean-minimal | 2 | White surfaces, hairline borders, one blue accent, quiet voice ("swiss", "minimal", "calm professional") |
| bold-editorial | 9 | Warm paper, near-black ink, orange/yellow accents, oversized display type, loud voice ("editorial", "poster", "loud playful startup") |

### `get_motion_preset`

Resolves an interaction to a Motion (motion.dev) preset.

- **Input:** `{ interaction: string }` — a standard name (`hover`, `modal-open`, `page-transition`, `scroll-reveal`) or a phrase (`"hover scale"`, `"modal open"`, `"route change"`)
- **Output:** `{ motionPreset: { id, interaction, aliases, duration?, easing?, spring?, properties, notes, source } }` — or `{ motionPreset: null }` for unknown interactions.

Preset model (matches Motion's actual API, values traceable to the docs):

| Preset | Type | Values |
|---|---|---|
| hover (tween) | duration-based | 0.3s easeOut (Motion's documented tween default) for color/background/opacity |
| hover scale | spring | damping 25, stiffness 400 for scale/y — no duration/easing, because Motion's docs state time options are overridden when physics params are set |
| modal-open (fade) | duration-based | 0.2s easeOut for opacity (deliberate, below the 0.3 default, noted as such) |
| modal-open (panel) | spring | damping 30, stiffness 320 for scale/y |
| page-transition (fade) | duration-based | 0.3s easeInOut for opacity |
| page-transition (slide) | spring | damping 30, stiffness 250 for x/y |
| scroll-reveal (transform) | spring | damping 20, stiffness 200 for y |
| scroll-reveal (fade) | duration-based | 0.3s easeOut for opacity |

Every preset's `notes` cite its motion.dev source; tuned (non-default) values are labeled as tuned. On the React `transition` prop, durations are in **seconds** (milliseconds only inside the `spring()` helper — a documented Motion quirk).

### `critique_render`

Renders HTML in headless Chromium, screenshots it, and has a vision-capable model critique it against a rubric.

- **Input:** `{ html: string, rubric: object, width?: number, height?: number }` — pass the output of `get_design_constraints` as `rubric`.
- **Output:** `{ score: number|null (0-10), provider, model, findings: [{ issue, severity, suggestion, rubricField? }], error?, rawResponse? }`
- Findings are anchored to specific visible elements and rubric fields; a clean page returns an empty findings array. Unparseable vision responses surface in `error`/`rawResponse` rather than being silently dropped.
- Staged render-critique pattern adapted from hoainho/img2threejs (generate → render → vision review), applied to UI critique.

### `get_scene_guidance`

Staged art direction for 3D/spatial scenes (Three.js/WebGL) — the differentiator no other tool in this space covers.

- **Input:** `{ context: string, referenceImage?: string }` — a text scene brief is sufficient; a reference image (base64 or data-URI) is optional and attached to every pass. URL references are rejected with an honest "later refinement" message.
- **Output:** `{ camera, lighting, materials[], pacingNotes, gates[], provider, model, error? }` — spec-shaped guidance plus the full gates trail.

Three gated passes, per the settled Phase 4 design (not img2threejs's full eight):

| Pass | Decides | Concreteness enforced |
|---|---|---|
| composition | camera position/target/FOV, framing, focal point, depth cues | numeric camera values, named focal point, deliberate exclusions |
| lighting | key/fill/rim sources, ambient, contrast, shadows | light types, directions, Kelvin temperatures, key:fill ratios |
| material | per-element PBR, surface contrast, texture density, pacing | roughness/metalness numbers per named element, stated density budget |

**Text-gated review between passes** (settled decision): the same model reviews the accumulated draft against each pass's strict criteria; a failed gate triggers exactly one self-correct revision, then a re-gate. The `gates[]` trail records every verdict, gap, self-correction, and any gate error honestly — nothing is rubber-stamped or hidden. The staged-pass-with-gate pattern is adapted from hoainho/img2threejs (MIT), applied to scene composition taste rather than single-object reconstruction.

Without a configured vision provider, the tool returns a setup hint with null guidance fields — never fabricated art direction.

Note: the full pipeline is several sequential model calls; expect 30-120s per invocation, and MCP hosts with short per-request timeouts may need adjustment.

#### Vision providers (pluggable, config-driven)

Shared by `critique_render` and `get_scene_guidance`: an interface plus six adapters (plain REST, no vendor SDKs) — **OpenAI**, **Anthropic**, **Gemini**, **OpenRouter**, **b.ai**, and **Nara**. Resolution order:

1. `DESIGN_TASTE_VISION_PROVIDER` (`openai` | `anthropic` | `gemini` | `openrouter` | `bai` | `nara`) + `DESIGN_TASTE_VISION_API_KEY` (+ optional `DESIGN_TASTE_VISION_MODEL` to override the default).
2. Otherwise, whichever vendor key is present, in this order: `OPENAI_API_KEY`, then `ANTHROPIC_API_KEY`, then `GEMINI_API_KEY`/`GOOGLE_API_KEY`, then `OPENROUTER_API_KEY`, then `BAI_API_KEY`/`GLM/QWEN_API_KEY`, then `NARA_API_KEY`/`MUSE_SPARK_API_KEY`.
3. Nothing set → both tools return a setup hint (null result fields). No guessing, no fabricated output.

Default models: `gpt-4o-mini` (OpenAI), `claude-3-5-sonnet-latest` (Anthropic), `gemini-3.6-flash` (Gemini), `google/gemma-4-31b-it:free` (OpenRouter), `qwen3.8-flash` (b.ai — also hosts `glm-5.3-flash` via `DESIGN_TASTE_VISION_MODEL=glm-5.3-flash`), `agnes-2.5-flash` (Nara — also hosts `muse-spark-1.2-contributor-free` via the same override; it was 502-ing upstream at wire time). Defaults drift as vendors rotate models; `DESIGN_TASTE_VISION_MODEL` is the designed remedy — for OpenRouter's rotating free list, check `https://openrouter.ai/api/v1/models`.

**Provider verification status** (probed live 2026-09-07, verbatim results in the session transcript): `agnes-2.5-flash` — text ✅, image ✅ ("Red" on a red test PNG), full acceptance suite ✅ (exit 0). `qwen3.8-flash` — text ✅; image path exists but enforces a min-dimension rule (>10px), so vision-likely, unconfirmed at realistic sizes. `glm-5.3-flash` — text ✅, image unconfirmed. `muse-spark-1.2-contributor-free` — upstream 502 at probe time; retry later.

**OpenAI-compatible base-URL override:** `DESIGN_TASTE_VISION_BASE_URL` points the OpenAI adapter at any compatible endpoint (Groq, Together, local vLLM/Ollama, a private gateway) — no code changes:

```bash
# OpenRouter via explicit pin (immune to other ambient keys)
DESIGN_TASTE_VISION_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
# optional: pick a different OpenRouter model
DESIGN_TASTE_VISION_MODEL=google/gemini-2.0-flash-exp:free
```

**Free-tier note:** free keys (Gemini free tier, OpenRouter `:free` models) have low daily request caps (roughly 20-50/day) and the full acceptance suite makes ~12 calls per run — plan one keyed run per day, and prefer probing key validity with a single minimal call first.

To swap providers, change the environment — no code changes:

```bash
# Explicit: pin any provider regardless of ambient keys
export DESIGN_TASTE_VISION_PROVIDER=anthropic
export DESIGN_TASTE_VISION_API_KEY=sk-ant-...
export DESIGN_TASTE_VISION_MODEL=claude-3-5-sonnet-latest   # optional

# Implicit: just have exactly one vendor key set and it wins in the order above
```

To add another provider (e.g. a local vision model or a new vendor): implement the `VisionProvider` interface in `src/tools/visionProvider.ts` (`name`, `model`, `critique(req)` and `generate(req)` returning the model's text), add a case to `resolveVisionProvider`, and a default model. The interface is the only contract.

**MCP host note:** many MCP clients spawn servers with a *filtered* environment (the SDK's stdio transport inherits only a safe subset of env vars by default). If `critique_render` reports "No vision provider configured" but your shell has the key, add the env var to the server's launch config in your MCP host (e.g. the `env` block of the server entry in your client's config file), not just your shell.

#### CI setup

```yaml
# GitHub Actions example
- uses: actions/setup-node@v4
  with: { node-version: 20 }
- run: npm ci && npm run build
- run: npx playwright install --with-deps chromium   # prerequisite, not managed by the server
- run: npm test
  env:
    # whichever provider CI should exercise; without a key the critique
    # section asserts the honest no-provider path instead
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Project layout

```
src/
├── config/
│   ├── rubric.ts                # Editable rubric + per-context dial defaults
│   ├── styleReferences.ts       # Editable style profiles (palette/typeScale/voice)
│   ├── motionPresets.ts         # Editable Motion presets (doc-grounded values)
│   ├── sceneGuidance.ts         # Editable scene passes: contracts, vocabulary, gate criteria
│   └── components/              # Editable component registry — one file per family
│       ├── index.ts             # ...and the rollup listing all families
│       ├── types.ts
│       ├── buttons.ts / cards.ts / modals.ts / inputs.ts / navbars.ts / badges.ts
├── tools/
│   ├── getDesignConstraints.ts  # get_design_constraints schema + rubric assembly
│   ├── runStaticChecks.ts       # run_static_checks schema + orchestration
│   ├── patternChecks.ts         # Hand-written source-level design checks
│   ├── a11yChecks.ts            # axe-core via jsdom
│   ├── searchComponents.ts      # search_components schema + scoring
│   ├── getStyleReference.ts     # get_style_reference schema + matching
│   ├── getMotionPreset.ts       # get_motion_preset schema + matching
│   ├── critiqueRender.ts        # critique_render: Playwright + rubric prompt + parsing
│   ├── getSceneGuidance.ts      # get_scene_guidance: staged passes + gates + self-correct
│   ├── visionProvider.ts        # Pluggable vision adapters + env resolution + retry
│   └── types.ts                 # Shared Finding type
└── index.ts                     # Server setup + tool registration (stdio)
scripts/
└── acceptance-test.mjs          # Acceptance test (real MCP client over stdio)
```

## Extending

- **Add a context** (e.g. `"docs"`, `"landing"`): add an entry to `RUBRIC_PROFILES` in `src/config/rubric.ts` and extend the `context` zod enum in `src/tools/getDesignConstraints.ts`. Nothing else changes.
- **Tune constraint values**: they all live in `RUBRIC_PROFILES` — one entry per context, plain data.
- **Add a pattern check**: add a rule to `runPatternChecks()` in `src/tools/patternChecks.ts` and follow the existing `{ rule, severity, message }` finding shape.
- **Dial→field scaling**: the spec does not define how dial *overrides* modulate individual rubric fields, so effective dials are echoed but fields are per-context static. If you want e.g. variance to widen the accent budget, decide the mapping and implement it in `buildRubric()`.
- **Add component variants/families**: add a variant to an existing family file, or create `src/config/components/<family>.ts` exporting a `ComponentVariant[]` and list it in `src/config/components/index.ts`. Tags drive search — tag generously.
- **Add a style profile**: append an entry to `STYLE_REFERENCES` in `src/config/styleReferences.ts`. Give it a spread of aliases and moods so both exact phrases and mood language resolve to it.
- **Add a motion preset**: append an entry to `MOTION_PRESETS` in `src/config/motionPresets.ts` with id/aliases and values grounded in Motion's docs — cite the source page and label tuned values as tuned.
- **Tune scene guidance**: edit `SCENE_PASSES` in `src/config/sceneGuidance.ts` — pass instructions, JSON contracts, vocabulary anchors, and gate criteria are all plain config, no tool-code changes. To add a pass, append to `SCENE_PASSES` (order matters: later passes see earlier output).
- **Add a vision provider**: implement the `VisionProvider` interface in `src/tools/visionProvider.ts` and wire it into `resolveVisionProvider()` (see the Vision providers section).

## Credits

- Rule *concepts* (anti-pattern lint style) adapted from [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache 2.0) — logic reimplemented, no text copied.
- The 3-dial calibration model (variance/motion/density) is a concept from [Leonxlnx/taste-skill](https://tasteskill.dev) (MIT); the em-dash copy tell is likewise from its conventions.
- Seed component *concepts* (React + Tailwind + Motion variant patterns) adapted from [kokonutui](https://github.com/kokonutui) — all registry code written for this project, none lifted.
- Style token structure follows the DESIGN.md convention from [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) and Google Stitch.
- Motion presets grounded in [Motion](https://motion.dev) documentation (motion.dev/docs/react-transitions, /spring, /easing-functions).
- Staged render-critique pattern adapted from [hoainho/img2threejs](https://github.com/hoainho/img2threejs) — applied to UI critique (Phase 3) and to scene composition/lighting/material taste with text-gated passes (Phase 4), not single-object reconstruction.
- Accessibility checks by [axe-core](https://github.com/dequelabs/axe-core); rendering by [Playwright](https://playwright.dev).
