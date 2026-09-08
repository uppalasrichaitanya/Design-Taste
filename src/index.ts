#!/usr/bin/env node

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  GetDesignConstraintsInput,
  buildRubric,
} from "./tools/getDesignConstraints.js";
import {
  RunStaticChecksInput,
  runStaticChecks,
} from "./tools/runStaticChecks.js";
import {
  SearchComponentsInput,
  searchComponents,
} from "./tools/searchComponents.js";
import {
  GetStyleReferenceInput,
  getStyleReference,
} from "./tools/getStyleReference.js";
import {
  GetMotionPresetInput,
  getMotionPreset,
} from "./tools/getMotionPreset.js";
import {
  CritiqueRenderInput,
  critiqueRender,
} from "./tools/critiqueRender.js";
import {
  GetSceneGuidanceInput,
  getSceneGuidance,
} from "./tools/getSceneGuidance.js";

const RubricOutput = z.object({
  context: z.string(),
  dials: z.object({
    variance: z.number(),
    motion: z.number(),
    density: z.number(),
  }),
  spacingScale: z.object({
    unit: z.string(),
    base: z.number(),
    multipliers: z.array(z.number()),
  }),
  maxFontWeights: z.number(),
  maxFontFamilies: z.number(),
  maxAccentColors: z.number(),
  contrastMinimum: z.number(),
  motion: z.object({
    durationMs: z.tuple([z.number(), z.number()]),
    easings: z.array(z.string()),
  }),
});

const FindingsOutput = z.object({
  findings: z.array(
    z.object({
      rule: z.string(),
      severity: z.enum(["error", "warning"]),
      message: z.string(),
      location: z.string().optional(),
    })
  ),
});

const server = new McpServer({
  name: "design-taste-mcp",
  version: "0.1.0",
});

server.registerTool(
  "get_design_constraints",
  {
    title: "Get design constraints",
    description:
      "Get a structured design rubric (spacing scale, max font weights/families, max accent colors, contrast minimum, motion duration/easing range) for a UI context. The three optional dials (variance, motion, density, each 1-10) default sensibly per context — e.g. marketing defaults to high variance/low density, dashboard the reverse.",
    inputSchema: GetDesignConstraintsInput,
    outputSchema: RubricOutput,
  },
  async (args) => {
    const rubric = buildRubric(args);
    return {
      content: [{ type: "text", text: JSON.stringify(rubric, null, 2) }],
      structuredContent: rubric,
    };
  }
);

server.registerTool(
  "run_static_checks",
  {
    title: "Run static design checks",
    description:
      "Run deterministic design + accessibility checks on HTML or JSX source. Returns a list of findings (rule, severity, message, location) — or an empty list if the code is clean. Checks: axe-core accessibility (html format only), font-weight/font-family/accent-color sprawl, em-dash presence. Optionally pass a rubric (the output of get_design_constraints) to check against context-specific limits instead of the defaults; without one, default limits apply. No findings are fabricated: clean input returns an empty array.",
    inputSchema: RunStaticChecksInput,
    outputSchema: FindingsOutput,
  },
  async (args) => {
    const findings = await runStaticChecks(args);
    return {
      content: [{ type: "text", text: JSON.stringify(findings, null, 2) }],
      structuredContent: { findings },
    };
  }
);

const ComponentMatchOutput = z.object({
  name: z.string(),
  description: z.string(),
  code: z.string(),
  dependencies: z.array(z.string()),
});

const StyleReferenceOutput = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  moods: z.array(z.string()),
  designVariance: z.number(),
  palette: z.array(
    z.object({ name: z.string(), value: z.string(), usage: z.string() })
  ),
  typeScale: z.array(
    z.object({
      name: z.string(),
      size: z.string(),
      weight: z.number(),
      lineHeight: z.string().optional(),
      usage: z.string().optional(),
    })
  ),
  voice: z.string(),
  source: z.string().optional(),
});

server.registerTool(
  "search_components",
  {
    title: "Search components",
    description:
      "Search a curated local registry of real, runnable React + Tailwind component variants (buttons, cards, modals, inputs, navbars, badges — kokonutui-inspired, code written for this project). Returns name, description, runnable code, and dependencies for each match, best matches first. An optional style hint biases ranking. Returns an empty array when nothing matches — widen the query rather than expecting a fallback.",
    inputSchema: SearchComponentsInput,
    outputSchema: z.object({ components: z.array(ComponentMatchOutput) }),
  },
  async (args) => {
    const components = searchComponents(args);
    return {
      content: [{ type: "text", text: JSON.stringify(components, null, 2) }],
      structuredContent: { components },
    };
  }
);

server.registerTool(
  "get_style_reference",
  {
    title: "Get style reference",
    description:
      "Resolve a brand or mood phrase (e.g. 'minimal', 'bold editorial', 'calm professional') to a DESIGN.md-style token profile: palette, type scale, and voice guidance. Seed profiles sit at opposite ends of the DESIGN_VARIANCE spectrum — clean-minimal (restrained, single accent) and bold-editorial (loud, typographic) — with no middle-ground default. Returns { styleReference: null } when nothing matches; try a different mood word rather than expecting a fallback.",
    inputSchema: GetStyleReferenceInput,
    outputSchema: z.object({ styleReference: StyleReferenceOutput.nullable() }),
  },
  async (args) => {
    const styleReference = getStyleReference(args);
    return {
      content: [
        {
          type: "text",
          text: styleReference === null ? "null" : JSON.stringify(styleReference, null, 2),
        },
      ],
      structuredContent: { styleReference },
    };
  }
);

const MotionPresetOutput = z.object({
  id: z.string(),
  interaction: z.string(),
  aliases: z.array(z.string()),
  duration: z.number().optional(),
  easing: z.union([z.string(), z.array(z.number())]).optional(),
  spring: z
    .object({
      damping: z.number(),
      mass: z.number().optional(),
      stiffness: z.number().optional(),
      bounce: z.number().optional(),
    })
    .optional(),
  properties: z.array(z.string()),
  notes: z.string(),
  source: z.string().optional(),
});

const MotionPresetResult = z.object({ motionPreset: MotionPresetOutput.nullable() });

const CritiqueFindingOutput = z.object({
  issue: z.string(),
  severity: z.string(),
  suggestion: z.string(),
  rubricField: z.string().optional(),
});

const CritiqueResultOutput = z.object({
  score: z.number().nullable(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  findings: z.array(CritiqueFindingOutput),
  error: z.string().optional(),
  rawResponse: z.string().optional(),
});

server.registerTool(
  "get_motion_preset",
  {
    title: "Get motion preset",
    description:
      "Resolve an interaction (hover, modal-open, page-transition, scroll-reveal, or a phrase like 'hover scale') to a motion preset grounded in Motion's (motion.dev) documented API: tween presets give duration (seconds) + easing; spring presets give physics params (damping/mass/stiffness) — Motion overrides time options when physics is set, so spring presets honestly carry no duration/easing. Values are traceable to motion.dev docs; notes cite sources. Returns { motionPreset: null } for unknown interactions.",
    inputSchema: GetMotionPresetInput,
    outputSchema: MotionPresetResult,
  },
  async (args) => {
    const motionPreset = getMotionPreset(args);
    return {
      content: [
        { type: "text", text: motionPreset === null ? "null" : JSON.stringify(motionPreset, null, 2) },
      ],
      structuredContent: { motionPreset },
    };
  }
);

server.registerTool(
  "critique_render",
  {
    title: "Critique render",
    description:
      "Render HTML in headless Chromium (Playwright), screenshot it, and have a vision-capable model score it against a rubric (pass the output of get_design_constraints as rubric). Returns { score (0-10), provider, model, findings[] } with findings tied to specific elements and rubric fields — or an empty findings array if the page satisfies the rubric. Requires a vision provider configured via environment (DESIGN_TASTE_VISION_PROVIDER + key, or OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY / GOOGLE_API_KEY) and Playwright chromium installed; when unconfigured it returns a setup hint instead of guessing.",
    inputSchema: CritiqueRenderInput,
    outputSchema: CritiqueResultOutput,
  },
  async (args) => {
    const result = await critiqueRender(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  }
);

const SceneGateEntryOutput = z.object({
  passId: z.string(),
  title: z.string(),
  passed: z.boolean().nullable(),
  gaps: z.array(z.string()),
  selfCorrected: z.boolean(),
  gateError: z.string().optional(),
});

const SceneGuidanceOutput = z.object({
  camera: z.record(z.string(), z.unknown()).nullable(),
  lighting: z.record(z.string(), z.unknown()).nullable(),
  materials: z.array(z.record(z.string(), z.unknown())).nullable(),
  pacingNotes: z.string().nullable(),
  gates: z.array(SceneGateEntryOutput),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  error: z.string().optional(),
});

server.registerTool(
  "get_scene_guidance",
  {
    title: "Get scene guidance",
    description:
      "Generate staged art direction for a 3D/spatial scene (Three.js/WebGL): three gated passes — composition (camera position/target/FOV, framing, focal point), lighting/mood (key/fill/rim with directions, Kelvin temperatures, contrast ratios), material/detail (PBR parameters per element, texture density, pacing). A reviewer model gates each pass against strict criteria and self-corrects once on failure; the full gates trail is returned. Optional reference image as base64/data-URI. Requires a vision provider configured via environment; when unconfigured it returns a setup hint with null guidance instead of guessing.",
    inputSchema: GetSceneGuidanceInput,
    outputSchema: SceneGuidanceOutput,
  },
  async (args) => {
    const result = await getSceneGuidance(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
