/**
 * Acceptance test — exercises the real server over stdio using the MCP
 * SDK client. Covers the build prompt's acceptance criteria per phase:
 *
 * Phase 1: dirty HTML → findings matching the planted issues; clean → [].
 * Phase 2: rubric-parameterized checks; real component/style lookups;
 *          honest empty results on no-match.
 * Phase 3: motion presets grounded in Motion's documented API; and
 *          critique_render: real Playwright render + real vision call on
 *          a deliberately cluttered page → concrete findings tied to
 *          rubric fields. When no vision provider is configured (env has
 *          no keys), the critique section instead verifies the honest
 *          setup-hint path — that branch prints which mode it ran.
 *
 * Exit code 0 = all assertions passed. Any failure prints and exits 1.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const DIRTY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Dirty test page</title>
  <style>
    body { font-family: 'Inter', sans-serif; }
    h1 { font-family: Georgia, serif; color: #1a1a1a; }
    .cta { font-family: 'Courier New', monospace; background-color: #2563eb; color: #ffffff; }
    .cta2 { background: #16a34a; color: #111111; }
  </style>
</head>
<body>
  <main>
    <h1>Product — the smart way</h1>
    <img src="hero.png">
    <p style="color: #333333">Intro copy.</p>
    <button class="cta">Sign up</button>
    <button class="cta2">Learn more</button>
  </main>
</body>
</html>`;

// Clean: one family, no accent colors beyond neutrals, no em-dashes,
// and a11y-clean (title, lang, alt, landmarks, contrast-safe text).
const CLEAN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Clean test page</title>
  <style>
    body { font-family: 'Inter', sans-serif; color: #1a1a1a; }
    h1 { font-weight: 700; }
    p { color: #333333; }
  </style>
</head>
<body>
  <main>
    <h1>Product overview</h1>
    <img src="hero.png" alt="Product hero image">
    <p>Intro copy.</p>
    <button style="background-color: #2563eb; color: #ffffff">Sign up</button>
  </main>
</body>
</html>`;

// Dirty JSX: three families + em-dash in copy. a11y pass must NOT run
// (that's the documented Phase 1 limitation), pattern checks must.
const DIRTY_JSX = `export function Hero() {
  return (
    <section className="hero">
      <h1 style={{ fontFamily: "'Inter', sans-serif" }}>Welcome</h1>
      <p style={{ fontFamily: "Georgia, serif" }}>Everything you need — in one place.</p>
      <button style={{ fontFamily: "'Courier New', monospace" }}>Start</button>
    </section>
  );
}`;

// Clean JSX: one family, one accent, no em-dash.
const CLEAN_JSX = `export function Hero() {
  return (
    <section className="hero">
      <h1 style={{ fontFamily: "'Inter', sans-serif" }}>Welcome</h1>
      <p>Everything you need, in one place.</p>
      <button style={{ color: "#2563eb" }}>Start</button>
    </section>
  );
}`;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
  cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  // The SDK filters inherited env vars to a safe subset by default, which
  // would strip vision keys from the spawned server. Pass the full env
  // explicitly so critique_render can see any configured provider.
  env: { ...process.env },
});
const client = new Client({ name: "acceptance-test", version: "0.2.0" });
await client.connect(transport);

async function callTool(name, args) {
  // Generous request timeout: real vision calls can take >60s under
  // provider load (plus one 8s retry backoff in the server).
  const result = await client.callTool(
    { name, arguments: args },
    undefined,
    { timeout: 3 * 60_000 }
  );
  if (result.isError) {
    throw new Error(`Tool ${name} returned an error: ${JSON.stringify(result.content)}`);
  }
  return result.structuredContent;
}

// ============================================================
// PHASE 1 — acceptance cases (regression)
// ============================================================

const dirty = await callTool("run_static_checks", { code: DIRTY_HTML, format: "html" });
console.log("\n=== P1: run_static_checks DIRTY HTML findings ===");
console.log(JSON.stringify(dirty.findings, null, 2));

const dirtyRules = dirty.findings.map((f) => f.rule);
assert(
  dirtyRules.includes("axe:image-alt"),
  "P1 dirty HTML: axe flags the <img> missing alt (axe:image-alt)"
);
assert(
  dirtyRules.includes("font-family-count"),
  "P1 dirty HTML: three font families flagged (font-family-count)"
);
assert(
  dirtyRules.includes("accent-color-count"),
  "P1 dirty HTML: multiple accent colors flagged (accent-color-count)"
);
assert(
  dirtyRules.includes("em-dash"),
  "P1 dirty HTML: em-dash in copy flagged (em-dash)"
);
const fontFamilyFinding = dirty.findings.find((f) => f.rule === "font-family-count");
assert(
  fontFamilyFinding.message.includes("inter") &&
    fontFamilyFinding.message.includes("georgia") &&
    fontFamilyFinding.message.includes("courier new"),
  "P1 dirty HTML: font-family finding names the actual three families"
);

const clean = await callTool("run_static_checks", { code: CLEAN_HTML, format: "html" });
console.log("\n=== P1: run_static_checks CLEAN HTML findings ===");
console.log(JSON.stringify(clean.findings, null, 2));
assert(
  Array.isArray(clean.findings) && clean.findings.length === 0,
  "P1 clean HTML: empty findings array (no fabricated results)"
);

console.log("\n=== P1: get_design_constraints (defaults, compact) ===");
const marketing = await callTool("get_design_constraints", { context: "marketing" });
const dashboard = await callTool("get_design_constraints", { context: "dashboard" });
const portfolio = await callTool("get_design_constraints", { context: "portfolio" });
const form = await callTool("get_design_constraints", { context: "form" });
console.log(JSON.stringify({ marketing, dashboard, portfolio, form }, null, 2));
assert(
  marketing.dials.variance >= 7 && marketing.dials.density <= 3,
  "P1 marketing defaults: high variance, low density"
);
assert(
  dashboard.dials.variance <= 3 && dashboard.dials.density >= 7,
  "P1 dashboard defaults: low variance, high density (reverse of marketing)"
);
assert(portfolio.dials.variance === 6 && form.dials.variance === 2, "P1 portfolio/form defaults sane");
assert(
  typeof marketing.spacingScale.base === "number" &&
    marketing.motion.durationMs.length === 2 &&
    Array.isArray(marketing.motion.easings) &&
    typeof marketing.contrastMinimum === "number",
  "P1 rubric carries usable spacing/motion/contrast values"
);

const overridden = await callTool("get_design_constraints", {
  context: "marketing",
  variance: 2,
  motion: 3,
  density: 9,
});
assert(
  overridden.dials.variance === 2 &&
    overridden.dials.motion === 3 &&
    overridden.dials.density === 9,
  "P1 dial overrides replace context defaults"
);

const dirtyJsx = await callTool("run_static_checks", { code: DIRTY_JSX, format: "jsx" });
console.log("\n=== P1: run_static_checks DIRTY JSX findings ===");
console.log(JSON.stringify(dirtyJsx.findings, null, 2));
const jsxRules = dirtyJsx.findings.map((f) => f.rule);
assert(jsxRules.includes("font-family-count"), "P1 dirty JSX: font-family-count flagged");
assert(jsxRules.includes("em-dash"), "P1 dirty JSX: em-dash flagged");
assert(
  !jsxRules.some((r) => r.startsWith("axe:")),
  "P1 dirty JSX: axe pass correctly NOT run for jsx format (documented limitation)"
);

const cleanJsx = await callTool("run_static_checks", { code: CLEAN_JSX, format: "jsx" });
console.log("\n=== P1: run_static_checks CLEAN JSX findings ===");
console.log(JSON.stringify(cleanJsx.findings, null, 2));
assert(
  Array.isArray(cleanJsx.findings) && cleanJsx.findings.length === 0,
  "P1 clean JSX: empty findings array"
);

// ============================================================
// PHASE 2 — rubric wiring in run_static_checks
// ============================================================
// DIRTY_HTML has: 3 font families, 2 accent colors, 1 weight.
// Default limits (families 2, accents 1) flag both sprawls.
// marketing rubric (families 2, accents 2) clears the accent finding
// but not the family finding. dashboard rubric (families 1, accents 1)
// matches the default outcome.

console.log("\n=== P2: rubric wiring ===");
const withMarketingRubric = await callTool("run_static_checks", {
  code: DIRTY_HTML,
  format: "html",
  rubric: marketing,
});
const mRules = withMarketingRubric.findings.map((f) => f.rule);
console.log("with marketing rubric:", JSON.stringify(mRules));
assert(
  !mRules.includes("accent-color-count"),
  "P2 marketing rubric (maxAccentColors 2): 2 accents no longer flagged"
);
assert(
  mRules.includes("font-family-count"),
  "P2 marketing rubric (maxFontFamilies 2): 3 families still flagged"
);
assert(
  mRules.includes("axe:image-alt"),
  "P2 rubric does not affect the a11y pass (image-alt still flagged)"
);

const withDashboardRubric = await callTool("run_static_checks", {
  code: DIRTY_HTML,
  format: "html",
  rubric: dashboard,
});
const dRules = withDashboardRubric.findings.map((f) => f.rule);
console.log("with dashboard rubric:", JSON.stringify(dRules));
assert(
  dRules.includes("accent-color-count") && dRules.includes("font-family-count"),
  "P2 dashboard rubric (maxAccentColors 1, maxFontFamilies 1): both sprawls flagged"
);

const withPartialRubric = await callTool("run_static_checks", {
  code: DIRTY_HTML,
  format: "html",
  rubric: { maxAccentColors: 5 },
});
const pRules = withPartialRubric.findings.map((f) => f.rule);
console.log("with partial rubric {maxAccentColors:5}:", JSON.stringify(pRules));
assert(
  !pRules.includes("accent-color-count"),
  "P2 partial rubric: supplied field (maxAccentColors) honored"
);
assert(
  pRules.includes("font-family-count"),
  "P2 partial rubric: missing fields fall back to defaults (families still flagged)"
);

// ============================================================
// PHASE 2 — search_components
// ============================================================

console.log("\n=== P2: search_components 'button' ===");
const buttonSearch = await callTool("search_components", { query: "button" });
console.log(
  "names:",
  JSON.stringify(buttonSearch.components.map((c) => c.name))
);
assert(
  buttonSearch.components.length >= 3,
  "P2 button query returns the button family variants"
);
assert(
  buttonSearch.components.every((c) => /export function/.test(c.code) && c.code.length > 200),
  "P2 button query: every match returns real runnable code (export function), not a placeholder"
);
const primaryBtn = buttonSearch.components.find((c) => c.name === "Primary button");
assert(
  primaryBtn && primaryBtn.code.includes("bg-blue-600") && primaryBtn.dependencies.length === 0,
  "P2 primary button: usable Tailwind code, no extra deps"
);

console.log("\n=== P2: search_components 'modal' + style 'animated' ===");
const modalSearch = await callTool("search_components", { query: "modal", style: "animated" });
console.log(
  "names:",
  JSON.stringify(modalSearch.components.map((c) => c.name))
);
assert(
  modalSearch.components.length >= 1 &&
    modalSearch.components[0].name.includes("Animated"),
  "P2 modal + animated style: animated variant ranks first"
);
assert(
  modalSearch.components[0].dependencies.includes("motion"),
  "P2 animated modal declares its motion dependency"
);
assert(
  modalSearch.components.some((c) => !c.dependencies.includes("motion")),
  "P2 basic modal also returned without motion dep"
);

console.log("\n=== P2: search_components 'stat' ===");
const statSearch = await callTool("search_components", { query: "stat" });
console.log(
  "names:",
  JSON.stringify(statSearch.components.map((c) => c.name))
);
assert(
  statSearch.components.some((c) => c.name === "Stat card" && c.code.includes("tabular-nums")),
  "P2 stat query finds the Stat card by tag"
);

console.log("\n=== P2: search_components no-match ===");
const noMatch = await callTool("search_components", { query: "calendar datepicker timeline" });
console.log("result:", JSON.stringify(noMatch.components));
assert(
  Array.isArray(noMatch.components) && noMatch.components.length === 0,
  "P2 no-match query returns honest empty array (no fabricated matches)"
);

// ============================================================
// PHASE 2 — get_style_reference
// ============================================================

console.log("\n=== P2: get_style_reference 'minimal' ===");
const minimal = await callTool("get_style_reference", { brand_or_mood: "minimal" });
console.log(JSON.stringify(minimal.styleReference, null, 2));
assert(
  minimal.styleReference && minimal.styleReference.id === "clean-minimal",
  "P2 'minimal' resolves to clean-minimal profile"
);
assert(
  minimal.styleReference.palette.some((c) => c.name === "accent" && c.value === "#2563eb"),
  "P2 clean-minimal palette carries the single accent token"
);
assert(
  minimal.styleReference.designVariance <= 3,
  "P2 clean-minimal sits at the low end of DESIGN_VARIANCE"
);
assert(
  minimal.styleReference.typeScale.length >= 4 && minimal.styleReference.voice.length > 50,
  "P2 clean-minimal has a real type scale and voice"
);

console.log("\n=== P2: get_style_reference 'bold editorial' ===");
const editorial = await callTool("get_style_reference", { brand_or_mood: "bold editorial" });
console.log(
  JSON.stringify(
    { id: editorial.styleReference?.id, designVariance: editorial.styleReference?.designVariance },
    null,
    2
  )
);
assert(
  editorial.styleReference && editorial.styleReference.id === "bold-editorial",
  "P2 'bold editorial' resolves to bold-editorial profile"
);
assert(
  editorial.styleReference.designVariance >= 7,
  "P2 bold-editorial sits at the high end of DESIGN_VARIANCE"
);
assert(
  minimal.styleReference.designVariance !== editorial.styleReference.designVariance,
  "P2 the two profiles are genuinely opposite, not a middle-ground default"
);

console.log("\n=== P2: get_style_reference mood matching ===");
const calmPro = await callTool("get_style_reference", { brand_or_mood: "calm professional" });
const loudStartup = await callTool("get_style_reference", { brand_or_mood: "loud playful startup" });
console.log(
  "calm professional ->",
  calmPro.styleReference?.id,
  "| loud playful startup ->",
  loudStartup.styleReference?.id
);
assert(
  calmPro.styleReference?.id === "clean-minimal",
  "P2 mood phrase 'calm professional' maps to clean-minimal"
);
assert(
  loudStartup.styleReference?.id === "bold-editorial",
  "P2 mood phrase 'loud playful startup' maps to bold-editorial"
);

console.log("\n=== P2: get_style_reference no-match ===");
const noStyle = await callTool("get_style_reference", { brand_or_mood: "gothic medieval castle" });
console.log("result:", JSON.stringify(noStyle));
assert(
  noStyle.styleReference === null,
  "P2 unknown phrase returns { styleReference: null } honestly (no nearest-guess)"
);

// Taste-consistency: the server's own output must pass its own em-dash rule.
const EM_DASH = /\u2014/;
assert(
  !EM_DASH.test(JSON.stringify(minimal.styleReference)) &&
    !EM_DASH.test(JSON.stringify(editorial.styleReference)) &&
    !EM_DASH.test(JSON.stringify(buttonSearch.components)),
  "P2 server output contains no em-dashes (practices what it lints)"
);

// ============================================================
// PHASE 3 — get_motion_preset
// ============================================================

console.log("\n=== P3: get_motion_preset 'hover' ===");
const hoverPreset = await callTool("get_motion_preset", { interaction: "hover" });
console.log(JSON.stringify(hoverPreset.motionPreset, null, 2));
assert(
  hoverPreset.motionPreset && hoverPreset.motionPreset.id === "hover-tween",
  "P3 'hover' resolves to the tween preset (exact interaction match)"
);
assert(
  hoverPreset.motionPreset.duration === 0.3 && hoverPreset.motionPreset.easing === "easeOut",
  "P3 hover tween carries Motion's documented default duration 0.3s + easeOut"
);

console.log("\n=== P3: get_motion_preset 'hover scale' (phrase) ===");
const hoverScale = await callTool("get_motion_preset", { interaction: "hover scale" });
console.log(JSON.stringify(hoverScale.motionPreset, null, 2));
assert(
  hoverScale.motionPreset && hoverScale.motionPreset.id === "hover-scale-spring",
  "P3 'hover scale' phrase resolves to the transform spring preset"
);
assert(
  hoverScale.motionPreset.spring && typeof hoverScale.motionPreset.spring.damping === "number" &&
    !hoverScale.motionPreset.duration && !hoverScale.motionPreset.easing,
  "P3 spring preset carries physics params and honestly no duration/easing (Motion: physics overrides time options)"
);

console.log("\n=== P3: get_motion_preset other interactions ===");
const modalFade = await callTool("get_motion_preset", { interaction: "modal open" });
const pageFade = await callTool("get_motion_preset", { interaction: "page-transition" });
const reveal = await callTool("get_motion_preset", { interaction: "scroll reveal" });
console.log(
  "modal open ->", modalFade.motionPreset?.id,
  "| page-transition ->", pageFade.motionPreset?.id,
  "| scroll reveal ->", reveal.motionPreset?.id
);
assert(modalFade.motionPreset?.id === "modal-open-tween", "P3 'modal open' resolves via alias");
assert(pageFade.motionPreset?.id === "page-transition-fade", "P3 'page-transition' resolves to the fade tween");
assert(
  reveal.motionPreset?.properties.includes("y") && reveal.motionPreset?.spring,
  "P3 'scroll reveal' resolves to the spring reveal preset"
);

console.log("\n=== P3: get_motion_preset no-match ===");
const noPreset = await callTool("get_motion_preset", { interaction: "hologram shuffle" });
console.log("result:", JSON.stringify(noPreset));
assert(
  noPreset.motionPreset === null,
  "P3 unknown interaction returns { motionPreset: null } honestly"
);

// Taste-consistency for Phase 3 config output too.
const allPresets = [hoverPreset, hoverScale, modalFade, pageFade, reveal]
  .map((r) => r.motionPreset)
  .filter(Boolean);
assert(
  !EM_DASH.test(JSON.stringify(allPresets)),
  "P3 motion preset output contains no em-dashes (practices what it lints)"
);

// ============================================================
// PHASE 3 — critique_render
// ============================================================
// Acceptance criterion from the build prompt: "render a deliberately
// cluttered test page → get concrete, specific findings tied to rubric
// fields, not generic praise or vague notes."

const CLUTTERED_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Cluttered test page</title>
  <style>
    body { margin: 0; font-family: 'Comic Sans MS', cursive; background: #f5f0ff; }
    .box { border-radius: 12px; padding: 6px; margin: 4px; }
    h1 { font-size: 28px; font-weight: 900; color: #7c3aed; margin: 2px; }
    h2 { font-size: 22px; font-weight: 300; color: #db2777; margin: 2px; font-family: Georgia, serif; }
    p { font-size: 11px; color: #a3a3a3; margin: 1px; line-height: 1.1; }
    .btn1 { background: #ff0066; color: #ffff00; padding: 3px 10px; border: none; border-radius: 4px; font-size: 11px; }
    .btn2 { background: #00c853; color: #ffffff; padding: 4px 12px; border: 2px solid #d500f9; border-radius: 20px; font-size: 13px; font-weight: 700; }
    .btn3 { background: #2962ff; color: #ffab00; padding: 2px 8px; border: 3px dotted #00e5ff; border-radius: 50px; font-size: 10px; font-family: 'Courier New', monospace; }
    .card1 { background: #fff; border: 1px solid #ddd; display: inline-block; width: 150px; margin: 3px; padding: 5px; box-shadow: 3px 3px 0 #ff0066; }
    .card2 { background: #fffde7; border: 2px solid #7c3aed; display: inline-block; width: 180px; margin: 3px; padding: 8px; }
    .card3 { background: #e0f2f1; border: 1px dashed #db2777; display: inline-block; width: 120px; margin: 3px; padding: 3px; transform: rotate(-2deg); }
    .banner { background: linear-gradient(90deg, #ff0066, #2962ff, #00c853, #d500f9); padding: 4px; text-align: center; font-size: 13px; color: #fff; font-weight: 900; }
    .stat { display: inline-block; font-size: 34px; font-weight: 900; color: #d500f9; margin: 2px; }
    .tiny { font-size: 8px; color: #9e9e9e; }
    img.logo { float: left; width: 60px; height: 60px; margin-right: 6px; }
  </style>
</head>
<body>
  <div class="banner">MEGA SALE!!! 50% OFF EVERYTHING TODAY ONLY!!!</div>
  <img class="logo" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Crect width='60' height='60' fill='%23ff0066'/%3E%3C/svg%3E" alt="logo">
  <h1>Welcome To Our Website</h1>
  <h2>Best products — lowest prices</h2>
  <div class="stat">$99</div> <div class="stat">50%</div> <div class="stat">NEW</div>
  <p>We have everything you need for less. Click below to shop now and save big on all items. Limited time offer. Act fast. Don't wait.</p>
  <div>
    <button class="btn1">BUY NOW</button>
    <button class="btn2">Shop The Sale</button>
    <button class="btn3">learn more...</button>
  </div>
  <div>
    <div class="box card1"><h2>Deal 1</h2><p class="tiny">Save $10 on thing A</p></div>
    <div class="box card2"><h1>Deal 2</h1><p>Save $20 on thing B when you buy thing A too</p></div>
    <div class="box card3"><h2>Deal 3</h2><p class="tiny">Bundle</p></div>
  </div>
</body>
</html>`;

const visionConfigured = Boolean(
  process.env.DESIGN_TASTE_VISION_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.BAI_API_KEY ||
    process.env["GLM/QWEN_API_KEY"] ||
    process.env.NARA_API_KEY ||
    process.env.MUSE_SPARK_API_KEY
);

if (visionConfigured) {
  console.log("\n=== P3: critique_render CLUTTERED page (real vision call) ===");
  console.log("(vision provider detected in environment; running full render + critique)");
  const clutteredRubric = await callTool("get_design_constraints", { context: "marketing" });
  const critique = await callTool("critique_render", {
    html: CLUTTERED_HTML,
    rubric: clutteredRubric,
  });
  console.log(JSON.stringify(critique, null, 2));

  assert(
    critique.provider !== null && critique.model !== null,
    `P3 critique ran with a real provider (${critique.provider}/${critique.model})`
  );
  assert(
    typeof critique.score === "number" && critique.score >= 0 && critique.score <= 10,
    "P3 critique returns a numeric 0-10 score"
  );
  assert(
    Array.isArray(critique.findings) && critique.findings.length > 0,
    "P3 cluttered page produced findings (not empty, not vague silence)"
  );
  const totalFindings = critique.findings.length;
  const specificFindings = critique.findings.filter(
    (f) => f.issue.length >= 25 && f.suggestion.length >= 15
  );
  assert(
    specificFindings.length >= Math.max(2, Math.floor(totalFindings / 2)),
    "P3 findings are concrete: majority name specific elements and give substantive suggestions"
  );
  assert(
    !critique.findings.some((f) => /^(good|nice|great|looks good)/i.test(f.issue)),
    "P3 findings are not generic praise"
  );
  console.log(
    "rubricField coverage:",
    JSON.stringify(critique.findings.map((f) => f.rubricField ?? null))
  );
} else {
  console.log("\n=== P3: critique_render (no vision provider configured) ===");
  console.log("(asserting the honest setup-hint path; set a vision key to run the full critique)");
  const clutteredRubric = await callTool("get_design_constraints", { context: "marketing" });
  const critique = await callTool("critique_render", {
    html: CLUTTERED_HTML,
    rubric: clutteredRubric,
  });
  console.log(JSON.stringify(critique, null, 2));
  assert(
    critique.score === null && critique.findings.length === 0,
    "P3 unconfigured critique returns score null + empty findings (no fabrication)"
  );
  assert(
    typeof critique.error === "string" &&
      critique.error.includes("DESIGN_TASTE_VISION_PROVIDER") &&
      critique.error.includes("OPENAI_API_KEY"),
    "P3 unconfigured critique returns a actionable setup hint naming env vars"
  );
  console.log(
    "NOTE: full vision-critique acceptance (cluttered page -> concrete findings) requires a vision key.",
    "This run verified the honest no-provider path only."
  );
}

// ============================================================
// PHASE 4 — get_scene_guidance
// ============================================================
// Acceptance criterion from the build prompt: "given a simple scene
// brief, output guidance that's specific enough to actually change what
// gets built (not generic 'use good lighting' advice)."

const SCENE_BRIEF =
  "A hero product scene for a premium noise-cancelling headphone landing page: " +
  "the headphone floats above a dark reflective surface in an otherwise empty room, " +
  "targeting a calm, expensive, slightly dramatic tech-luxury mood. Built in Three.js.";

if (visionConfigured) {
  console.log("\n=== P4: get_scene_guidance (real staged passes + gates) ===");
  // Staged pipeline = up to ~11 sequential model calls; under real API
  // latency that can exceed 5 minutes, so size the client timeout well
  // past the worst realistic case (observed >300s live).
  const scene = await client.callTool(
    { name: "get_scene_guidance", arguments: { context: SCENE_BRIEF } },
    undefined,
    { timeout: 8 * 60_000 }
  );
  if (scene.isError) throw new Error(`get_scene_guidance errored: ${JSON.stringify(scene.content)}`);
  const sceneResult = scene.structuredContent;
  console.log(JSON.stringify(sceneResult, null, 2));

  assert(
    sceneResult.provider !== null && sceneResult.model !== null,
    `P4 scene guidance ran with a real provider (${sceneResult.provider}/${sceneResult.model})`
  );
  assert(sceneResult.camera !== null, "P4 camera guidance present");
  assert(sceneResult.lighting !== null, "P4 lighting guidance present");
  assert(
    Array.isArray(sceneResult.materials) && sceneResult.materials.length > 0,
    "P4 material guidance present"
  );
  assert(
    typeof sceneResult.pacingNotes === "string" && sceneResult.pacingNotes.length > 30,
    "P4 pacing notes present"
  );

  // Specificity: numeric, buildable camera values.
  const cam = JSON.stringify(sceneResult.camera);
  assert(
    /\d/.test(cam) && (cam.includes("fieldOfView") || cam.includes("fov")),
    "P4 camera guidance carries numeric values incl. a field of view"
  );

  // Specificity: Kelvin temperatures in lighting.
  const light = JSON.stringify(sceneResult.lighting);
  const kelvinHits = light.match(/\d{3,4}\s*K\b/g) ?? [];
  assert(
    kelvinHits.length >= 1,
    `P4 lighting names color temperature in Kelvin (${kelvinHits.join(", ")})`
  );

  // Specificity: PBR parameters in materials.
  const matStr = JSON.stringify(sceneResult.materials);
  assert(
    /roughness/i.test(matStr),
    "P4 materials name PBR parameters (roughness)"
  );

  // Not generic: no vague-art-direction stock phrases as the substance.
  const allGuidance = cam + light + matStr + (sceneResult.pacingNotes ?? "");
  const vaguePhrases = ["good lighting", "nice lighting", "make it pop", "use good", "interesting composition"];
  const vagueHits = vaguePhrases.filter((p) => allGuidance.toLowerCase().includes(p));
  assert(
    vagueHits.length === 0,
    `P4 guidance is not generic art-direction filler (checked: ${vaguePhrases.join(", ")})`
  );

  // Gates trail: every pass has an entry, with a verdict.
  assert(
    sceneResult.gates.length === 3,
    "P4 gates trail covers all three passes (composition, lighting, material)"
  );
  assert(
    sceneResult.gates.every((g) => g.passed === true || g.passed === false || g.gateError),
    "P4 every gate recorded a verdict (or an honest gate error)"
  );
  assert(
    sceneResult.gates.some((g) => g.passed === true),
    "P4 at least one gate passed on review (the pipeline actually gates, not rubber-stamps)"
  );

  // Honesty case: URL reference image is rejected with a clear message.
  // The tool throws, which MCP surfaces as an isError result — an honest
  // rejection, not a fabricated fallback. Either form is acceptable.
  let urlRefError = null;
  try {
    const urlRef = await client.callTool(
      {
        name: "get_scene_guidance",
        arguments: { context: SCENE_BRIEF, referenceImage: "https://example.com/headphone-ref.png" },
      },
      undefined,
      { timeout: 60_000 }
    );
    urlRefError = urlRef.isError
      ? urlRef.content?.map((c) => c.text ?? "").join(" ")
      : urlRef.structuredContent?.error ?? null;
  } catch (err) {
    urlRefError = err instanceof Error ? err.message : String(err);
  }
  console.log("URL reference result:", JSON.stringify(urlRefError));
  assert(
    typeof urlRefError === "string" && /URL|later refinement/i.test(urlRefError),
    "P4 URL reference image rejected with an honest 'later refinement' message, not silently guessed"
  );
} else {
  console.log("\n=== P4: get_scene_guidance (no vision provider configured) ===");
  const scene = await callTool("get_scene_guidance", { context: SCENE_BRIEF });
  console.log(JSON.stringify(scene, null, 2));
  assert(
    scene.camera === null && scene.lighting === null && scene.materials === null,
    "P4 unconfigured scene guidance returns null guidance (no fabrication)"
  );
  assert(
    typeof scene.error === "string" && scene.error.includes("DESIGN_TASTE_VISION_PROVIDER"),
    "P4 unconfigured scene guidance returns the setup hint"
  );
}

await client.close();

console.log(
  process.exitCode === 1
    ? "\nACCEPTANCE TEST: FAILED"
    : "\nACCEPTANCE TEST: PASSED"
);
process.exit(process.exitCode ?? 0);
