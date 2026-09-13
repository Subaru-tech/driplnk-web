"use client";

import { cn } from "@/lib/cn";

/**
 * Theme toggle — a sliding pill with the printed-cube motif.
 *
 * The current theme lives on `<html data-theme>`, set before first paint by
 * ThemeScript. Knob position and icon swap are both driven from that attribute
 * in CSS, so this component holds no React state: no mount effect, no flash of
 * the wrong position, and nothing for hydration to disagree about.
 *
 * Both icons sit dimmed in the track and the knob slides over the active one,
 * carrying a lit copy — so the control reads as a switch with a state, not as
 * a button that happens to change glyph.
 */

/** Isometric cube — a printed part. Used for the dark side. */
function Cube({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3.2 19.5 7.6v8.8L12 20.8 4.5 16.4V7.6L12 3.2Z" />
      <path d="M12 12.2v8.6M4.5 7.6 12 12.2l7.5-4.6" />
    </svg>
  );
}

/** The same cube under workshop light — rays make the light side legible. */
function CubeLit({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 6.6 17.2 9.7v6.2L12 19l-5.2-3.1V9.7L12 6.6Z" />
      <path d="M12 12.8v6.2M6.8 9.7l5.2 3.1 5.2-3.1" />
      <path d="M12 1.6v2.2M20.8 6.6l-1.9 1.1M20.8 18.4l-1.9-1.1M3.2 6.6l1.9 1.1M3.2 18.4l1.9-1.1" />
    </svg>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem("driplnk-theme", next);
    } catch {
      /* storage blocked — the theme still applies for this page load */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light and dark theme"
      title="Toggle light and dark theme"
      className={cn(
        "relative inline-flex h-8 w-16 shrink-0 items-center rounded-full",
        "border border-line-control bg-raised p-1 transition-colors",
        "hover:border-line-strong",
        className,
      )}
    >
      {/* Dimmed icons in the track, one per side. */}
      <span className="pointer-events-none absolute inset-y-0 left-0 grid w-8 place-items-center text-faint">
        <CubeLit className="size-4" />
      </span>
      <span className="pointer-events-none absolute inset-y-0 right-0 grid w-8 place-items-center text-faint">
        <Cube className="size-4" />
      </span>

      {/* Knob slides to the active side and carries the lit icon. */}
      <span className="theme-knob relative z-10 grid size-6 place-items-center rounded-full bg-surface">
        <CubeLit className="theme-icon-light size-4" />
        <Cube className="theme-icon-dark size-4" />
      </span>
    </button>
  );
}
