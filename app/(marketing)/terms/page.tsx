import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/marketing/legal-doc";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms governing your use of DripLnk — accounts, marketplace listings, Mart print orders, freelance engagements, user content and prohibited use.",
};

/**
 * ⚠️ DRAFT — PENDING LAWYER REVIEW ⚠️
 * AI-drafted starting text for counsel review. Do not publish until an
 * advocate/CA has reviewed and all [PLACEHOLDER]s in lib/site.ts are filled.
 * Legal review notes are tracked in PROJECT_STATUS.md / the phase 8 DoD.
 */

const sections: LegalSection[] = [
  {
    id: "about",
    heading: "About these terms",
    body: [
      `These Terms of Service ("Terms") are a binding agreement between you and ${"[LEGAL_ENTITY_NAME]"} ("DripLnk", "we", "us"), the operator of driplnk.in and the LeaFF OS companion software. By creating an account, uploading or acquiring a model, placing a Mart order, or hiring a freelancer through the platform, you accept these Terms.`,
      "DripLnk is a marketplace and manufacturing coordination platform. We host 3D model listings created by users, coordinate physical print orders between buyers and independent vendor workshops, and facilitate freelance engagements between clients and independent designers. Vendors and freelancers are independent businesses, not our employees or agents.",
      "You must be at least 18 years old (or the age of majority where you live) to transact on DripLnk. If you use DripLnk on behalf of an organisation, you confirm you are authorised to bind that organisation.",
    ],
  },
  {
    id: "accounts",
    heading: "Accounts",
    body: [
      "You need an account to upload models, place Mart orders, or engage freelancers. You are responsible for the accuracy of the information you provide, for keeping your credentials and authentication factors (including any multi-factor method you enable) secure, and for all activity under your account. Tell us immediately at grievance@driplnk.in if you believe your account has been compromised.",
      [
        "You agree not to:",
        "share your account with another person, or create accounts to evade enforcement action;",
        "use another person's identity, or misrepresent your affiliation with any person or entity;",
        "scrape, harvest, or resell platform data, including vendor pricing rules, without written permission.",
      ],
    ],
  },
  {
    id: "marketplace",
    heading: "Marketplace listings and licensing",
    body: [
      "Creators upload CAD files and list them on the marketplace. Listings may be free to acquire or priced; the price shown at the time you acquire a model is the price that applies. Because DripLnk uses an admin review queue, publication of a listing is not an endorsement of its fitness for any purpose.",
      "The licence that governs what you may do with an acquired model is the licence attached to that listing (for example Standard, CC-BY, Commercial or Personal Use), and is shown on the model page before you acquire it. If a listing is silent, you receive a personal, non-exclusive, non-transferable right to download and use the files for your own projects; you may not redistribute or resell the files themselves.",
      "Ownership of the underlying design stays with the creator, subject to the licence granted. Creators confirm on upload that they hold the rights needed to publish and license what they upload — see section 6 (Your content).",
    ],
  },
  {
    id: "mart",
    heading: "Mart print orders",
    body: [
      "When you place a Mart order you authorise a print of the file you uploaded, in the material and quantity quoted, by an independent vendor workshop on our network. Quotes are calculated from the geometry you upload; if the vendor determines on inspection that the file cannot be printed as quoted (unprintable geometry, unsupported material, wrong scale), we will contact you before proceeding or cancel the order with a full refund of any amounts held.",
      "Physical goods manufactured to your file are made to your specification. Because each print is produced to order, print orders generally cannot be cancelled once the vendor has started the job; see our Refund & Cancellation Policy for the windows that apply before and after production starts, and for reprint or refund remedies when a print fails our stated tolerance or arrives damaged.",
      "Vendors set their own capacity, materials and pricing. Delivery timelines shown at order time are estimates, not guarantees. Title in a printed part passes to you on delivery.",
    ],
  },
  {
    id: "freelance",
    heading: "Freelance engagements",
    body: [
      "Freelance work arranged through DripLnk is a contract between you (the client) and the independent designer (the freelancer). DripLnk provides the platform, escrow of agreed amounts where enabled, file delivery and status tracking, but is not a party to the design contract and does not supervise the work.",
      "The brief you submit, and the quote the freelancer accepts, define the deliverables. Unless you agree otherwise in writing through the platform, on completion you receive the deliverable files for the agreed project purpose, and the freelancer retains ownership of their pre-existing tools, scripts and portfolio rights.",
      "Escrow: where escrow is enabled for your engagement, funds you commit are held by us (or our payment partner) and released to the freelancer when you accept delivery, or automatically after you inspect the delivery within the window stated in our Refund & Cancellation Policy. Raise disputes through the platform before that window closes.",
    ],
  },
  {
    id: "content",
    heading: "Your content and intellectual property",
    body: [
      `"User content" means everything you upload or submit to the platform: model files, images, descriptions, comments, print files, briefs and messages. You keep ownership of your user content.`,
      [
        "You grant DripLnk a limited licence strictly to operate the service:",
        "to store, process and serve your files so the marketplace, viewer, quoting engine and download system work;",
        "to display your listing content (title, description, images, price) on the platform and in search results;",
        "to manufacture physical prints of files you submit for that purpose.",
      ],
      "This licence ends when you delete the content, except that (a) copies already acquired by other users under a valid licence are unaffected, (b) backups persist for a reasonable period, and (c) records we must keep for accounting, dispute resolution or legal compliance are retained as described in our Privacy Policy.",
      "You confirm that you own or have licensed all rights in your user content, that publishing it on DripLnk does not violate any law or third-party right (including copyright, patent, trademark, design registration or confidentiality), and that files you submit for printing do not include anyone else's proprietary design without permission.",
      "If you believe content on DripLnk infringes your rights, send a notice to grievance@driplnk.in identifying the work, the infringing material (URL), your contact details and a good-faith statement. We will review and, where the notice is valid, remove the material and may terminate repeat infringers' accounts.",
    ],
  },
  {
    id: "prohibited",
    heading: "Prohibited content and conduct",
    body: [
      "DripLnk is an intermediary under India's Information Technology Act, 2000, and we publish these rules as required by the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021. You must not upload, list, print, or transmit content that:",
      [
        "belongs to another person and to which you do not have any right;",
        "is defamatory, obscene, pornographic, paedophilic, invasive of another's privacy (including physical surveillance imagery of private spaces), insulting or harassing on the basis of gender, community, religion, race, caste, or disability, hateful, or otherwise unlawful;",
        "harmful to minors in any way;",
        "infringes any patent, trademark, copyright, design or other proprietary rights;",
        "violates any law for the time being in force, including laws governing weapons, ammunition, explosives, narcotics, or export controls — CAD files designed to function as weapons, weapon components, or firearm parts (including but not limited to functional lower/upper receivers, frames, suppressors/silencers, auto sears, rapid-fire conversion devices, ghost gun blueprints, or ammunition tooling) are strictly prohibited from upload, marketplace distribution, and Mart printing;",
        "deceives or misleads the addressee about the origin of a message or knowingly communicates any information which is patently false or misleading but may reasonably be perceived as a fact;",
        "impersonates another person;",
        "contains software viruses, malformed geometry intended to damage systems, or any code designed to disrupt the platform;",
        "is used for money laundering, fraud, or the sale of counterfeit goods.",
      ],
      "We may remove violating content, refuse printing, and report to law enforcement where required by law. Reports and complaints about prohibited content go to grievance@driplnk.in and are handled within the response window in our Privacy Policy.",
    ],
  },
  {
    id: "termination",
    heading: "Suspension and termination of accounts",
    body: [
      "We may suspend or terminate your account, and remove your content, if: you materially breach these Terms; we receive a valid complaint that your content infringes rights or violates the IT Rules 2021; you attempt to defraud buyers, vendors or the platform; you evade our review queues or payment controls; or we are required to do so by law or court order.",
      "Where practicable we will tell you why, by email to your account address, and give you a chance to respond — except where notice is legally prohibited or where content poses a risk to others.",
      "You may close your account at any time from your account settings. On closure: published listings are unpublished, pending Mart orders and escrowed freelance engagements are wound down under the Refund & Cancellation Policy, and we retain only the records described in our Privacy Policy.",
    ],
  },
  {
    id: "payments",
    heading: "Payments and credits",
    body: [
      "Prices are in Indian Rupees (INR). Payments are processed by our payment partners (including Razorpay when enabled); we do not store your full card details. Applicable taxes are shown at checkout. Invoices are issued by the operating entity; GST will be charged once we are GST-registered, and the Refund & Cancellation Policy states how invoices are handled for returns.",
      "Platform credits (if issued) are not legal tender, are non-transferable, have no cash value, and may be revoked if obtained through abuse or error.",
    ],
  },
  {
    id: "liability",
    heading: "Disclaimers and limitation of liability",
    body: [
      "The platform, marketplace content and downloadable models are provided on an \"as is\" and \"as available\" basis. To the fullest extent permitted by law, DripLnk disclaims warranties of merchantability, fitness for a particular purpose and non-infringement. We do not warrant that models will be error-free, printable, or fit for your application; that vendors will perform to schedule; or that the service will be uninterrupted.",
      "Nothing in these Terms limits liability that cannot be limited by law, including liability for death or personal injury caused by negligence, or for fraud.",
      "Subject to the paragraph above, DripLnk's total liability arising out of or in connection with these Terms or any order is limited to the greater of (a) the total amount you paid to DripLnk for the transaction giving rise to the claim, or (b) INR 5,000. We are not liable for indirect, incidental, special, consequential or punitive damages, or for loss of profit, data, or business opportunity.",
      "Because vendors and freelancers are independent providers, their obligations are theirs; our role is limited to coordination, escrow and the remedies stated in the Refund & Cancellation Policy.",
    ],
  },
  {
    id: "changes",
    heading: "Changes, governing law and disputes",
    body: [
      "We may update these Terms as the platform evolves. Material changes will be announced on the platform (and by email for significant ones) at least 7 days before they take effect. Continuing to use DripLnk after the effective date means you accept the updated Terms.",
      "These Terms are governed by the laws of India. The courts of [JURISDICTION — e.g. Bengaluru, Karnataka] have exclusive jurisdiction, subject to mandatory consumer-protection forum rules that may apply to you.",
      "Questions about these Terms: hello@driplnk.in. Formal complaints: grievance@driplnk.in (see our Privacy Policy for the Grievance Officer and response window).",
    ],
  },
];

export default function TermsPage() {
  return <LegalDoc title="Terms of Service" updated="September 13, 2026 (DRAFT)" sections={sections} />;
}
