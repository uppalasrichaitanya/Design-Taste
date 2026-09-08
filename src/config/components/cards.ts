/**
 * Card variants — kokonutui-inspired (React + Tailwind). Card-in-card
 * nesting is deliberately avoided (it's an anti-pattern in impeccable's
 * spirit); variants differentiate via surface treatment instead.
 * Component concept adapted from github.com/kokonutui; code written for
 * this project.
 */

import type { ComponentVariant } from "./types.js";

export const CARDS: ComponentVariant[] = [
  {
    id: "card-basic",
    family: "card",
    name: "Basic card",
    description:
      "Plain bordered surface with padding and a content slot. The workhorse for grouping related content.",
    code: `import { type ReactNode } from "react";

interface BasicCardProps {
  children: ReactNode;
  className?: string;
}

export function BasicCard({ children, className = "" }: BasicCardProps) {
  return (
    <div
      className={
        "rounded-xl border border-gray-200 bg-white p-6 " + className
      }
    >
      {children}
    </div>
  );
}`,
    dependencies: [],
    tags: ["card", "container", "surface", "grouping", "content", "dashboard"],
    source: "kokonutui-inspired",
  },
  {
    id: "card-feature",
    family: "card",
    name: "Feature card",
    description:
      "Marketing card with icon, title, and body. Top-aligned icon, no gradient. Use for feature grids and pricing-tier highlights.",
    code: `import { type ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}

export function FeatureCard({ icon, title, children, className = "" }: FeatureCardProps) {
  return (
    <div
      className={
        "flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-6 " + className
      }
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        {icon}
      </span>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <div className="text-sm leading-relaxed text-gray-600">{children}</div>
    </div>
  );
}`,
    dependencies: [],
    tags: ["card", "feature", "marketing", "grid", "icon", "pricing"],
    source: "kokonutui-inspired",
  },
  {
    id: "card-stat",
    family: "card",
    name: "Stat card",
    description:
      "Dashboard metric card: label, big number, delta with direction arrow. Compact and information-dense.",
    code: `interface StatCardProps {
  label: string;
  value: string;
  /** Signed change, e.g. "+12.4%" or "-3.1%"; direction controls the arrow. */
  delta: string;
  className?: string;
}

export function StatCard({ label, value, delta, className = "" }: StatCardProps) {
  const up = delta.trim().startsWith("+");
  return (
    <div
      className={"flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-4 " + className}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums text-gray-900">{value}</span>
      <span
        className={
          "inline-flex items-center gap-1 text-xs font-medium " +
          (up ? "text-emerald-600" : "text-rose-600")
        }
      >
        {up ? "\u2191" : "\u2193"} {delta}
      </span>
    </div>
  );
}`,
    dependencies: [],
    tags: ["card", "stat", "metric", "kpi", "dashboard", "number", "analytics"],
    source: "kokonutui-inspired",
  },
];
