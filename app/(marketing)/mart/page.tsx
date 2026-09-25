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
    "Multi-vendor print price comparison for any 3D model. Upload your STL, STEP, or 3MF file to get upfront pricing from vetted print hubs, tracked to your door.",
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
import { getApprovedVendorCount } from "@/driplnk-web-backend/db/queries";

export default async function MartPage() {
  const [user, { data: vendorCount }] = await Promise.all([
    getUnifiedUser(),
    getApprovedVendorCount(),
  ]);

  return (
    <>
      <Hero
        eyebrow={
          <span className="rounded-full bg-accent-muted px-3 py-1 font-mono text-xs font-medium text-accent">
            {vendorCount > 0 ? `${vendorCount} Launch Manufacturing Partners • Vetted Print Farms` : "DripLnk Mart • Multi-Vendor Print Network"}
          </span>
        }
        headline="Instant multi-vendor print quotes for any 3D model."
        subhead="Upload your 3D CAD or mesh file to compare upfront pricing from vetted regional print farms. One transparent price, material-specific tolerances, and tracked delivery to your door."
        actions={
          <>
            <ButtonLink href="#quote-estimator" size="lg">
              Get a Print Quote
            </ButtonLink>
            <ButtonLink href="/vendor/apply" variant="secondary" size="lg">
              Become a Manufacturing Partner
            </ButtonLink>
          </>
        }
      />

      {/* Two Pathways: Customers vs Manufacturing Businesses */}
      <section className="border-y border-line bg-surface/50 py-8">
        <div className="mx-auto max-w-content px-6 lg:px-12 grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-canvas p-6">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
                For Customers
              </span>
              <h2 className="font-display text-lg font-semibold text-fg">
                Get a Print Quote
              </h2>
              <p className="text-xs text-muted leading-relaxed">
                Upload your STL, STEP, or 3MF CAD file. Instant geometry-based pricing across PLA, PETG, ABS, and resin with tracked doorstep shipping.
              </p>
            </div>
            <div>
              <ButtonLink href="#quote-estimator" size="sm">
                Calculate Print Quote →
              </ButtonLink>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-canvas p-6">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent-2">
                For Manufacturing Businesses
              </span>
              <h2 className="font-display text-lg font-semibold text-fg">
                Become a Manufacturing Partner
              </h2>
              <p className="text-xs text-muted leading-relaxed">
                Connect your print farm fleet to DripLnk Mart. Receive qualified orders matched to your machines, materials, and capacity with guaranteed payouts.
              </p>
            </div>
            <div>
              <ButtonLink href="/vendor/apply" variant="secondary" size="sm">
                Apply as Print Farm →
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <Section id="quote-estimator" tone="canvas" className="pt-0">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <span className="font-mono text-xs font-semibold text-accent uppercase tracking-wider">
              Launch Manufacturing Partners
            </span>
            <p className="text-xs text-muted mt-0.5">
              {vendorCount} vetted print farms currently serving the DripLink network.
            </p>
          </div>
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 font-mono text-xs font-semibold text-emerald-400">
            Active Hubs Online
          </span>
        </div>
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
