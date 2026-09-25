import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/marketing/legal-doc";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What data DripLnk collects (account, uploads, forms, waitlist), why, how long we keep it, your DPDP Act rights, and how to reach our Grievance Officer.",
};

/**
 * ⚠️ DRAFT — PENDING LAWYER REVIEW ⚠️
 * DPDP-aligned notice language drafted for counsel review. Do not publish
 * until an advocate/CA has reviewed and placeholders are replaced.
 */

const sections: LegalSection[] = [
  {
    id: "scope",
    heading: "Scope",
    body: [
      `This Privacy Policy explains how ${"[LEGAL_ENTITY_NAME]"} ("DripLnk", "we", "us") handles personal data when you use driplnk.in, the LeaFF OS companion app, and related services. It is written to align with India's Digital Personal Data Protection Act, 2023 ("DPDP Act") and the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.`,
      "We collect personal data only for the purposes listed below, use it only for those purposes, and keep it only as long as needed for the purpose or as required by law. You will be asked for notice and consent where the DPDP Act requires it.",
    ],
  },
  {
    id: "collect",
    heading: "What we collect",
    body: [
      [
        "Account data (via our authentication provider Clerk):",
        "name, email address, profile photo if you set one, authentication metadata (sign-in method, session records, security events).",
      ],
      [
        "Creator and vendor content: model files you upload (STL, STEP, 3MF and similar), images, titles and descriptions, licences and pricing you set, vendor business details, material pricing rules.",
      ],
      [
        "Transaction data: Mart orders (file, material, weight, price, shipping address, order status history), freelance requests (brief, reference files, agreed price, delivered files), credit ledger entries.",
      ],
      [
        "Forms and waitlist: contact-form submissions (name, email, message), waitlist emails, and the consent record for each (see section 3).",
      ],
      [
        "Technical data: server logs (IP address, user agent, timestamps) kept for security and abuse prevention, and — only after you accept non-essential cookies — analytics data. See our Cookie Policy.",
      ],
      "We do not collect or store payment card numbers; payments are handled by our payment partners. We do not knowingly process children's data; the platform is not directed at children under 18.",
    ],
  },
  {
    id: "purpose",
    heading: "Why we process it (purpose)",
    body: [
      "We process personal data for these purposes only:",
      [
        "Operating your account and authentication (legitimate use / contractual necessity).",
        "Providing the marketplace, Mart print quoting and fulfilment, freelance engagement tooling, and downloads you request.",
        "Admin review of listings before publication, and enforcement of our Terms (including IT Rules 2021 prohibited-content rules).",
        "Service and order communications — order status, delivery, support replies to contact-form messages.",
        "Security, fraud prevention and abuse detection (rate limiting, log analysis).",
        "Legal compliance: accounting records, responding to lawful requests, grievance redressal.",
        "Product analytics and marketing only with your prior cookie consent (see section 7 and the Cookie Policy).",
      ],
      "We do not sell your personal data, and we do not use your model files to train AI models.",
    ],
  },
  {
    id: "consent-records",
    heading: "Consent records",
    body: [
      "Where you give consent — accepting the Terms and Privacy Policy at signup, submitting the contact form, joining the waitlist, or accepting cookies — we log what you consented to, the exact policy version, and a timestamp, so we can demonstrate valid notice and consent under the DPDP Act.",
      "You can withdraw consent (for example, opt out of analytics cookies or contact-form processing) at any time: cookies via the cookie banner, other consent by emailing our Grievance Officer. Withdrawal does not affect processing already done, and does not affect processing necessary to provide the service you requested.",
    ],
  },
  {
    id: "sharing",
    heading: "Who we share it with",
    body: [
      [
        "We share personal data only with the processors and disclosures below:",
        "Clerk (authentication) — account and session data.",
        "Supabase (database, file storage) — platform data as described above.",
        "Backblaze B2 (object storage) — model and order files.",
        "Razorpay (payments, when enabled) — transaction data needed to collect or refund payments.",
        "Vendors and freelancers strictly as needed to fulfil your order: the print file, material, quantity and shipping details for the vendor assigned to your Mart order; project files between client and freelancer.",
        " authorities, only where required by law, court order, or to prevent harm, and only to the extent required.",
      ],
      "A current list of processors, with locations, is available from the Grievance Officer on request.",
    ],
  },
  {
    id: "retention",
    heading: "Retention",
    body: [
      "We keep personal data for these periods:",
      [
        "Account data: for the life of the account, deleted within 30 days of account deletion (backup expiry aside).",
        "Model files and listings: until you delete them; server-side backups roll off within 35 days.",
        "Mart orders and credit ledger: 8 years from the transaction, for tax and accounting law.",
        "Contact-form messages: 24 months from last response.",
        "Waitlist emails: until you ask us to remove you or 12 months of inactivity, whichever is earlier.",
        "Consent records: 8 years, as evidence of valid notice/consent.",
        "Security logs: 12 months.",
      ],
    ],
  },
  {
    id: "rights",
    heading: "Your rights",
    body: [
      [
        "Under the DPDP Act you may, in relation to your personal data:",
        "access a summary of the data we hold and the processing done;",
        "ask for correction, completion or updating of inaccurate or incomplete data;",
        "ask for erasure of data that is no longer needed for the purpose it was collected for, subject to our legal retention duties (e.g. tax records);",
        "nominate another individual to exercise your rights if you are unable to;",
        "withdraw consent at any time, without affecting prior processing.",
      ],
      `To exercise any right, email our Grievance Officer at ${"grievance@driplnk.in"}. We respond within ${"15"} days. If you are unsatisfied with our response, you may complain to the Data Protection Board of India.`,
      "Account deletion is also available directly from your account settings, which starts the deletion cascade described in the retention table.",
    ],
  },
  {
    id: "security",
    heading: "Security",
    body: [
      "We protect personal data with encryption in transit (TLS), role-based access controls at the database level (row-level security), least-privilege access for staff, signed short-lived URLs for file downloads, and audit logging of sensitive state changes. No system is perfectly secure; if a breach affecting your data occurs, we will notify you and the Data Protection Board as required by law.",
    ],
  },
  {
    id: "grievance",
    heading: "Grievance Officer and Data contact",
    body: [
      "Under the IT Rules 2021, platforms hosting user content must publish a Grievance Officer. Under the DPDP Act, we also name the person who answers data-protection questions.",
      "Grievance Officer & Data Protection contact: [GRIEVANCE_OFFICER_NAME], grievance@driplnk.in. Complaints are acknowledged within 72 hours and resolved within 15 days of receipt, per IT Rules 2021 timelines.",
      "Registered entity and address are published in the site footer and on our About page. [REGISTERED_OFFICE_ADDRESS].",
    ],
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: [
      "We will post any change to this policy on this page with an updated date, and announce material changes on the platform. Where a change requires fresh consent under the DPDP Act, we will ask for it before the processing begins.",
    ],
  },
];

export default function PrivacyPage() {
  return <LegalDoc title="Privacy Policy" updated="September 13, 2026 (DRAFT)" sections={sections} />;
}
