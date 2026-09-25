import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

/* Spec §1.2 — Space Grotesk for headings, Inter for body,
   JetBrains Mono for credit numbers, order IDs, filenames and timestamps. */
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://driplnk.in";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "DripLnk — One-stop platform for turning ideas into products",
    template: "%s · DripLnk",
  },
  description:
    "DripLnk — design, build, source, and manufacture — without the friction.",
  alternates: {
    // Phase 9: canonical URL — with the default metadataBase every page gets
    // <link rel="canonical"> derived from its route automatically.
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "DripLnk",
    url: siteUrl,
    title: "DripLnk — One-stop platform for turning ideas into products",
    description:
      "Design, build, source, and manufacture — without the friction. CAD marketplace, on-demand printing, freelance engineering.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "DripLnk" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DripLnk — One-stop platform for turning ideas into products",
    description: "Design, build, source, and manufacture — without the friction.",
    images: ["/opengraph-image"],
  },
};

/** Phase 9: Organization + WebSite schema (JSON-LD). */
function OrganizationSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "DripLnk",
        url: siteUrl,
        logo: `${siteUrl}/opengraph-image`,
        // Grievance contact per IT Rules 2021 publishing duty.
        contactPoint: [
          {
            "@type": "ContactPoint",
            email: "grievance@driplnk.in",
            contactType: "customer support",
            availableLanguage: ["en", "hi"],
          },
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "DripLnk",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const clerkAppearance = {
  variables: {
    colorPrimary: "#0F52BA",
    colorBackground: "#0D1F3C",
    colorText: "#F0F6FC",
    colorTextSecondary: "#A6C5D7",
    borderRadius: "0.5rem",
    fontFamily: "var(--font-inter)",
    fontFamilyButtons: "var(--font-space-grotesk)",
  },
  elements: {
    userButtonPopoverCard: "border border-line bg-surface shadow-2xl rounded-[var(--radius-card)]",
    userPreviewMainIdentifier: "text-fg font-medium",
    userPreviewSecondaryIdentifier: "text-muted",
    userButtonPopoverActionButton: "hover:bg-raised text-fg transition-colors",
    userButtonPopoverActionButtonIcon: "text-muted",
    userButtonPopoverFooter: "hidden",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const content = (
    <>
      <OrganizationSchema />
      <ToastProvider>{children}</ToastProvider>
    </>
  );

  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: 'document.documentElement.dataset.js="1";',
          }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-canvas text-fg">
        {clerkPublishableKey ? (
          <ClerkProvider
            publishableKey={clerkPublishableKey}
            appearance={clerkAppearance}
            signInUrl="/login"
            signUpUrl="/signup"
            signInFallbackRedirectUrl="/dashboard"
            signUpFallbackRedirectUrl="/dashboard"
          >
            {content}
          </ClerkProvider>
        ) : (
          content
        )}
      </body>
    </html>
  );
}
