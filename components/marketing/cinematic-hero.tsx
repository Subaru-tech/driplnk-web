import { Printer } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PrintCanvas } from "@/components/marketing/print-canvas";

/**
 * Full-viewport hero. Layered back to front:
 *   void backdrop → drifting rim lights → the printer → vignette →
 *   text scrim → copy.
 *
 * The machine stays centred as a background element rather than taking a
 * whole column. Legibility over it comes from a radial scrim behind the copy,
 * not from pushing the machine aside.
 *
 * There is deliberately no page-wide grid: the only grid in the scene is the
 * printer's own build surface, directly under the robot.
 */
export function CinematicHero() {
  return (
    <section className="relative flex min-h-svh flex-col justify-between pt-20 sm:pt-24 lg:pt-20 pb-8 sm:pb-12 lg:pb-10 overflow-hidden bg-void">
      {/* Key + fill lights, drifting slowly so a still frame never feels dead */}
      <div
        aria-hidden="true"
        className="glow-accent drift absolute top-0 left-1/2 aspect-square w-[80vw] max-w-4xl -translate-x-1/2 opacity-40 pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="glow-accent-2 absolute -bottom-1/4 left-1/2 aspect-square w-[70vw] max-w-3xl -translate-x-1/2 opacity-50 pointer-events-none"
      />

      {/* The machine, printing. Full opacity */}
      <PrintCanvas className="absolute inset-0 size-full pointer-events-none" />

      {/* Seat it into the page */}
      <div aria-hidden="true" className="vignette absolute inset-0 pointer-events-none" />

      {/* Main hero content: headline on the left, 3D printer CTA on the right */}
      <div className="relative z-10 mx-auto flex w-full max-w-content flex-1 flex-col justify-center px-6 lg:px-12 py-8 lg:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center flex-1">
          {/* Left Column: Headline, subtext, actions, and trust metrics */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left py-4 sm:py-6">
            <div className="hero-pull inline-flex items-center gap-2 rounded-full border border-line-control bg-surface/60 px-3.5 py-1 text-xs font-mono text-accent-2 mb-4 sm:mb-6 backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-accent-2 animate-pulse" />
              <span>Idea &nbsp;→&nbsp; Geometry &nbsp;→&nbsp; Part</span>
            </div>

            <h1 className="hero-pull display-xl font-display text-balance text-fg lg:text-pretty">
              One-stop platform
              <br className="hidden lg:inline" />
              {" "}for turning ideas
              <br className="hidden lg:inline" />
              {" "}<span className="text-accent-gradient">into products.</span>
            </h1>

            <p className="hero-pull mt-4 sm:mt-6 max-w-lg text-base sm:text-lg text-pretty text-muted">
              Design, build, source, and manufacture — without the friction.
            </p>

            <div className="hero-pull mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <ButtonLink href="/sign-up" size="lg">
                Sign Up
              </ButtonLink>
              <ButtonLink href="#how-driplink-works" variant="ghost" size="lg">
                See how it works
              </ButtonLink>
            </div>

            {/* Value props & trust metrics */}
            <div className="hero-pull mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-line-control/60 grid grid-cols-3 gap-4 sm:gap-6 w-full max-w-lg">
              <div>
                <div className="font-mono text-lg sm:text-xl font-bold text-fg">±0.05<span className="text-accent">mm</span></div>
                <div className="text-xs text-muted mt-1">Tolerance fit</div>
              </div>
              <div>
                <div className="font-mono text-lg sm:text-xl font-bold text-fg">500<span className="text-accent">+</span></div>
                <div className="text-xs text-muted mt-1">Vetted print farms</div>
              </div>
              <div>
                <div className="font-mono text-lg sm:text-xl font-bold text-fg">&lt; 24<span className="text-accent">h</span></div>
                <div className="text-xs text-muted mt-1">Average dispatch</div>
              </div>
            </div>
          </div>

          {/* Right Column: CTA centered directly beneath the 3D printer */}
          <div className="lg:col-span-5 self-stretch flex flex-col items-center justify-end pt-4 lg:pt-0">
            <div className="hero-pull flex flex-col items-center gap-2 mt-auto pb-4 lg:pb-6">
              <ButtonLink
                href="/mart"
                size="lg"
                className="group relative flex items-center gap-2.5 px-8 py-3.5 text-base font-semibold shadow-2xl backdrop-blur-md bg-surface/90 hover:bg-surface border border-line-control hover:border-accent text-fg transition-all rounded-xl hover:scale-[1.02]"
              >
                <Printer className="size-4 text-accent transition-transform group-hover:scale-110" aria-hidden="true" />
                <span>Get a Print Quote</span>
                <span className="text-accent text-xs font-mono px-2 py-0.5 rounded bg-accent/15 border border-accent/25 ml-1">Instant</span>
              </ButtonLink>
              <span className="text-[11px] font-mono text-muted/70 tracking-wide">
                Upload STL, STEP, or 3MF • Live vendor pricing
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
