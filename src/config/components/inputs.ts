/**
 * Input variants — kokonutui-inspired (React + Tailwind). The floating
 * label variant follows the pattern of animating the label into the
 * border on focus/value; implemented here with plain CSS transitions.
 * Component concept adapted from github.com/kokonutui; code written for
 * this project.
 */

import type { ComponentVariant } from "./types.js";

export const INPUTS: ComponentVariant[] = [
  {
    id: "input-basic",
    family: "input",
    name: "Basic text input",
    description:
      "Labeled text field with focus ring. Label is a real <label> element, not a placeholder, for accessibility.",
    code: `import { type InputHTMLAttributes, useId } from "react";

interface BasicInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function BasicInput({ label, className = "", id, ...rest }: BasicInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={inputId}
        className={
          "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 " +
          "focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 " +
          className
        }
        {...rest}
      />
    </div>
  );
}`,
    dependencies: [],
    tags: ["input", "text", "form", "field", "labeled"],
    source: "kokonutui-inspired",
  },
  {
    id: "input-error",
    family: "input",
    name: "Input with error state",
    description:
      "Text field with an inline error message and aria-invalid wiring. Error styling replaces (not stacks on) the focus ring.",
    code: `import { type InputHTMLAttributes, useId } from "react";

interface ErrorInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** When non-empty, the field renders the error state. */
  error?: string;
}

export function ErrorInput({ label, error, className = "", id, ...rest }: ErrorInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = \`\${inputId}-error\`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={
          "rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 " +
          (error
            ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 "
            : "border-gray-300 focus:border-blue-600 focus:ring-blue-600/20 ") +
          className
        }
        {...rest}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}`,
    dependencies: [],
    tags: ["input", "error", "validation", "form", "field", "aria-invalid"],
    source: "kokonutui-inspired",
  },
  {
    id: "input-floating-label",
    family: "input",
    name: "Floating label input",
    description:
      "Border-integrated label that floats up on focus or when filled, driven by peer CSS classes; no JS state tracking.",
    code: `import { type InputHTMLAttributes, useId } from "react";

interface FloatingLabelInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function FloatingLabelInput({ label, className = "", id, ...rest }: FloatingLabelInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="relative">
      <input
        id={inputId}
        placeholder=" "
        className={
          "peer rounded-lg border border-gray-300 bg-white px-3 pb-2 pt-5 text-sm text-gray-900 placeholder:text-transparent " +
          "focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 " +
          className
        }
        {...rest}
      />
      <label
        htmlFor={inputId}
        className="pointer-events-none absolute left-3 top-2 text-xs text-gray-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-blue-600"
      >
        {label}
      </label>
    </div>
  );
}`,
    dependencies: [],
    tags: ["input", "floating-label", "form", "field", "material", "compact"],
    source: "kokonutui-inspired",
  },
];
