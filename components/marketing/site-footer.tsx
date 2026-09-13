import Link from "next/link";
import { Wordmark } from "@/components/marketing/wordmark";

/* Spec §3.1.7 — 4 columns (Product / Company / Legal / Social),
   bg-primary, top border, copyright line at the bottom. */

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
    ],
  },
  {
    heading: "Social",
    links: [
      { href: "https://x.com/driplnk", label: "X", external: true },
      { href: "https://github.com/driplnk", label: "GitHub", external: true },
      { href: "https://linkedin.com/company/driplnk", label: "LinkedIn", external: true },
    ],
  },
];

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
          </div>

          {columns.map((column) => (
            <div key={column.heading} className="flex flex-col gap-4">
              <h2 className="tech-label text-faint">
                {column.heading}
              </h2>
              <ul className="flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      {...("external" in link && link.external
                        ? { target: "_blank", rel: "noreferrer noopener" }
                        : {})}
                      className="text-sm text-muted transition-colors hover:text-fg"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-16 border-t border-line pt-8 text-sm text-faint">
          © {new Date().getFullYear()} DripLnk. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
