/**
 * DripLnk business details — single source of truth for legal pages, the
 * footer, and the About page.
 *
 * ⚠️  DRAFT STATUS — LAWYER REVIEW REQUIRED ⚠️
 *
 * Every value below is a [PLACEHOLDER]. Before launch each one must be
 * replaced with a real, verified value and the surrounding documents signed
 * off by an advocate/CA. These pages must NOT go live with placeholders in
 * place — see the DRAFT banner component (components/marketing/legal-doc.tsx)
 * rendered at the top of every legal page.
 */

export const SITE = {
  /** Display / trading name. */
  name: "DripLnk",

  /** Registered legal entity. PLACEHOLDER — pending incorporation decision. */
  legalEntity: "[LEGAL_ENTITY_NAME — e.g. DripLnk Pvt. Ltd.]",

  /** Registered office address. PLACEHOLDER. */
  address: "[REGISTERED_OFFICE_ADDRESS — line 1]",
  addressLine2: "[REGISTERED_OFFICE_ADDRESS — city, state, PIN]",

  /** Primary contact email. */
  email: "hello@driplnk.in",

  /** Grievance Officer / Data Protection contact — IT Rules 2021 § 12 / DPDP notice requirement. */
  grievanceOfficer: {
    name: "[GRIEVANCE_OFFICER_NAME]",
    email: "grievance@driplnk.in",
    /** Response window quoted in the Privacy Policy (IT Rules 2021: 30 days max; we commit to less). */
    responseDays: 15,
  },

  /** GSTIN — not yet registered; policies state this explicitly. */
  gstin: null as string | null,

  /** Marketing/support socials referenced by the footer. */
  socials: [
    { label: "X", href: "https://x.com/driplnk" },
    { label: "GitHub", href: "https://github.com/driplnk" },
    { label: "LinkedIn", href: "https://linkedin.com/company/driplnk" },
  ],
} as const;
