import type { Metadata } from "next";
import { ExternalLink, Mail } from "lucide-react";
import Link from "next/link";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the DripLnk team.",
};

/* PLACEHOLDER: swap these for the real address and handles before launch. */
const CONTACT_EMAIL = "hello@driplnk.in";

const channels = [
  { icon: Mail, label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
  { icon: ExternalLink, label: "github.com/driplnk", href: "https://github.com/driplnk" },
  {
    icon: ExternalLink,
    label: "DripLnk on LinkedIn",
    href: "https://linkedin.com/company/driplnk",
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-content px-6 py-20 md:py-28 lg:px-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg">Contact</h1>
        <p className="mt-4 max-w-xl text-base text-muted">
          Questions, partnerships, or something broken — we read everything.
        </p>

        {/* Spec §3.4 — form and direct links side by side on desktop, stacked on mobile. */}
        <div className="mt-12 grid gap-12 md:grid-cols-[1.5fr_1fr] md:gap-16">
          <ContactForm />

          <div className="flex flex-col gap-6">
            <h2 className="tech-label text-faint">
              Or reach us directly
            </h2>
            <ul className="flex flex-col gap-4">
              {channels.map((channel) => (
                <li key={channel.href}>
                  <Link
                    href={channel.href}
                    {...(channel.href.startsWith("http")
                      ? { target: "_blank", rel: "noreferrer noopener" }
                      : {})}
                    className="inline-flex items-center gap-3 text-sm text-muted transition-colors hover:text-fg"
                  >
                    <channel.icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    {channel.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
