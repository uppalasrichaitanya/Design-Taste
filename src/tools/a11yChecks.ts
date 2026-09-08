/**
 * Accessibility pass: run axe-core against a jsdom-rendered document.
 * Per the Phase 1 decision, this only runs for format:"html" — JSX a11y
 * arrives in Phase 3 when Playwright can actually render components.
 *
 * Note: axe.run's context must be an Element (documentElement), not the
 * Document itself — a Document's ownerDocument is null, so axe cannot
 * deduce window/document globals from it.
 */

import { JSDOM, VirtualConsole } from "jsdom";
import axe from "axe-core";
import type { Finding } from "./types.js";

interface AxeViolation {
  id: string;
  help?: string;
  impact?: string;
  nodes: { target?: (string | HTMLElement)[] }[];
}

export async function runA11yChecks(html: string): Promise<Finding[]> {
  const virtualConsole = new VirtualConsole(); // swallow CSS parse noise from jsdom
  const dom = new JSDOM(html, { virtualConsole });
  const documentElement = dom.window.document.documentElement;

  const results = await new Promise<{ violations: AxeViolation[] }>((resolve, reject) => {
    axe.run(documentElement, {}, (err: Error | null, r: { violations: AxeViolation[] }) => {
      if (err) reject(err);
      else resolve(r);
    });
  });

  return results.violations.map((v) => {
    const nodes = v.nodes
      .map((n) => (n.target ?? []).map(String).join(" "))
      .filter(Boolean)
      .slice(0, 5);
    const severity: Finding["severity"] =
      v.impact === "critical" || v.impact === "serious" ? "error" : "warning";
    return {
      rule: `axe:${v.id}`,
      severity,
      message: v.help
        ? `${v.help}${nodes.length ? ` (element${nodes.length > 1 ? "s" : ""}: ${nodes.join(", ")})` : ""}`
        : `${v.id}${nodes.length ? ` (${nodes.join(", ")})` : ""}`,
      location: nodes[0],
    };
  });
}
