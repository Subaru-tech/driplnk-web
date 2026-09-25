import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/marketing/legal-doc";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "Which cookies DripLnk uses, which need your consent, and how the consent banner works.",
};

/**
 * ⚠️ DRAFT — PENDING LAWYER REVIEW ⚠️
 * Essential-only today; analytics/marketing cookies are OFF until the banner
 * is accepted (see components/marketing/cookie-consent.tsx).
 */

const sections: LegalSection[] = [
  {
    id: "what",
    heading: "What cookies are",
    body: [
      "Cookies are small pieces of data a website stores in your browser. Similar technologies (local storage, session storage) are covered by this policy too. Some are needed for the site to work; others, which we do not set until you agree, help us measure and improve it.",
    ],
  },
  {
    id: "categories",
    heading: "Categories we use",
    body: [
      [
        "Essential / strictly necessary — always on, no consent needed:",
        "Authentication session cookies set by Clerk (and, in cookieless fallback mode, Supabase Auth) to keep you signed in securely.",
        "Basic security tokens and essential interface state. These do not require consent because the site cannot function without them (eIT Rules / EU ePrivacy \"strictly necessary\" basis).",
      ],
      [
        "Analytics (consent required):",
        "Usage measurement cookies/scripts that would help us understand which pages and features are used. These are NOT set today — no analytics provider is integrated — and will only load after you press Accept in the banner. If/when we add a provider, this policy and the banner's detail list will be updated before it loads.",
      ],
      [
        "Marketing (consent required):",
        "Cookies for measuring campaigns or personalising ads. Not used today; same rule — they stay blocked until explicit consent.",
      ],
    ],
  },
  {
    id: "banner",
    heading: "How the consent banner works",
    body: [
      "On your first visit you'll see a banner: Accept all, or Essential only. Nothing non-essential runs before you choose, and choosing Essential only keeps analytics and marketing cookies off. Your choice is stored locally and recorded server-side with a timestamp as part of our consent records (see the Privacy Policy). You can change your mind any time from the cookie settings link in the footer, which re-opens the banner.",
      "Consent is separate for analytics and marketing categories — accepting one does not accept the other.",
    ],
  },
  {
    id: "managing",
    heading: "Managing cookies in your browser",
    body: [
      "Besides our banner, all modern browsers let you block or delete cookies via their settings. Blocking essential cookies will sign you out and break sign-in, since session cookies are how authentication works.",
    ],
  },
  {
    id: "contact",
    heading: "Questions",
    body: [
      "Email hello@driplnk.in, or our Grievance Officer at grievance@driplnk.in for formal requests. See the Privacy Policy for details.",
    ],
  },
];

export default function CookiePolicyPage() {
  return <LegalDoc title="Cookie Policy" updated="September 13, 2026 (DRAFT)" sections={sections} />;
}
