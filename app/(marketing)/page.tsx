import { Boxes, Download, Layers, Printer, SlidersHorizontal, Sparkles } from "lucide-react";
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
    kicker: "Desktop",
    title: "LeaFF OS",
    description:
      "The desktop workspace. Describe a part, get a real editable model, and refine it until it's right.",
    href: "/leaff-os",
  },
  {
    icon: Boxes,
    kicker: "Multi-Vendor Network",
    title: "Instant Print Quotes",
    description:
      "Upload any CAD model to compare vetted print shop prices. One guaranteed rate, tracked to your door.",
    href: "/mart",
  },
  {
    icon: Download,
    kicker: "Ecosystem",
    title: "Download",
    description:
      "Get LeaFF OS for desktop and the DripLnk companion app for iOS and Android.",
    href: "/download",
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
                001 / The problem
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
              002 / What we build
            </p>
            <h2 className="display-lg mt-6 font-display text-balance text-fg">
              Three parts, one pipeline.
            </h2>
            <p className="mt-6 text-lg text-pretty text-muted">
              Each piece is useful on its own. Together they remove every handoff between the idea
              and the finished part.
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
              003 / How it works
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
