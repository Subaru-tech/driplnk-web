import type { Metadata } from "next";
import { CheckCircle2, FileCheck, Layers, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { CtaBand } from "@/components/marketing/cta-band";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { FreelanceBrowser } from "@/components/marketing/freelance-browser";
import { Hero } from "@/components/marketing/hero";
import { Reveal } from "@/components/marketing/reveal";
import { Section, SectionHeading } from "@/components/marketing/section";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Freelance — Hire 3D & CAD Specialists",
  description:
    "Browse vetted 3D modelers, CAD designers, and print-ready engineering specialists for your custom parts and prototypes.",
};

const guarantees = [
  {
    icon: ShieldCheck,
    title: "Manufacturing-focused vetting",
    description:
      "Freelancers are evaluated for real manufacturing skills during approval — wall thickness, draft angles, shrinkage compensation, and overhang orientation.",
  },
  {
    icon: Layers,
    title: "Direct handoff to LeaFF OS & Mart",
    description:
      "Delivered parts drop straight into your LeaFF OS parametric workspace for edits or directly into the Mart queue for physical printing.",
  },
  {
    icon: FileCheck,
    title: "Milestone-protected escrow",
    description:
      "Funds are held in escrow and released once you inspect the delivered CAD files and slice tests against your specifications.",
  },
  {
    icon: UserCheck,
    title: "Vetted industrial engineers",
    description:
      "No generic graphic designers. Our network features mechanical engineers, product prototypers, and experienced additive manufacturing specialists.",
  },
];

const steps = [
  {
    step: "01",
    title: "Post your requirements",
    description:
      "Describe the part, assembly, or enclosure you need. Attach napkin sketches, reference images, or PCB CAD files.",
  },
  {
    step: "02",
    title: "Review bids from vetted talent",
    description:
      "Compare proposals, fixed milestones, and turnaround times from verified 3D CAD and additive specialists.",
  },
  {
    step: "03",
    title: "Receive slice-verified models",
    description:
      "Get editable STEP/STL/3MF files verified for manufacturability, with one-click dispatch to Mart printing.",
  },
];

import { getFreelanceBrowseProfiles } from "@/driplnk-web-backend/db/queries";

export const dynamic = "force-dynamic";

export default async function FreelancePage() {
  const { data: browseResult } = await getFreelanceBrowseProfiles({ page: 1, pageSize: 24 });

  return (
    <>
      <Hero
        eyebrow={
          <span className="rounded-full bg-accent-muted px-3 py-1 font-mono text-xs font-medium text-accent">
            {browseResult.total} Founding Specialists • Curated Cohort
          </span>
        }
        headline="Hire vetted 3D & CAD specialists."
        subhead="Work with CAD and product-engineering specialists for custom enclosures, precision mechanical assemblies, and guaranteed tolerance fits. Milestone protection and direct LeaFF OS handoff."
        actions={
          <>
            <ButtonLink href="#browse" size="lg">
              Hire a Specialist
            </ButtonLink>
            <ButtonLink href="/freelance/apply" variant="secondary" size="lg">
              Become a Specialist
            </ButtonLink>
          </>
        }
      />

      {/* Two Pathways: Customers vs CAD Professionals */}
      <section className="border-y border-line bg-surface/50 py-8">
        <div className="mx-auto max-w-content px-6 lg:px-12 grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-canvas p-6">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
                For Customers
              </span>
              <h2 className="font-display text-lg font-semibold text-fg">
                Hire a Specialist
              </h2>
              <p className="text-xs text-muted leading-relaxed">
                Connect with vetted mechanical engineers and 3D modelers. Get print-ready STEP/STL files, slice-verified geometry, and escrow protection.
              </p>
            </div>
            <div>
              <ButtonLink href="#browse" size="sm">
                Browse Specialists →
              </ButtonLink>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-canvas p-6">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent-2">
                For CAD Professionals
              </span>
              <h2 className="font-display text-lg font-semibold text-fg">
                Become a Specialist
              </h2>
              <p className="text-xs text-muted leading-relaxed">
                Join our founding cohort. Set your own hourly or milestone rates, receive customer briefs, and get paid with milestone-backed security.
              </p>
            </div>
            <div>
              <ButtonLink href="/freelance/apply" variant="secondary" size="sm">
                Apply as Specialist →
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* Directory Section */}
      <Section id="browse" tone="canvas">
        <SectionHeading
          eyebrow="001 / Curated Network"
          title="Founding Specialists"
          description={`A curated first cohort of ${browseResult.total} CAD and product-engineering specialists currently serving the DripLink network.`}
        />
        <div className="mt-10">
          <FreelanceBrowser
            initialProfiles={browseResult.profiles}
            initialTotal={browseResult.total}
            initialPage={browseResult.page}
            initialPageSize={browseResult.pageSize}
            initialTotalPages={browseResult.totalPages}
          />
        </div>
      </Section>

      {/* Why Hire on DripLnk Section */}
      <Section tone="surface">
        <SectionHeading
          eyebrow="002 / The DripLnk Standard"
          title="Built for manufacturing, not just rendering."
          description="Traditional freelance platforms don't understand 3D printing constraints. DripLnk ensures every file delivered can actually be printed and assembled."
        />
        <div className="mt-12">
          <FeatureGrid features={guarantees} />
        </div>
      </Section>

      {/* How It Works */}
      <Section tone="canvas">
        <SectionHeading
          eyebrow="003 / How It Works"
          title="From requirement to printed part in three steps."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((item, index) => (
            <Reveal
              key={item.step}
              variant="layer"
              index={index}
              className="relative flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-6"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-2xl font-bold text-accent">{item.step}</span>
                <span className="size-2 rounded-full bg-accent-2" />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-lg font-medium text-fg">{item.title}</h3>
                <p className="text-sm text-pretty text-muted">{item.description}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Join as Freelancer Callout Banner */}
        <Reveal className="mt-16 rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center sm:p-10">
          <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
            <span className="grid size-12 place-items-center rounded-full bg-accent-muted text-accent">
              <Sparkles className="size-6" />
            </span>
            <h3 className="font-display text-xl font-semibold text-fg">
              Are you an experienced 3D designer or CAD engineer?
            </h3>
            <p className="text-sm text-muted">
              Join DripLnk&apos;s vetted specialist network. Get matched with buyers seeking custom
              functional parts, electronics enclosures, and print-ready models.
            </p>
            <ButtonLink href="/freelance/apply" variant="secondary" size="lg" className="mt-2 min-h-[44px]">
              Apply to join as a Freelancer
            </ButtonLink>
          </div>
        </Reveal>
      </Section>

      <CtaBand
        title="Need a custom part designed?"
        description="Connect with a vetted CAD specialist today and turn your napkin sketch into a manufacturable, print-ready model."
      />
    </>
  );
}

