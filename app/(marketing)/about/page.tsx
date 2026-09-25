import type { Metadata } from "next";
import { User } from "lucide-react";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: "Why we're building DripLnk, and who's building it.",
};

/* Spec §3.3 — single column, max-width 720px, editorial. No dashboard-style
   cards on this page.

   PLACEHOLDER: the founder entries below are structure only. Replace the names,
   roles and bios with the real ones — we have deliberately not invented
   biographies for real people. */
const founders = [
  { name: "Founder name", role: "Role", bio: "One or two sentences of real bio goes here." },
  { name: "Founder name", role: "Role", bio: "One or two sentences of real bio goes here." },
];

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-prose px-6 py-20 md:py-28">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-balance text-fg">
        We got tired of building the same part twice.
      </h1>

      <div className="mt-8 flex flex-col gap-6 text-base leading-relaxed text-muted">
        <p>
          Every 3D print starts the same way: you know exactly what you need, and you spend the next
          three hours fighting software to describe it. Generative tools hand you something that
          looks right and prints badly. CAD hands you something that prints well, after you learn
          CAD.
        </p>
        <p>
          So most people do both. They generate a shape, import it somewhere serious, rebuild the
          half of it that doesn&apos;t hold up, and start over when a dimension changes. The work
          isn&apos;t the design. The work is the handoff.
        </p>
        <p className="text-fg">
          DripLnk exists to delete that handoff. One pipeline: describe the part, refine it with
          tools that understand manufacturing, send it to a printer. No exporting, no re-modelling,
          no second application.
        </p>
      </div>

      <h2 className="mt-16 font-display text-xl font-semibold text-fg">Why 3D printing</h2>
      <div className="mt-6 flex flex-col gap-6 text-base leading-relaxed text-muted">
        <p>
          Printing is the one manufacturing process where a single person can go from idea to
          physical object in an afternoon. The machines got cheap, fast and reliable. The software
          didn&apos;t keep up — it still assumes you either want a toy or you have an engineering
          degree.
        </p>
        <p>
          That gap is the whole opportunity. The people who most need a custom bracket, a
          replacement part, or a jig for their own workshop are exactly the people the current tools
          push away.
        </p>
      </div>

      <h2 className="mt-16 font-display text-xl font-semibold text-fg">Business details</h2>
      <div className="mt-6 flex flex-col gap-4 text-base leading-relaxed text-muted">
        {/* Published per IT Rules 2021 (platform hosting user content must
            publish entity + Grievance Officer details). Values come from
            lib/site.ts — placeholders until lawyer/entity review completes. */}
        <p>
          <span className="font-medium text-fg">{SITE.legalEntity}</span>
          <br />
          {SITE.address}
          <br />
          {SITE.addressLine2}
        </p>
        <p>
          General contact: <a className="text-accent hover:underline" href={`mailto:${SITE.email}`}>{SITE.email}</a>
          <br />
          Grievance Officer: <span className="font-medium text-fg">{SITE.grievanceOfficer.name}</span> —{" "}
          <a className="text-accent hover:underline" href={`mailto:${SITE.grievanceOfficer.email}`}>{SITE.grievanceOfficer.email}</a>
          <br />
          Complaints are acknowledged within 72 hours and resolved within {SITE.grievanceOfficer.responseDays} days.
        </p>
        <p className="text-sm text-faint">
          GST registration is pending; invoices will be updated once a GSTIN is issued.
        </p>
      </div>

      <h2 className="mt-16 font-display text-xl font-semibold text-fg">Who&apos;s building it</h2>
      <div className="mt-8 flex flex-col gap-10">
        {founders.map((founder, index) => (
          <div key={index} className="flex flex-col gap-4 sm:flex-row sm:gap-6">
            {/* Replace with a real photo (next/image) when we have one. */}
            <div className="grid size-20 shrink-0 place-items-center rounded-full border border-dashed border-line-strong bg-surface">
              <User className="size-7 text-faint" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-2">
              <div>
                <p className="font-display text-lg font-medium text-fg">{founder.name}</p>
                <p className="text-sm text-faint">{founder.role}</p>
              </div>
              <p className="text-base leading-relaxed text-muted">{founder.bio}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
