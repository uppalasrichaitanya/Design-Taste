/**
 * Button variants — kokonutui-inspired (React + Tailwind class-based
 * styling, small focused variants). Component concept adapted from
 * github.com/kokonutui (see repo for license); code written for this
 * project.
 */

import type { ComponentVariant } from "./types.js";

export const BUTTONS: ComponentVariant[] = [
  {
    id: "button-primary",
    family: "button",
    name: "Primary button",
    description:
      "Solid accent-filled action button for the main action on a view. Rounded-full, medium emphasis, hover darkens.",
    code: `import { type ButtonHTMLAttributes } from "react";

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function PrimaryButton({ label, className = "", ...rest }: PrimaryButtonProps) {
  return (
    <button
      className={
        "inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 " +
        "text-sm font-medium text-white transition-colors duration-200 " +
        "hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 " +
        className
      }
      {...rest}
    >
      {label}
    </button>
  );
}`,
    dependencies: [],
    tags: ["button", "primary", "cta", "action", "solid", "form-submit", "marketing"],
    source: "kokonutui-inspired",
  },
  {
    id: "button-secondary",
    family: "button",
    name: "Secondary button",
    description:
      "Bordered, transparent-background button for secondary actions. Same geometry as primary so they pair in a row.",
    code: `import { type ButtonHTMLAttributes } from "react";

interface SecondaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function SecondaryButton({ label, className = "", ...rest }: SecondaryButtonProps) {
  return (
    <button
      className={
        "inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 bg-transparent px-5 py-2.5 " +
        "text-sm font-medium text-gray-700 transition-colors duration-200 " +
        "hover:border-gray-400 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 " +
        className
      }
      {...rest}
    >
      {label}
    </button>
  );
}`,
    dependencies: [],
    tags: ["button", "secondary", "outline", "action", "cancel", "pair"],
    source: "kokonutui-inspired",
  },
  {
    id: "button-icon",
    family: "button",
    name: "Icon button",
    description:
      "Square icon-only button for toolbars and compact actions. Requires an aria-label for accessibility.",
    code: `import { type ButtonHTMLAttributes, type ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons must name their action for screen readers. */
  "aria-label": string;
  children: ReactNode;
}

export function IconButton({ children, className = "", ...rest }: IconButtonProps) {
  return (
    <button
      className={
        "inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-600 " +
        "transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900 " +
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 " +
        className
      }
      {...rest}
    >
      {children}
    </button>
  );
}`,
    dependencies: [],
    tags: ["button", "icon", "toolbar", "compact", "action", "close", "menu"],
    source: "kokonutui-inspired",
  },
];
