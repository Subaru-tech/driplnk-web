import type { Metadata } from "next";
import { BadgeIndianRupee, PackageCheck, ShieldCheck, Truck, Upload, Users } from "lucide-react";
import { CtaBand } from "@/components/marketing/cta-band";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { Hero } from "@/components/marketing/hero";
import { Reveal } from "@/components/marketing/reveal";
import { Section, SectionHeading } from "@/components/marketing/section";
import { ButtonLink } from "@/components/ui/button";
import { MartQuoteCalculator } from "@/components/marketing/mart-quote-calculator";

export const metadata: Metadata = {
  title: "Get a Print Quote — Instant Multi-Vendor 3D Printing | DripLnk Mart",
  description:
    "Instant multi-vendor print price comparison for any 3D model. Upload your STL, STEP, or 3MF file to get guaranteed upfront pricing from vetted print hubs, tracked to your door.",
};

export const dynamic = "force-dynamic";


const features = [
  {
    icon: Users,
    title: "Vetted printers",
    description: "A reviewed network, not an open marketplace. Every printer is checked before it takes a job.",
  },
  {
    icon: BadgeIndianRupee,
    title: "One price up front",
    description: "Material, print time and delivery quoted together. No surprise line items at checkout.",
  },
  {
    icon: ShieldCheck,
    title: "Reprinted if it fails",
    description: "If a print comes out wrong on our side, it gets reprinted. You don't pay twice.",
  },
  {
    icon: Truck,
    title: "Tracked end to end",
    description: "Follow the job from confirmed to printing to shipped, without emailing anyone.",
  },
];

/* Spec §3.2.4 — for Mart, a simple 3-step visual (upload → order → delivered). */
const flow = [
  { icon: Upload, title: "Upload", description: "Send a model from LeaFF OS or upload your own file." },
  { icon: PackageCheck, title: "Order", description: "Pick material and finish, confirm the quoted price." },
  { icon: Truck, title: "Delivered", description: "It's printed, checked and shipped to your address." },
];

import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";

export default async function MartPage() {
  const user = await getUnifiedUser();

  return (
    <>
      <Hero
        eyebrow={
          <span className="rounded-full bg-accent-muted px-3 py-1 text-xs font-medium text-accent">
            DripLnk Mart • Multi-Vendor Print Network
          </span>
        }
        headline="Instant multi-vendor print quotes for any 3D model."
        subhead="Upload your 3D CAD or mesh file to compare guaranteed pricing from vetted regional print farms. One transparent price, verified ±0.05 mm tolerances, and tracked delivery to your door."
        actions={
          <>
            <ButtonLink href="#quote-estimator" size="lg">
              <Upload className="size-4" aria-hidden="true" />
              Upload for Instant Quote
            </ButtonLink>
            <ButtonLink href="/signup" size="lg" variant="secondary">
              Join Waitlist
            </ButtonLink>
          </>
        }
      />

      <Section tone="canvas" className="pt-0">
        <MartQuoteCalculator isSignedIn={Boolean(user)} />
      </Section>


      <Section tone="surface">
        <SectionHeading eyebrow="Why Mart" title="The part of printing nobody wants to manage." />
        <div className="mt-12">
          <FeatureGrid features={features} />
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="How it works" title="Three steps." />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {flow.map((step, index) => (
            <Reveal
              key={step.title}
              variant="layer"
              index={index}
              className="cad-brackets relative flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-6"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-[var(--radius-control)] bg-accent-muted text-accent">
                  <step.icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="font-mono text-sm text-faint">0{index + 1}</span>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-lg font-medium text-fg">{step.title}</h3>
                <p className="text-sm text-pretty text-muted">{step.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
