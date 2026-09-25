import { FileWarning } from "lucide-react";
import Link from "next/link";
import { SITE } from "@/lib/site";

export type LegalSection = {
  id: string;
  heading: string;
  /** Paragraphs; strings render as <p>, arrays render as <ul> bullet lists. */
  body: (string | string[])[];
};

export type LegalDocProps = {
  title: string;
  updated: string;
  sections: LegalSection[];
};

/**
 * Renders a full legal document with a DRAFT banner.
 *
 * The banner is not removable decoration: it is the implementation of the
 * project rule that AI-drafted legal text is draft-pending-lawyer-review and
 * must never be mistaken for verified copy. Remove it only after an
 * advocate/CA signs off AND every [PLACEHOLDER] in lib/site.ts is replaced.
 */
export function LegalDoc({ title, updated, sections }: LegalDocProps) {
  return (
    <article className="mx-auto max-w-prose px-6 py-20 md:py-28">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-fg">{title}</h1>
      <p className="mt-2 text-sm text-faint">Last updated: {updated}</p>

      <div className="mt-8 flex gap-4 rounded-[var(--radius-card)] border border-warning/40 bg-warning-muted p-4">
        <FileWarning className="mt-0.5 size-5 shrink-0 text-warning" strokeWidth={1.75} aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-fg">Draft — pending lawyer review</p>
          <p className="text-sm text-muted">
            This document is a working draft prepared for review by an advocate/CA. It is not legal
            advice, has no effect until reviewed, and contains placeholders (e.g.{" "}
            <code className="font-mono text-xs">[LEGAL_ENTITY_NAME]</code>) that must be replaced
            before publication.
          </p>
        </div>
      </div>

      <nav aria-label="On this page" className="mt-10">
        <h2 className="tech-label text-faint">On this page</h2>
        <ol className="mt-4 flex flex-col gap-2">
          {sections.map((section, index) => (
            <li key={section.id} className="flex gap-3 text-sm">
              <span className="font-mono text-faint">{String(index + 1).padStart(2, "0")}</span>
              <a href={`#${section.id}`} className="text-accent hover:underline">
                {section.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-12 flex flex-col gap-12">
        {sections.map((section, index) => (
          <section key={section.id} aria-labelledby={section.id} className="flex flex-col gap-4">
            <h2 id={section.id} className="font-display text-xl font-semibold text-fg">
              <span className="mr-3 font-mono text-sm text-faint">
                {String(index + 1).padStart(2, "0")}
              </span>
              {section.heading}
            </h2>
            {section.body.map((block, blockIndex) =>
              typeof block === "string" ? (
                <p key={blockIndex} className="text-base leading-relaxed text-muted">
                  {block}
                </p>
              ) : (
                <ul key={blockIndex} className="flex list-disc flex-col gap-2 pl-5 text-base leading-relaxed text-muted">
                  {block.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}
      </div>

      <div className="mt-16 rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-medium text-fg">Contact</h2>
        <address className="mt-4 flex flex-col gap-1 text-sm not-italic text-muted">
          <span className="font-medium text-fg">{SITE.legalEntity}</span>
          <span>{SITE.address}</span>
          <span>{SITE.addressLine2}</span>
          <span>
            Email:{" "}
            <a href={`mailto:${SITE.email}`} className="text-accent hover:underline">
              {SITE.email}
            </a>
          </span>
          <span>
            Grievance Officer: {SITE.grievanceOfficer.name} —{" "}
            <a href={`mailto:${SITE.grievanceOfficer.email}`} className="text-accent hover:underline">
              {SITE.grievanceOfficer.email}
            </a>
          </span>
        </address>
        <p className="mt-4 text-sm text-muted">
          Questions about these terms? See also our{" "}
          <Link href="/privacy" className="text-accent hover:underline">
            Privacy Policy
          </Link>
          ,{" "}
          <Link href="/refund-policy" className="text-accent hover:underline">
            Refund &amp; Cancellation Policy
          </Link>{" "}
          and{" "}
          <Link href="/cookies" className="text-accent hover:underline">
            Cookie Policy
          </Link>
          .
        </p>
      </div>
    </article>
  );
}
