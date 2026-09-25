import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/marketing/legal-doc";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description:
    "Cancellation windows, reprint and refund remedies for Mart print orders, and cancellation and escrow terms for freelance engagements on DripLnk.",
};

/**
 * ⚠️ DRAFT — PENDING LAWYER REVIEW ⚠️
 * Drafted now, before Razorpay is live, because Mart orders already commit
 * real pricing. Payment references describe the intended gateway behaviour;
 * counsel should reconcile with the final Razorpay agreement.
 */

const sections: LegalSection[] = [
  {
    id: "scope",
    heading: "Scope",
    body: [
      "This policy covers cancellations and refunds for (a) Mart print orders — physical parts manufactured to your file by a vendor on our network — and (b) freelance engagements arranged through the platform. It forms part of our Terms of Service.",
      "All amounts are in Indian Rupees. Where online payments are enabled (Razorpay), refunds are processed back to the original payment method. Until the payment gateway is live, orders commit price but are settled directly with the hub; refunds in that interim are coordinated manually and this policy governs them in the same way.",
      "Nothing in this policy limits remedies that cannot be excluded under Indian consumer law, including the Consumer Protection (E-Commerce) Rules, 2020.",
    ],
  },
  {
    id: "mart-cancellation",
    heading: "Mart orders — cancellation",
    body: [
      [
        "A Mart order moves through stages: placed → pending_vendor_response → accepted → printing → shipped → delivered. Your cancellation rights depend on the stage:",
        "Before a vendor accepts (placed / pending_vendor_response): cancel free at any time from your order page. Any amount held is refunded in full.",
        "After a vendor accepts but before printing starts: cancel within 2 hours of acceptance for a full refund. After that, the vendor has committed machine time and cancellation may be refused or charged; we will tell you which before processing.",
        "Once printing has started: the order cannot be cancelled, because the part is manufactured to your specification.",
        "After shipping: the order cannot be cancelled; the delivery-damage and wrong-part remedies below apply instead.",
      ],
      "To cancel, open the order in your dashboard and use the cancel action, or email hello@driplnk.in with your order ID. Cancellation requests before production always beat the SLA reassignment timer — if your cancel lands in the same instant as a vendor accept, the order is not double-processed and the refund follows this policy.",
    ],
  },
  {
    id: "mart-remedies",
    heading: "Mart orders — reprints and refunds",
    body: [
      [
        "If something goes wrong with the physical part, tell us within 7 days of delivery with photos of the part and packaging:",
        "Print fails our stated tolerance for the material, or is unusable due to a manufacturing defect: free reprint, or a full refund if you prefer.",
        "Wrong material, wrong scale, or wrong part delivered: free reprint or full refund, your choice.",
        "Damaged in transit: reprint or refund once we have the photos; we handle the carrier claim.",
        "Part matches the file and quoted tolerances but does not fit your application: this is a design outcome, not a defect — it is not eligible for refund, but we will reprint at quoted cost if the file is corrected.",
      ],
      "File issues: if the vendor determines your file cannot be printed as quoted (unprintable geometry, non-manifold mesh, unsupported feature), we contact you before proceeding. If you cannot supply a corrected file, the order is cancelled and any amount held is refunded in full.",
      "Refund timelines: approved refunds are initiated within 5–7 business days of the decision; your bank or card issuer typically posts them 5–10 business days later. Platform credits, where issued instead, are credited immediately.",
    ],
  },
  {
    id: "freelance",
    heading: "Freelance engagements",
    body: [
      "Freelance work is a contract between you and the independent designer, with DripLnk providing escrow and delivery tooling. The agreed quote covers the agreed brief; changes to scope are agreed through the platform before work continues.",
      [
        "Cancellation windows:",
        "Before the freelancer accepts the request: cancel free, full release of any escrowed amount.",
        "After acceptance, before work starts: cancel for a full refund minus any platform fee already incurred, within 24 hours of acceptance.",
        "Work in progress: cancel by agreement with the freelancer; escrowed funds are released pro-rata for milestones already delivered, and the balance returns to you.",
        "Delivered work: if you reject a delivery, raise it through the platform within 7 days with specific reasons. The freelancer gets one correction cycle against the agreed brief; if the delivery still does not conform, escrowed funds for that milestone are refunded to you. If it does conform, funds release to the freelancer.",
      ],
      "Escrow is not a payment for the freelancer until you accept the delivery or the review window closes without a dispute. Disputes go to grievance@driplnk.in; we mediate against the agreed brief, and our decision on escrow release is final under this policy.",
    ],
  },
  {
    id: "models",
    heading: "Marketplace model purchases",
    body: [
      "Digital models are delivered immediately on acquisition. Because the files are downloadable and, once downloaded, cannot be returned, model purchases are non-refundable except where: the files are corrupt or materially not as described (refund or fixed replacement); you were charged twice (duplicate refunded in full); or the listing is removed by us for policy reasons before you could download (full refund).",
      "Free acquisitions can be re-claimed at no cost and are not covered by refunds.",
    ],
  },
  {
    id: "charges",
    heading: "Chargebacks and abuse",
    body: [
      "Please contact us before filing a chargeback — most issues resolve faster through the remedies above. Where a refund has already been issued, filing a chargeback for the same transaction may result in account suspension until the matter is resolved.",
      "We may refuse remedies that rely on misrepresentation (false damage claims, files altered after quoting, repeated refund abuse), and will always explain the reason in writing.",
    ],
  },
  {
    id: "contact",
    heading: "Questions and escalation",
    body: [
      "Start with hello@driplnk.in and your order or request ID. If a remedy is refused and you disagree, or you get no response within 5 business days, escalate to our Grievance Officer at grievance@driplnk.in — see the Privacy Policy for the named officer and response timelines.",
    ],
  },
];

export default function RefundPolicyPage() {
  return (
    <LegalDoc
      title="Refund & Cancellation Policy"
      updated="September 13, 2026 (DRAFT)"
      sections={sections}
    />
  );
}
