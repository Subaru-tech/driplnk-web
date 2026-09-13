import type { Metadata } from "next";
import { DownloadHub } from "@/components/marketing/download-hub";
import { Hero } from "@/components/marketing/hero";
import { Section } from "@/components/marketing/section";
import { CtaBand } from "@/components/marketing/cta-band";

export const metadata: Metadata = {
  title: "Download — LeaFF OS Desktop & DripLnk Mobile App",
  description:
    "Download LeaFF OS parametric CAD and slicing software for macOS, Windows, and Linux, or get the DripLnk companion app for iOS and Android.",
};

export default function DownloadPage() {
  return (
    <>
      <Hero
        eyebrow={
          <span className="rounded-full bg-accent-muted px-3 py-1 text-xs font-medium text-accent">
            Software & Ecosystem
          </span>
        }
        headline="Every tool in the pipeline, ready to install."
        subhead="Precision parametric CAD and direct slicing on your desktop. Real-time print monitoring, Mart orders, and credit top-ups in your pocket."
      />

      <Section tone="canvas" className="pt-0">
        <DownloadHub />
      </Section>

      <CtaBand
        title="Start designing on your desktop today."
        description="Download LeaFF OS for free during our public beta. Zero credit card required, zero cloud lock-in."
      />
    </>
  );
}
