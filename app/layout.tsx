import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeScript } from "@/components/theme-script";
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

export const metadata: Metadata = {
  title: {
    default: "DripLnk — One-stop platform for turning ideas into products",
    template: "%s · DripLnk",
  },
  description:
    "DripLnk — design, build, source, and manufacture — without the friction.",
};

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const clerkAppearance = {
  variables: {
    colorPrimary: "#527953",
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
  const content = <ToastProvider>{children}</ToastProvider>;

  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <head>
        <ThemeScript />
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

