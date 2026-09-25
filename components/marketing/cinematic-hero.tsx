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

      {/* Main hero content: headline top-left, Get a Print Quote below printer on the right */}
      <div className="relative z-10 mx-auto flex w-full max-w-content flex-1 flex-col justify-between px-6 lg:px-12">
        {/* Upper content: Headline and primary actions */}
        <div className="flex flex-col items-center lg:items-start lg:max-w-[36rem] xl:max-w-[42rem] text-center lg:text-left pt-2 lg:pt-4">
          <p className="hero-pull tech-label mb-3 sm:mb-6 text-accent-2">
            Idea &nbsp;→&nbsp; Geometry &nbsp;→&nbsp; Part
          </p>

          <h1 className="hero-pull display-xl font-display text-balance text-fg lg:text-pretty">
            One-stop platform
            <br className="hidden lg:inline" />
            {" "}for turning ideas
            <br className="hidden lg:inline" />
            {" "}<span className="text-accent-gradient">into products.</span>
          </h1>

          <p className="hero-pull mt-4 sm:mt-8 max-w-md text-base sm:text-lg text-pretty text-muted">
            Design, build, source, and manufacture — without the friction.
          </p>

          <div className="hero-pull mt-6 sm:mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <ButtonLink href="/sign-up" size="lg">
              Sign Up
            </ButtonLink>
            <ButtonLink href="#how-driplink-works" variant="ghost" size="lg">
              See how it works
            </ButtonLink>
          </div>
        </div>

        {/* Bottom bar: Get a Print Quote placed directly below the 3D printer */}
        <div className="w-full flex justify-center lg:justify-end pt-8 pb-3 sm:pb-6">
          <div className="hero-pull w-full max-w-xs sm:w-auto lg:w-[44%] flex justify-center">
            <ButtonLink
              href="/mart"
              variant="secondary"
              size="lg"
              className="shadow-2xl backdrop-blur-md bg-surface/90 hover:bg-surface border-line-control hover:border-accent transition-all px-8 py-3 text-base"
            >
              <Printer className="size-4" aria-hidden="true" />
              Get a Print Quote
            </ButtonLink>
          </div>
        </div>
      </div>

    </section>
  );
}
