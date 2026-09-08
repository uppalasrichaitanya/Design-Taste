/**
 * Badge variants — kokonutui-inspired (React + Tailwind). Small status
 * and count indicators. Component concept adapted from
 * github.com/kokonutui; code written for this project.
 */

import type { ComponentVariant } from "./types.js";

export const BADGES: ComponentVariant[] = [
  {
    id: "badge-status",
    family: "badge",
    name: "Status badge",
    description:
      "Colored dot + label pill for statuses (success, warning, error, neutral). Semantic colors, one accent per state.",
    code: `type Status = "success" | "warning" | "error" | "neutral";

const STATUS_STYLES: Record<Status, { dot: string; badge: string }> = {
  success: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  warning: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700" },
  error: { dot: "bg-rose-500", badge: "bg-rose-50 text-rose-700" },
  neutral: { dot: "bg-gray-400", badge: "bg-gray-100 text-gray-600" },
};

interface StatusBadgeProps {
  status: Status;
  children: React.ReactNode;
}

export function StatusBadge({ status, children }: StatusBadgeProps) {
  const styles = STATUS_STYLES[status];
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium " +
        styles.badge
      }
    >
      <span className={\`h-1.5 w-1.5 rounded-full \${styles.dot}\`} aria-hidden="true" />
      {children}
    </span>
  );
}`,
    dependencies: [],
    tags: ["badge", "status", "pill", "label", "success", "error", "warning", "indicator"],
    source: "kokonutui-inspired",
  },
  {
    id: "badge-count",
    family: "badge",
    name: "Count badge",
    description:
      "Numeric counter pill for notifications and list positions. Caps display at 99+.",
    code: `interface CountBadgeProps {
  count: number;
  /** Screen-reader phrase spoken before the number, e.g. "unread notifications". */
  label: string;
}

export function CountBadge({ count, label }: CountBadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-xs font-semibold leading-5 text-white"
    >
      {count > 99 ? "99+" : count}
      <span className="sr-only">{label}</span>
    </span>
  );
}`,
    dependencies: [],
    tags: ["badge", "count", "notification", "counter", "unread", "indicator"],
    source: "kokonutui-inspired",
  },
  {
    id: "badge-tag",
    family: "badge",
    name: "Tag badge",
    description:
      "Neutral removable tag for filters and categorization. Optional remove button with aria-label.",
    code: `interface TagBadgeProps {
  children: React.ReactNode;
  onRemove?: () => void;
}

export function TagBadge({ children, onRemove }: TagBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-700">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={\`Remove \${typeof children === "string" ? children : "tag"}\`}
          className="-mr-1 rounded-full p-0.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </span>
  );
}`,
    dependencies: [],
    tags: ["badge", "tag", "filter", "chip", "removable", "category", "label"],
    source: "kokonutui-inspired",
  },
];
