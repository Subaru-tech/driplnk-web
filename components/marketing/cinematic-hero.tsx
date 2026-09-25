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
    <section className="relative flex min-h-svh flex-col justify-start pt-20 sm:pt-24 lg:pt-20 pb-12 lg:pb-16 overflow-hidden bg-void">
      {/* Key + fill lights, drifting slowly so a still frame never feels dead */}
      <div
        aria-hidden="true"
        className="glow-accent drift absolute top-0 left-1/2 aspect-square w-[80vw] max-w-4xl -translate-x-1/2 opacity-40"
      />
      <div
        aria-hidden="true"
        className="glow-accent-2 absolute -bottom-1/4 left-1/2 aspect-square w-[70vw] max-w-3xl -translate-x-1/2 opacity-50"
      />

      {/* The machine, printing. Full opacity */}
      <PrintCanvas className="absolute inset-0 size-full" />

      {/* Seat it into the page */}
      <div aria-hidden="true" className="vignette absolute inset-0" />

      {/* Hero copy block: balanced naturally below navbar with zero dead space */}
      <div className="relative mx-auto flex w-full max-w-content flex-col items-center px-6 pt-2 pb-10 sm:pt-4 sm:pb-14 text-center lg:items-start lg:px-12 lg:pt-4 lg:pb-12 lg:text-left">
        <div className="flex flex-col items-center lg:max-w-[36rem] xl:max-w-[42rem] lg:items-start">
          <p className="hero-pull tech-label mb-3 sm:mb-6 text-accent-2">
            Idea &nbsp;→&nbsp; Geometry &nbsp;→&nbsp; Part
          </p>

          {/* Hand-broken on desktop */}
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
            <ButtonLink href="/mart" variant="secondary" size="lg">
              <Printer className="size-4" aria-hidden="true" />
              Get a Print Quote
            </ButtonLink>
            <ButtonLink href="#problem" variant="ghost" size="lg">
              See how it works
            </ButtonLink>
          </div>
        </div>
      </div>

    </section>
  );
}
