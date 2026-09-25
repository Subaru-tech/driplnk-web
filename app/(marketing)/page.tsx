import { Boxes, Download, Layers, Printer, SlidersHorizontal, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { CinematicHero } from "@/components/marketing/cinematic-hero";
import { CtaBand } from "@/components/marketing/cta-band";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { IntroSequence } from "@/components/marketing/intro-sequence";
import { LayerStack } from "@/components/marketing/layer-stack";
import { Reveal } from "@/components/marketing/reveal";
import { Ticker } from "@/components/marketing/ticker";

/* Home page — cinematic redesign.
   Full-bleed sections on the void backdrop, lit rather than boxed. The other
   routes keep their existing layout and simply inherit the new palette. */

const TICKER = [
  "STL",
  "STEP",
  "3MF",
  "OBJ",
  "PARAMETRIC EDITS",
  "WALL-THICKNESS CHECKS",
  "TOLERANCE ±0.05MM",
  "PLA / PETG / ABS / TPU",
  "VETTED PRINT NETWORK",
  "TRACKED DELIVERY",
];

const pillars = [
  {
    icon: Layers,
    kicker: "DEMAND / 3D MODELS",
    title: "Marketplace & CAD Models",
    description:
      "Models create demand. Discover, purchase, and download verified, print-ready mechanical parts, parametric CAD files, and functional components.",
    href: "/models",
  },
  {
    icon: Sparkles,
    kicker: "EXPERTISE / FREELANCE",
    title: "Vetted Specialist Network",
    description:
      "Freelancers provide expertise. Hire vetted CAD engineers for custom enclosures, precision mechanical assemblies, and guaranteed tolerance fits (±0.05mm).",
    href: "/freelance",
  },
  {
    icon: Boxes,
    kicker: "PRODUCTION / MART",
    title: "Instant Multi-Vendor Mart",
    description:
      "Vendors provide physical production. Connect CAD files directly to verified local 3D print farms with instant geometry-based quotes and tracked dispatch.",
    href: "/mart",
  },
  {
    icon: Download,
    kicker: "TOOLING / LEAFF OS",
    title: "LeaFF OS Workspace",
    description:
      "The parametric CAD generation desktop app. Describe any part, iterate real geometry, and hand off seamlessly to freelance specialists or Mart print farms.",
    href: "/leaff-os",
  },
];

const steps = [
  {
    icon: Sparkles,
    title: "Generate",
    description: "Describe the part you need. LeaFF OS turns it into a real, editable model.",
  },
  {
    icon: SlidersHorizontal,
    title: "Refine",
    description: "Adjust dimensions, tolerances and geometry until it fits the job properly.",
  },
  {
    icon: Printer,
    title: "Print",
    description: "Send it to Mart and have it printed and delivered, or export and print it yourself.",
  },
];

export default function HomePage() {
  return (
    <div className="bg-void">
      <IntroSequence />

      <div id="intro">
        <CinematicHero />
      </div>

      <Ticker items={TICKER} />

      {/* ------------------------------------------------ How DripLink Works */}
      <section id="how-driplink-works" className="relative scroll-mt-16 overflow-hidden py-24 md:py-32">
        <div
          aria-hidden="true"
          className="glow-accent absolute top-1/2 left-1/2 aspect-square w-[65vw] -translate-x-1/2 -translate-y-1/2 opacity-35"
        />

        <div className="relative mx-auto max-w-content px-6 lg:px-12 flex flex-col gap-12">
          <Reveal className="max-w-2xl">
            <p className="tech-label text-accent-2">
              Three-Pillar Ecosystem
            </p>
            <h2 className="display-lg mt-4 font-display text-balance text-fg">
              HOW DRIPLINK WORKS
            </h2>
            <p className="mt-4 text-base sm:text-lg text-pretty text-muted">
              Three interconnected tracks turning ideas into verified physical parts.
            </p>
          </Reveal>

          {/* Desktop Visual Flow Rail */}
          <div className="hidden lg:flex items-center justify-between rounded-xl border border-line bg-surface/60 px-6 py-3 font-mono text-xs text-muted backdrop-blur-sm">
            <span className="flex items-center gap-2 text-fg font-medium">
              <span className="size-2 rounded-full bg-accent" />
              01. MODELS (DISCOVER)
            </span>
            <span className="text-faint">→</span>
            <span className="flex items-center gap-2 text-fg font-medium">
              <span className="size-2 rounded-full bg-accent-2" />
              02. SPECIALISTS (HIRE)
            </span>
            <span className="text-faint">→</span>
            <span className="flex items-center gap-2 text-fg font-medium">
              <span className="size-2 rounded-full bg-emerald-400" />
              03. MANUFACTURING (MAKE)
            </span>
            <span className="text-faint">→</span>
            <span className="font-semibold text-accent">
              MART (REAL PRODUCT)
            </span>
          </div>

          {/* Three-Card Ecosystem Grid */}
          <div className="grid gap-6 md:grid-cols-3 items-stretch">
            {/* Card 1: DISCOVER MODELS */}
            <Reveal
              index={0}
              className="flex flex-col justify-between rounded-[var(--radius-card)] border border-line bg-gradient-to-b from-surface to-canvas p-6 sm:p-8 transition-all hover:border-line-strong hover:shadow-xl"
            >
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-accent uppercase tracking-wider">
                    01 / DISCOVER
                  </span>
                  <span className="grid size-9 place-items-center rounded-lg bg-accent/10 text-accent">
                    <Layers className="size-4" />
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="font-display text-xl font-semibold text-fg">
                    DISCOVER MODELS
                  </h3>
                  <p className="text-sm text-pretty text-muted leading-relaxed">
                    Browse functional CAD models, STEP assemblies, enclosures, robotics components, and print-ready parts.
                  </p>
                </div>
              </div>
              <div className="mt-8 border-t border-line/60 pt-6">
                <ButtonLink href="/models" size="md" className="w-full justify-center">
                  Browse Models →
                </ButtonLink>
              </div>
            </Reveal>

            {/* Card 2: HIRE SPECIALISTS */}
            <Reveal
              index={1}
              className="flex flex-col justify-between rounded-[var(--radius-card)] border border-line bg-gradient-to-b from-surface to-canvas p-6 sm:p-8 transition-all hover:border-line-strong hover:shadow-xl"
            >
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-accent-2 uppercase tracking-wider">
                    02 / EXPERTISE
                  </span>
                  <span className="grid size-9 place-items-center rounded-lg bg-accent-2/10 text-accent-2">
                    <Sparkles className="size-4" />
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="font-display text-xl font-semibold text-fg">
                    HIRE SPECIALISTS
                  </h3>
                  <p className="text-sm text-pretty text-muted leading-relaxed">
                    Work with CAD and product-engineering specialists for custom design, refinement, and manufacturability.
                  </p>
                </div>
              </div>
              <div className="mt-8 flex flex-col gap-2.5 border-t border-line/60 pt-6">
                <ButtonLink href="/freelance" size="md" className="w-full justify-center">
                  Hire a Specialist →
                </ButtonLink>
                <ButtonLink
                  href="/freelance/apply"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center text-xs text-muted hover:text-fg"
                >
                  Become a Specialist →
                </ButtonLink>
              </div>
            </Reveal>

            {/* Card 3: GET IT MADE */}
            <Reveal
              index={2}
              className="flex flex-col justify-between rounded-[var(--radius-card)] border border-line bg-gradient-to-b from-surface to-canvas p-6 sm:p-8 transition-all hover:border-line-strong hover:shadow-xl"
            >
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    03 / PRODUCTION
                  </span>
                  <span className="grid size-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Printer className="size-4" />
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="font-display text-xl font-semibold text-fg">
                    GET IT MADE
                  </h3>
                  <p className="text-sm text-pretty text-muted leading-relaxed">
                    Get matched with manufacturing partners based on equipment, materials, capacity, and location.
                  </p>
                </div>
              </div>
              <div className="mt-8 flex flex-col gap-2.5 border-t border-line/60 pt-6">
                <ButtonLink href="/mart" size="md" className="w-full justify-center">
                  Get a Quote →
                </ButtonLink>
                <ButtonLink
                  href="/vendor/apply"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center text-xs text-muted hover:text-fg"
                >
                  Become a Manufacturing Partner →
                </ButtonLink>
              </div>
            </Reveal>
          </div>

          {/* Convergence: DripLnk Mart */}
          <Reveal className="relative flex flex-col items-center gap-4 rounded-2xl border border-line bg-surface/50 p-6 sm:p-8 text-center backdrop-blur-sm">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-accent">
              DRIPLINK MART
            </span>
            <p className="font-display text-lg sm:text-xl font-semibold text-fg">
              &ldquo;From digital design to physical product.&rdquo;
            </p>
            <p className="max-w-2xl text-xs sm:text-sm text-muted leading-relaxed">
              All three pillars connect through Mart. Sourced CAD files and custom specialist designs flow seamlessly to regional print farms with automated slicing checks, instant quotes, and tracked doorstep delivery.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/mart#quote-estimator" size="sm">
                Get Instant Print Quote →
              </ButtonLink>
              <ButtonLink href="/partner" variant="secondary" size="sm">
                Partner with DripLink
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>

      <div aria-hidden="true" className="rule-fade mx-auto h-px max-w-content" />

      {/* ------------------------------------------------------- Problem */}
      <section id="problem" className="relative scroll-mt-16 overflow-hidden py-28 md:py-40">
        <div
          aria-hidden="true"
          className="glow-accent-2 absolute top-1/2 -left-1/4 aspect-square w-[55vw] -translate-y-1/2 opacity-40"
        />

        <div className="relative mx-auto grid max-w-content gap-16 px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-24 lg:px-12">
          <div className="flex flex-col gap-8">
            <Reveal>
              <p className="tech-label text-accent-2">
                002 / The problem
              </p>
              <h2 className="display-lg mt-6 font-display text-balance text-fg">
                Two tools, and neither one finishes the job.
              </h2>
            </Reveal>

            <Reveal delay={120} className="flex flex-col gap-6">
              <p className="text-lg text-pretty text-muted">
                Generative tools give you a shape you can look at but can&apos;t machine. CAD gives
                you a part you can print but takes weeks to learn.
              </p>
              <p className="text-lg text-pretty text-muted">
                So you model in one, patch it in the other, and lose an afternoon every time a
                dimension changes.{" "}
                <span className="text-fg">The work isn&apos;t the design — it&apos;s the handoff.</span>
              </p>
            </Reveal>
          </div>

          <ul className="flex flex-col justify-center gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line">
            {steps.map((step, index) => (
              <Reveal
                as="li"
                key={step.title}
                index={index}
                className="group flex items-start gap-5 bg-surface p-6 transition-colors hover:bg-raised md:p-8"
              >
                <span className="font-mono text-sm text-accent tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <step.icon className="size-4 text-accent-2" strokeWidth={1.75} aria-hidden="true" />
                    <h3 className="font-display text-lg font-medium text-fg">{step.title}</h3>
                  </div>
                  <p className="text-sm text-pretty text-muted">{step.description}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <div aria-hidden="true" className="rule-fade mx-auto h-px max-w-content" />

      {/* --------------------------------------------------------- Stack */}
      {/* No grid here — the only grid in the design is the printer's build
          surface, directly under the tree. */}
      <section id="stack" className="relative scroll-mt-16 overflow-hidden py-28 md:py-40">
        <div
          aria-hidden="true"
          className="glow-accent absolute top-0 left-1/2 aspect-square w-[60vw] -translate-x-1/2 -translate-y-1/2 opacity-40"
        />

        <div className="relative mx-auto max-w-content px-6 lg:px-12">
          <Reveal className="max-w-2xl">
            <p className="tech-label text-accent-2">
              003 / What we build
            </p>
            <h2 className="display-lg mt-6 font-display text-balance text-fg">
              Three pillars, one physical pipeline.
            </h2>
            <p className="mt-6 text-lg text-pretty text-muted">
              Models create demand. Freelancers provide engineering expertise. Vendors power physical manufacturing, and Mart connects them seamlessly.
            </p>
          </Reveal>

          <div className="mt-16">
            <LayerStack layers={pillars} />
          </div>
        </div>
      </section>

      <div aria-hidden="true" className="rule-fade mx-auto h-px max-w-content" />

      {/* --------------------------------------------------- How it works */}
      <section id="how-it-works" className="relative scroll-mt-16 overflow-hidden py-28 md:py-40">
        <div
          aria-hidden="true"
          className="glow-accent-2 absolute right-0 bottom-0 aspect-square w-[50vw] translate-x-1/4 translate-y-1/4 opacity-40"
        />

        <div className="relative mx-auto max-w-content px-6 lg:px-12">
          <Reveal className="max-w-2xl">
            <p className="tech-label text-accent-2">
              004 / How it works
            </p>
            <h2 className="display-lg mt-6 font-display text-balance text-fg">
              Three steps, start to finish.
            </h2>
          </Reveal>

          <div className="mt-16">
            <HowItWorks steps={steps} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Join */}
      <div id="join" className="relative scroll-mt-16 overflow-hidden">
        <div
          aria-hidden="true"
          className="glow-accent absolute inset-x-0 bottom-0 mx-auto aspect-square w-[70vw] translate-y-1/3 opacity-50"
        />
        <div className="relative">
          <CtaBand bare />
        </div>
      </div>
    </div>
  );
}
