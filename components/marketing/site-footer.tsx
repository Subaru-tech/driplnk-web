import Link from "next/link";
import { Wordmark } from "@/components/marketing/wordmark";
import { CookieSettingsButton } from "@/components/marketing/cookie-settings-button";
import { SITE } from "@/lib/site";

/* Spec §3.1.7 — 4 columns (Product / Company / Legal / Social),
   bg-primary, top border, copyright line at the bottom.
   Phase 8: business identity block (legal entity, address, grievance officer)
   is rendered alongside the link columns — IT Rules 2021 publishing duty. */

const columns = [
  {
    heading: "Product",
    links: [
      { href: "/leaff-os", label: "LeaFF OS" },
      { href: "/models", label: "Models" },
      { href: "/mart", label: "Get a Quote (Mart)" },
      { href: "/freelance", label: "Freelance" },
      { href: "/download", label: "Download" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/partner", label: "Partner With Us" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/refund-policy", label: "Refund & Cancellation" },
      { href: "/cookies", label: "Cookie Policy" },
      { button: true, label: "Cookie settings" },
    ],
  },
  {
    heading: "Social",
    links: SITE.socials.map((social) => ({ ...social, external: true })),
  },
];

type FooterLink = {
  href?: string;
  label: string;
  external?: boolean;
  button?: boolean;
};

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto max-w-content px-6 py-16 lg:px-12">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div className="flex flex-col gap-4">
            <Wordmark />
            <p className="max-w-64 text-sm text-muted">
              One pipeline from idea to printed part.
            </p>
            {/* Business identity — published per IT Rules 2021. Values come
                from lib/site.ts; until placeholders are replaced the legal
                pages carry the draft-pending-review banner. */}
            <address className="flex flex-col gap-1 text-sm not-italic text-muted">
              <span className="font-medium text-fg">{SITE.legalEntity}</span>
              <span>{SITE.address}</span>
              <span>{SITE.addressLine2}</span>
              <span>
                {" "}
                <a href={`mailto:${SITE.email}`} className="transition-colors hover:text-fg">
                  {SITE.email}
                </a>
              </span>
              <span>
                Grievance Officer: {SITE.grievanceOfficer.name} —{" "}
                <a
                  href={`mailto:${SITE.grievanceOfficer.email}`}
                  className="transition-colors hover:text-fg"
                >
                  {SITE.grievanceOfficer.email}
                </a>
              </span>
            </address>
          </div>

          {columns.map((column) => (
            <div key={column.heading} className="flex flex-col gap-4">
              <h2 className="tech-label text-faint">
                {column.heading}
              </h2>
              <ul className="flex flex-col gap-3">
                {column.links.map((link: FooterLink) => (
                  <li key={link.label}>
                    {link.button ? (
                      <CookieSettingsButton />
                    ) : (
                      <Link
                        href={link.href ?? "/"}
                        {...(link.external
                          ? { target: "_blank", rel: "noreferrer noopener" }
                          : {})}
                        className="text-sm text-muted transition-colors hover:text-fg"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-16 border-t border-line pt-8 text-sm text-faint">
          © {new Date().getFullYear()} {SITE.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
