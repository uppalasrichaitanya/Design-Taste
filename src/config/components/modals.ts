/**
 * Modal/Dialog variants — kokonutui-inspired. The animated variant uses
 * Motion (motion.dev) for the open/close transition, mirroring
 * kokonutui's React + Tailwind + Motion stack. Component concept adapted
 * from github.com/kokonutui; code written for this project.
 */

import type { ComponentVariant } from "./types.js";

export const MODALS: ComponentVariant[] = [
  {
    id: "modal-basic",
    family: "modal",
    name: "Basic modal",
    description:
      "Controlled modal with backdrop, escape-to-close, and focus-return. No animation library; CSS transitions only.",
    code: `import { useEffect, useRef, type ReactNode } from "react";

interface BasicModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function BasicModal({ open, onClose, title, children }: BasicModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    dialogRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl focus:outline-none"
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
        <div className="text-sm text-gray-600">{children}</div>
      </div>
    </div>
  );
}`,
    dependencies: [],
    tags: ["modal", "dialog", "overlay", "confirmation", "form", "popup"],
    source: "kokonutui-inspired",
  },
  {
    id: "modal-animated",
    family: "modal",
    name: "Animated modal (Motion)",
    description:
      "Same structure as the basic modal, with a spring open/close transition powered by Motion. Backdrop fades, panel scales in.",
    code: `import { useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

interface AnimatedModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function AnimatedModal({ open, onClose, title, children }: AnimatedModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    dialogRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl focus:outline-none"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
            <div className="text-sm text-gray-600">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}`,
    dependencies: ["motion"],
    tags: ["modal", "dialog", "animated", "motion", "spring", "overlay", "popup"],
    source: "kokonutui-inspired",
  },
];
