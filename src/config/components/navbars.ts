/**
 * Navbar variants — kokonutui-inspired (React + Tailwind). The
 * responsive variant implements a mobile drawer with a hamburger button
 * revealing the nav links. Component concept adapted from
 * github.com/kokonutui; code written for this project.
 */

import type { ComponentVariant } from "./types.js";

export const NAVBARS: ComponentVariant[] = [
  {
    id: "navbar-simple",
    family: "navbar",
    name: "Simple navbar",
    description:
      "Logo left, nav links center/right, CTA slot on the far right. Sticky with a translucent backdrop blur.",
    code: `import { type ReactNode } from "react";

interface SimpleNavbarProps {
  logo: ReactNode;
  links: { label: string; href: string }[];
  cta?: ReactNode;
}

export function SimpleNavbar({ logo, links, cta }: SimpleNavbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-4">
        <a href="/" className="flex items-center font-semibold text-gray-900">
          {logo}
        </a>
        <ul className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-full px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        {cta && <div className="flex items-center gap-2">{cta}</div>}
      </nav>
    </header>
  );
}`,
    dependencies: [],
    tags: ["navbar", "header", "navigation", "sticky", "links", "top", "menu"],
    source: "kokonutui-inspired",
  },
  {
    id: "navbar-responsive",
    family: "navbar",
    name: "Responsive navbar with mobile menu",
    description:
      "Desktop links collapse into a slide-down mobile panel behind a hamburger button. Includes aria-expanded wiring.",
    code: `import { useState, type ReactNode } from "react";

interface ResponsiveNavbarProps {
  logo: ReactNode;
  links: { label: string; href: string }[];
  cta?: ReactNode;
}

export function ResponsiveNavbar({ logo, links, cta }: ResponsiveNavbarProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-4">
        <a href="/" className="flex items-center font-semibold text-gray-900">
          {logo}
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-full px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          {cta && <div className="hidden md:block">{cta}</div>}
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 md:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-nav" className="border-t border-gray-200 bg-white px-4 pb-4 md:hidden">
          <ul className="flex flex-col gap-1 pt-2">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  {link.label}
                </a>
              </li>
            ))}
            {cta && <li className="pt-2">{cta}</li>}
          </ul>
        </div>
      )}
    </header>
  );
}`,
    dependencies: [],
    tags: ["navbar", "header", "navigation", "responsive", "mobile", "hamburger", "drawer"],
    source: "kokonutui-inspired",
  },
];
