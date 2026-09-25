import type { Metadata } from "next";
import { PartnerPortal } from "@/components/marketing/partner-portal";
import { Hero } from "@/components/marketing/hero";
import { Section } from "@/components/marketing/section";
import { CtaBand } from "@/components/marketing/cta-band";

export const metadata: Metadata = {
  title: "Partner With Us — Print Vendors & CAD Specialists | DripLnk",
  description:
    "Partner with DripLnk. Apply to join our vetted 3D printing farm network or become an approved CAD and engineering specialist.",
};

export default function PartnerPage() {
  return (
    <>
      <Hero
        eyebrow={
          <span className="rounded-full bg-accent-muted px-3 py-1 text-xs font-medium text-accent">
            Partner Ecosystem
          </span>
        }
        headline="Build with DripLnk. Two ways to partner."
        subhead="Join the decentralized manufacturing and engineering network. Whether you have industrial 3D printing capacity or CAD engineering expertise, choose your track below."
      />

      <Section tone="canvas" className="pt-0">
        <PartnerPortal />
      </Section>

      <CtaBand
        title="Have questions about commercial partnerships?"
        description="Talk to our engineering partnerships team about enterprise fleet onboarding, custom filament formulations, or bulk design arrangements."
      />
    </>
  );
}
