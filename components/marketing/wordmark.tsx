import { cn } from "@/lib/cn";

/**
 * The DripLnk identity: a D/L monogram plus the wordmark.
 *
 * The mark is an interlocking ligature — the L's vertical stem doubles as the
 * D's spine, and the L sits in front where they cross. Rebuilt as vector paths
 * (rather than shipping the raster) so it stays crisp at every size, costs no
 * request, and can be drawn on canvas as well as in the DOM.
 *
 * COLOUR: fixed to the artwork's own two tones — white L + "Drip", black D +
 * "Link" — and deliberately NOT theme-derived, so the logo looks identical
 * everywhere. See `--logo-paper` / `--logo-ink` in globals.css. Note this
 * means the black half has very little contrast against dark surfaces; the
 * knockout alternative is to point the D at `currentColor` instead.
 */

export function DripLnkMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 61 68"
      fill="none"
      className={cn("h-6 w-auto", className)}
      aria-hidden="true"
    >
      {/* The D — drawn first so the L overlaps it, as in the artwork. */}
      <path
        d="M5 0 H35.2 A25.4 25.4 0 0 1 35.2 50.8 H5 Z
           M21.8 16.7 H33.7 A8.8 8.8 0 0 1 33.7 34.3 H21.8 Z"
        fillRule="evenodd"
        fill="var(--logo-ink)"
      />
      {/* The L — its stem crosses in front of the D's spine. */}
      <path d="M0 6.8 L15.5 20.7 V50.8 H56 V68 H0 Z" fill="var(--logo-paper)" />
    </svg>
  );
}

export function Wordmark({
  className,
  /** Monogram only — for the collapsed dashboard sidebar. */
  markOnly = false,
  /**
   * Marks this instance as the intro's landing pad. Exactly one Wordmark on a
   * page should set it (the nav's) — the footer and auth copies must not, or
   * the flying badge could measure the wrong one and the intro would hide
   * logos it never animates.
   */
  introTarget = false,
}: {
  className?: string;
  markOnly?: boolean;
  introTarget?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span {...(introTarget ? { "data-logo-target": "" } : {})} className="inline-flex">
        <DripLnkMark className={markOnly ? "h-7" : "h-6"} />
      </span>
      {markOnly ? null : (
        <span
          {...(introTarget ? { "data-logo-word": "" } : {})}
          className="font-display text-base font-semibold tracking-tight"
          style={{ color: "var(--logo-paper)" }}
        >
          Drip
          <span style={{ color: "var(--logo-ink)" }}>Lnk</span>
        </span>
      )}
    </span>
  );
}
