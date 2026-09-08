# Design-Taste MCP

**Design taste, as tools your AI agent can actually call.**

Most AI-coded UIs look generated because no tool ever told the agent what *good* means — not at the start, not mid-build, not after. Design-Taste MCP fixes that with seven focused tools covering the whole UI build: **plan** the system before writing code, **check** the source as it's written, **pull** proven components instead of inventing them, and **critique** the rendered result like a real art director.

Built for the [Model Context Protocol](https://modelcontextprotocol.io): plug it into Qwen Code, Claude Desktop, or any MCP host, and your agent gets a design brain it reaches for at each stage of the work.

## Why it's different

- **Opinionated, not generic.** Real rubrics per UI context (marketing ≠ dashboard ≠ form), a curated registry, and style profiles deliberately placed at opposite ends of the taste spectrum — no safe middle-ground defaults.
- **Honest by construction.** Clean input returns `[]`, unknown queries return `[]`, unconfigured vision tools say so. No tool ever fabricates a finding, a match, or a score to look complete.
- **Everything is verifiable.** Motion presets cite motion.dev values. Component code is runnable React + Tailwind. The acceptance suite runs a real MCP client and — when a vision key is set — makes real vision-API calls and shows you the output.
- **Self-reviewing pipelines.** `get_scene_guidance` and `critique_render` don't just generate: a reviewer pass gates the output against strict criteria and self-corrects on failure — with the full verdict trail returned every time.

## The seven tools

| Tool | What it does | Stage of the build |
|---|---|---|
| `get_design_constraints` | Rubric for a UI context: spacing scale, font/accent budgets, contrast minimum, motion range — tuned by variance / motion / density dials (1-10) | **Plan** |
| `run_static_checks` | Deterministic design + a11y lint on HTML/JSX source: axe-core violations, font-family/weight sprawl, accent-color sprawl, em-dash AI-slop tells | **Check** |
| `search_components` | Real, runnable React + Tailwind variants from a curated registry (6 families, 16 variants) — with honest empty results on no match | **Pull** |
| `get_style_reference` | Resolves a brand or mood phrase ("minimal", "bold editorial", "calm professional") to a full DESIGN.md-style token profile | **Plan** |
| `get_motion_preset` | Motion presets grounded in motion.dev's documented API — springs honestly carry physics params, never fake durations | **Plan** |
| `critique_render` | Renders your HTML in headless Chromium, screenshots it, and has a vision model score it against your rubric — concrete findings tied to rubric fields | **Critique** |
| `get_scene_guidance` | Staged 3D art direction (Three.js): composition → lighting → materials, each pass gated by a reviewer that self-corrects on failure | **Critique** |

The tools are designed to chain: `get_design_constraints` → build → `run_static_checks` → fix → `critique_render` → refine. Scene work adds `get_scene_guidance` before the build, with `get_style_reference` and `search_components` supplying the pieces in between.

## Quick start

**Prerequisites:** Node ≥ 20.18. Optionally — only for the two vision tools — Playwright chromium and a vision API key (see [Vision providers](#vision-providers-pluggable-config-driven)).

```bash
npm install
npm run build
npm start        # stdio MCP server — no ports, no auth, stays on your machine
```

That's it for the five deterministic tools. To unlock `critique_render` and `get_scene_guidance`, add a key to `.env` (gitignored, auto-loaded by `npm start` / `npm test`):

```bash
# any ONE of these works — resolution order documented below
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
OPENROUTER_API_KEY=sk-or-...
BAI_API_KEY=...            # b.ai: qwen3.8-flash, glm-5.3-flash
NARA_API_KEY=...           # router.bynara.id: agnes-2.5-flash
```

```bash
npx playwright install --with-deps chromium   # critique_render only
```

### 60-second smoke test (MCP Inspector)

```bash
npx @modelcontextprotocol/inspector node --env-file-if-exists=.env dist/index.js
```

Connect in the web UI it opens, then try these — each one demonstrates a core behavior:

1. `get_design_constraints` with `{"context": "marketing"}` — full rubric, dials at marketing defaults (variance 8, density 3).
2. Same call with `{"context": "dashboard"}` — watch the dials flip (variance 3, density 8).
3. `run_static_checks` with dirty HTML (3 font families, missing `alt`, an em-dash) → findings for `font-family-count`, `accent-color-count`, `em-dash`, `axe:image-alt`.
4. Same tool with clean markup → `[]`. **Nothing is fabricated to look busy.**
5. `search_components` with `{"query": "calendar datepicker"}` → `[]`, honestly. With `{"query": "modal", "style": "animated"}` → the Motion-animated modal, declared dependencies included.
6. `get_scene_guidance` with `{"context": "premium headphones floating over a dark reflective surface, tech-luxury, Three.js"}` — full camera/lighting/materials guidance with the `gates[]` review trail (30-120s, several model calls).

### Wire it into your host permanently

The inspector is for exploring. To register the server permanently, add it to your host's MCP config — Qwen Code (`~/.qwen/settings.json`) or Claude Desktop (`%APPDATA%/Claude/claude_desktop_config.json` on Windows, `~/Library/Application Support/Claude/...` on macOS).

**Zero-clone install (published npm package):**

```jsonc
{
  "mcpServers": {
    "design-taste": {
      "command": "npx",
      "args": ["-y", "design-taste-mcp"],
      "env": {
        "NARA_API_KEY": "your-key-here"
      }
    }
  }
}
```

**From a local clone:**

```jsonc
{
  "mcpServers": {
    "design-taste": {
      "command": "node",
      "args": ["<absolute-path-to>/design-taste-mcp/dist/index.js"],
      "env": {
        "NARA_API_KEY": "your-key-here"
      }
    }
  }
}
```

Two things that matter:

- **The key goes in the host's `env` block, not just your shell.** MCP hosts spawn servers with a filtered environment — a key visible in your terminal is invisible to the host-spawned server without this block.
- **Any provider key works.** To pin a specific provider/model, add `"DESIGN_TASTE_VISION_PROVIDER": "nara"` and/or `"DESIGN_TASTE_VISION_MODEL": "agnes-2.5-flash"` to the same block.

## Tool reference

### `get_design_constraints`

**Input:** `{ context, variance?, motion?, density? }` — context is `"marketing" | "dashboard" | "portfolio" | "form"`; dials are 1-10 and optional.

Returns the effective rubric: spacing scale (4px-base multipliers), max font weights/families, max accent colors, contrast minimum, motion duration range + approved easings. Dial overrides beat context defaults and are echoed in the output. Pure config — no API calls.

### `run_static_checks`

**Input:** `{ code, format: "html" | "jsx", rubric? }` → **Output:** `findings[]` (empty if clean).

Forward a `get_design_constraints` result as `rubric` to check against that context's budgets instead of the defaults — partial rubrics are fine; omitted fields fall back.

| Rule | Severity | Flags |
|---|---|---|
| `axe:<id>` | critical/serious → **error**, else warning | Real a11y violations (axe-core on a jsdom DOM, HTML format only) |
| `font-weight-count` | warning | > 2 distinct weights (or rubric limit) |
| `font-family-count` | warning | > 2 distinct families (or rubric limit) |
| `accent-color-count` | warning | > 1 non-neutral color (or rubric limit) |
| `em-dash` | warning | The em-dash AI-slop copy tell |

**Known limitation (deliberate):** for `format: "jsx"` the pattern checks run on source, but the axe pass does not — JSX isn't a real DOM, and string-surgery conversion would silently miss real violations. Closing this needs a true React-rendering pipeline; documented, not hidden.

### `search_components`

**Input:** `{ query, style? }` → **Output:** `components[]` — `{ name, description, code, dependencies }`, best match first, `[]` when nothing matches.

Sixteen runnable React + Tailwind variants across six families — buttons (Primary / Secondary / Icon), cards (Basic / Feature / Stat), modals (Basic / Animated-with-Motion), inputs (Basic / Error / Floating-label), navbars (Simple / Responsive), badges (Status / Count / Tag). Family-name queries rank that family first; the `style` hint biases ranking but never invents matches.

### `get_style_reference`

**Input:** `{ brand_or_mood }` → **Output:** `{ styleReference }` — or `{ styleReference: null }` when nothing matches (no nearest-guess).

Matching runs exact alias → whole-word → mood-keyword, case-insensitive. Two seed profiles, deliberately at opposite ends of the taste-skill DESIGN_VARIANCE spectrum:

| Profile | Variance | Character |
|---|---|---|
| **clean-minimal** | 2 | White surfaces, hairline borders, one blue accent — "swiss", "calm professional" |
| **bold-editorial** | 9 | Warm paper, near-black ink, orange + sticker-yellow, oversized display type — "loud", "poster" |

### `get_motion_preset`

**Input:** `{ interaction }` — a name (`hover`, `modal-open`, `page-transition`, `scroll-reveal`) or a phrase (`"hover scale"`, `"route change"`) → **Output:** `{ motionPreset }` or `{ motionPreset: null }`.

Values are traceable to motion.dev documentation, not invented: tween presets use Motion's documented 0.3s default with named easings; transform presets use spring physics — and carry **no duration/easing at all**, because Motion's own docs state physics overrides time options. Faking a duration on a spring would be the exact kind of confident-sounding wrongness this project exists to prevent.

### `critique_render`

**Input:** `{ html, rubric, width?, height? }` → **Output:** `{ score (0-10), provider, model, findings[], error?, rawResponse? }`

Headless Chromium renders the HTML → screenshot → a vision model critiques it against your rubric. Findings name specific visible elements and cite the rubric field each one violates (`contrastMinimum`, `maxAccentColors`, …). A clean page returns an empty findings array; an unparseable model response surfaces in `error`/`rawResponse` instead of being dropped.

### `get_scene_guidance`

**Input:** `{ context, referenceImage? }` — a text brief is enough; an optional reference image (base64/data-URI) is attached to every pass. URL references are rejected with an honest "later refinement" message.

**Output:** `{ camera, lighting, materials[], pacingNotes, gates[], provider, model }`

Three staged passes — **composition** (numeric camera position/target/FOV, named focal point, deliberate exclusions), **lighting** (light types, vectors, Kelvin temperatures, key:fill ratios), **materials** (per-element roughness/metalness with a stated density budget) — and between each, a **text-gated review**: the same model judges the accumulated draft against strict criteria, and a failed gate triggers exactly one self-correct revision. The `gates[]` trail records every verdict, gap, and correction — visible, never rubber-stamped. Deterministic guards also catch hallucinated Three.js property names (a known LLM failure mode) and normalize Unicode minus signs so vector strings parse cleanly.

Without a vision provider configured, the tool returns a setup hint with null guidance — never invented art direction.

## Vision providers

Six adapters, plain REST, zero vendor SDKs. `critique_render` and `get_scene_guidance` share them all.

**Resolution order:**

1. Explicit: `DESIGN_TASTE_VISION_PROVIDER` (`openai` / `anthropic` / `gemini` / `openrouter` / `bai` / `nara`) + `DESIGN_TASTE_VISION_API_KEY`, with optional `DESIGN_TASTE_VISION_MODEL`.
2. Ambient: first vendor key found — `OPENAI_API_KEY` → `ANTHROPIC_API_KEY` → `GEMINI_API_KEY`/`GOOGLE_API_KEY` → `OPENROUTER_API_KEY` → `BAI_API_KEY`/`GLM/QWEN_API_KEY` → `NARA_API_KEY`/`MUSE_SPARK_API_KEY`.
3. Nothing set → the tools return an honest setup hint. No guessing, no fabricated output.

**Default models:** `gpt-4o-mini` · `claude-3-5-sonnet-latest` · `gemini-3.6-flash` · `google/gemma-4-31b-it:free` (OpenRouter) · `qwen3.8-flash` (b.ai; `glm-5.3-flash` via override) · `agnes-2.5-flash` (Nara; `muse-spark-1.2-contributor-free` via override).

Model ids rotate — vendors retire them (this project watched `minimax-m3:free` and a Gemini default disappear mid-build). If a provider returns a "model no longer available" error, pin the current one with `DESIGN_TASTE_VISION_MODEL`; for OpenRouter's free list check `https://openrouter.ai/api/v1/models`.

**OpenAI-compatible endpoints:** `DESIGN_TASTE_VISION_BASE_URL` points the OpenAI adapter at any compatible gateway (Groq, Together, vLLM, Ollama, a private proxy) — no code changes.

**Free-tier reality check:** free keys cap around 20-50 requests/day shared across *everything*. The acceptance suite costs ~12 calls per run; probe a key with one minimal call before committing to a run, and don't debug-rerun keyed suites.

**Verified providers** (live-probed): `agnes-2.5-flash` — text ✅, vision ✅, full suite ✅. `qwen3.8-flash` — text ✅, image path enforces a >10px minimum, vision-likely at real sizes. `glm-5.3-flash` — text ✅. `muse-spark-1.2-contributor-free` — upstream 502 at probe time.

## Testing

```bash
npm test
```

One script, real end to end: it spawns the built server as a child process, connects a genuine MCP client over stdio, and asserts every tool against the acceptance criteria — dirty HTML must produce findings that match the planted issues, clean markup must return `[]`, unknown queries must return `[]`/`null`, motion presets must carry Motion's documented values, and (with a vision key present) the render critique and staged scene guidance must produce real, specific, rubric-tied output. Without a key, the vision sections assert the honest setup-hint paths instead — so the suite is always safe to run, keyed or not.

## Project layout

```
src/
├── config/                  # All taste data — plain, editable TS
│   ├── rubric.ts            #   per-context rubrics + dial defaults
│   ├── styleReferences.ts   #   style profiles (palette / typeScale / voice)
│   ├── motionPresets.ts     #   Motion presets (doc-cited values)
│   ├── sceneGuidance.ts      #   scene passes, contracts, gate criteria, Three.js property list
│   └── components/           #   registry — one file per family
└── tools/                   # Tool schemas + logic
    ├── ...one file per tool, plus visionProvider.ts (six adapters)
    └── types.ts
scripts/
└── acceptance-test.mjs      # the acceptance suite itself
```

Everything opinionated lives in `src/config/` — extending the server means editing plain data files, not tool code.

## Extending

| To add… | Edit |
|---|---|
| A UI context (docs, landing, …) | `RUBRIC_PROFILES` in `src/config/rubric.ts` + the context enum in `getDesignConstraints.ts` |
| A component variant / family | a file in `src/config/components/` + list it in `index.ts` (tag generously — tags drive search) |
| A style profile | `STYLE_REFERENCES` in `src/config/styleReferences.ts` (give it aliases *and* moods) |
| A motion preset | `MOTION_PRESETS` in `src/config/motionPresets.ts` (cite the motion.dev source; label tuned values) |
| A scene pass / gate criterion | `SCENE_PASSES` in `src/config/sceneGuidance.ts` (order matters — later passes see earlier output) |
| A pattern check | `runPatternChecks()` in `src/tools/patternChecks.ts` |
| A vision provider | the `VisionProvider` interface in `src/tools/visionProvider.ts` — `name`, `model`, `critique()`, `generate()` |

## Credits

- Rule *concepts* adapted from [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache 2.0) — logic reimplemented, nothing copied.
- 3-dial calibration model (variance/motion/density) from [Leonxlnx/taste-skill](https://tasteskill.dev) (MIT); the em-dash copy tell likewise.
- Seed component *concepts* (React + Tailwind + Motion patterns) adapted from [kokonutui](https://github.com/kokonutui) — all registry code written for this project.
- Style token structure follows the DESIGN.md convention from [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) and Google Stitch.
- Motion presets grounded in [Motion](https://motion.dev) documentation (motion.dev/docs/react-transitions, /spring, /easing-functions).
- Staged generate → gate → self-correct pattern adapted from [hoainho/img2threejs](https://github.com/hoainho/img2threejs), applied to UI critique and scene art direction.
- Accessibility by [axe-core](https://github.com/dequelabs/axe-core); rendering by [Playwright](https://playwright.dev).

## Status

v1.0.1 — all five phases of the build spec complete and accepted. Seven tools, six vision-provider adapters, ~50 acceptance assertions green with real API calls. Development spec lives in `../design-taste-mcp-full-build-prompt.md`; the Phase 5 decisions (local stdio, static registries) are final.

**License:** MIT
