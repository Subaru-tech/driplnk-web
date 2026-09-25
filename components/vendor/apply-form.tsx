"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ShieldCheck,
  Layers,
  Wrench,
  CreditCard,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  ExternalLink,
  Save,
  AlertCircle,
  Loader2,
  ArrowRight,
  Printer,
  Eye,
  EyeOff,
  Truck,
  MapPin,
  Mail,
  Phone,
  User,
  Check,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { applyVendor } from "@/driplnk-web-backend/actions/vendor";
import type { ProviderStatus, VendorProfile } from "@/lib/types";
import { ProfileCompleteness } from "@/components/trust/profile-completeness";
import { cn } from "@/lib/cn";

const VENDOR_DRAFT_KEY = "driplnk_vendor_apply_draft_v2";

const DEFAULT_PRINTER_TECHS = ["FDM", "SLA", "SLS"];
const ALL_PRINTER_TECHS = ["FDM", "SLA", "SLS", "MJF", "Metal 3D Printing (DMLS)"];

const DEFAULT_MATERIALS = ["PLA", "PETG", "ABS", "TPU", "Nylon", "Resins"];
const ALL_MATERIALS = [
  "PLA",
  "PETG",
  "ABS",
  "TPU",
  "Nylon",
  "Resins",
  "Carbon Fiber (CF)",
  "PEEK / High-Temp",
  "ASA",
  "Polycarbonate (PC)",
];

const DEFAULT_CAPABILITIES = [
  "Multi-color",
  "Multi-material",
  "SLA",
  "Acetone / Vapor Smoothing",
  "Threaded Inserts & Assembly",
  "Large Format Printing",
  "Annealing & Heat Treatment",
  "100% Infill Functional Parts",
];

const TURNAROUND_OPTIONS = [
  "24–48 hours (Rush / Rapid Prototypes)",
  "3–5 business days (Standard Production)",
  "5–7 business days (Batch Runs)",
];

const CAPACITY_OPTIONS = [
  "50–200 parts / month",
  "200–500 parts / month",
  "500–2,000 parts / month",
  "2,000+ parts / month (Industrial Fleet)",
];

const REGION_OPTIONS = [
  "Pan-India",
  "South India (KA, TN, KL, AP, TS)",
  "North India (DL, HR, UP, PB, RJ)",
  "West India (MH, GJ, GA)",
  "East / North-East India",
];

const SHIPPING_OPTIONS = [
  "Standard Courier (Bluedart / Delhivery / DTDC)",
  "Express Air Shipping (Next-day delivery)",
  "Local Facility Pickup",
  "Secure Wooden Crating / Heavy Fragile",
];

export type VendorApplicationData = {
  // Business
  businessName: string;
  contactPerson: string;
  businessEmail: string;
  phone: string;
  address: string;
  city: string;
  state: string;

  // Business verification
  gstin: string;
  registrationDetails: string;
  websiteUrl: string;

  // Capabilities
  printerTechnologies: string[];
  materialsSupported: string[];
  buildVolumeX: string;
  buildVolumeY: string;
  buildVolumeZ: string;
  printerCount: string;
  capabilities: string[];

  // Operations
  turnaround: string;
  maxCapacity: string;
  serviceRegions: string[];
  shippingCapabilities: string[];

  // Payout
  payoutMethod: "bank" | "upi";
  beneficiaryName: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;

  savedAt?: string;
};

interface VendorApplyFormProps {
  existingStatus?: ProviderStatus | null;
  adminNotes?: string | null;
  existingProfile?: VendorProfile | null;
  isSignedIn: boolean;
  initialEmail?: string;
  initialName?: string;
}

export function VendorApplyForm({
  existingStatus,
  adminNotes,
  existingProfile,
  isSignedIn,
  initialEmail,
  initialName,
}: VendorApplyFormProps) {
  const router = useRouter();

  // Try parsing existing application JSON if saved in capacity_notes
  let parsedExisting: Partial<VendorApplicationData> | null = null;
  if (existingProfile?.capacity_notes) {
    try {
      parsedExisting = JSON.parse(existingProfile.capacity_notes);
    } catch {
      // Legacy plain text notes
    }
  }

  // 1. BUSINESS
  const [businessName, setBusinessName] = useState(
    parsedExisting?.businessName || existingProfile?.business_name || ""
  );
  const [contactPerson, setContactPerson] = useState(
    parsedExisting?.contactPerson || initialName || ""
  );
  const [businessEmail, setBusinessEmail] = useState(
    parsedExisting?.businessEmail || initialEmail || ""
  );
  const [phone, setPhone] = useState(parsedExisting?.phone || "");
  const [address, setAddress] = useState(parsedExisting?.address || "");
  const [city, setCity] = useState(
    parsedExisting?.city ||
      (existingProfile?.location ? existingProfile.location.split(",")[0]?.trim() : "") ||
      ""
  );
  const [stateVal, setStateVal] = useState(
    parsedExisting?.state ||
      (existingProfile?.location ? existingProfile.location.split(",")[1]?.trim() : "") ||
      ""
  );

  // 2. BUSINESS VERIFICATION
  const [gstin, setGstin] = useState(parsedExisting?.gstin || "");
  const [registrationDetails, setRegistrationDetails] = useState(
    parsedExisting?.registrationDetails || ""
  );
  const [websiteUrl, setWebsiteUrl] = useState(parsedExisting?.websiteUrl || "");

  // 3. MANUFACTURING CAPABILITIES
  const [printerTechnologies, setPrinterTechnologies] = useState<string[]>(
    parsedExisting?.printerTechnologies || DEFAULT_PRINTER_TECHS
  );
  const [materials, setMaterials] = useState<string[]>(
    parsedExisting?.materialsSupported || existingProfile?.materials_supported || DEFAULT_MATERIALS
  );
  const [buildVolumeX, setBuildVolumeX] = useState(parsedExisting?.buildVolumeX || "256");
  const [buildVolumeY, setBuildVolumeY] = useState(parsedExisting?.buildVolumeY || "256");
  const [buildVolumeZ, setBuildVolumeZ] = useState(parsedExisting?.buildVolumeZ || "256");
  const [printerCount, setPrinterCount] = useState(parsedExisting?.printerCount || "4");
  const [capabilities, setCapabilities] = useState<string[]>(
    parsedExisting?.capabilities || [
      "Multi-color",
      "Multi-material",
      "SLA",
      "Acetone / Vapor Smoothing",
    ]
  );
  const [customCapability, setCustomCapability] = useState("");

  // 4. OPERATIONS
  const [turnaround, setTurnaround] = useState(
    parsedExisting?.turnaround || TURNAROUND_OPTIONS[0]
  );
  const [maxCapacity, setMaxCapacity] = useState(
    parsedExisting?.maxCapacity || CAPACITY_OPTIONS[1]
  );
  const [serviceRegions, setServiceRegions] = useState<string[]>(
    parsedExisting?.serviceRegions || ["Pan-India"]
  );
  const [shippingCapabilities, setShippingCapabilities] = useState<string[]>(
    parsedExisting?.shippingCapabilities || [
      "Standard Courier (Bluedart / Delhivery / DTDC)",
      "Express Air Shipping (Next-day delivery)",
    ]
  );

  // 5. PAYOUT
  const [payoutMethod, setPayoutMethod] = useState<"bank" | "upi">(
    parsedExisting?.payoutMethod || "bank"
  );
  const [beneficiaryName, setBeneficiaryName] = useState(parsedExisting?.beneficiaryName || "");
  const [accountNumber, setAccountNumber] = useState(parsedExisting?.accountNumber || "");
  const [ifsc, setIfsc] = useState(parsedExisting?.ifsc || "");
  const [upiId, setUpiId] = useState(parsedExisting?.upiId || "");

  // UI States
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(existingStatus === "pending");
  const [savedDraft, setSavedDraft] = useState<VendorApplicationData | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [showApplicationDetails, setShowApplicationDetails] = useState(false);

  // Check for local storage draft on mount
  useEffect(() => {
    if (existingStatus === "pending" || existingStatus === "approved") return;
    try {
      const raw = localStorage.getItem(VENDOR_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as VendorApplicationData;
        const timer = setTimeout(() => {
          setSavedDraft(parsed);
        }, 0);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore parse failure
    }
  }, [existingStatus]);

  function restoreDraft(draft: VendorApplicationData) {
    if (draft.businessName) setBusinessName(draft.businessName);
    if (draft.contactPerson) setContactPerson(draft.contactPerson);
    if (draft.businessEmail) setBusinessEmail(draft.businessEmail);
    if (draft.phone) setPhone(draft.phone);
    if (draft.address) setAddress(draft.address);
    if (draft.city) setCity(draft.city);
    if (draft.state) setStateVal(draft.state);

    if (draft.gstin) setGstin(draft.gstin);
    if (draft.registrationDetails) setRegistrationDetails(draft.registrationDetails);
    if (draft.websiteUrl) setWebsiteUrl(draft.websiteUrl);

    if (draft.printerTechnologies?.length) setPrinterTechnologies(draft.printerTechnologies);
    if (draft.materialsSupported?.length) setMaterials(draft.materialsSupported);
    if (draft.buildVolumeX) setBuildVolumeX(draft.buildVolumeX);
    if (draft.buildVolumeY) setBuildVolumeY(draft.buildVolumeY);
    if (draft.buildVolumeZ) setBuildVolumeZ(draft.buildVolumeZ);
    if (draft.printerCount) setPrinterCount(draft.printerCount);
    if (draft.capabilities?.length) setCapabilities(draft.capabilities);

    if (draft.turnaround) setTurnaround(draft.turnaround);
    if (draft.maxCapacity) setMaxCapacity(draft.maxCapacity);
    if (draft.serviceRegions?.length) setServiceRegions(draft.serviceRegions);
    if (draft.shippingCapabilities?.length) setShippingCapabilities(draft.shippingCapabilities);

    if (draft.payoutMethod) setPayoutMethod(draft.payoutMethod);
    if (draft.beneficiaryName) setBeneficiaryName(draft.beneficiaryName);
    if (draft.accountNumber) setAccountNumber(draft.accountNumber);
    if (draft.ifsc) setIfsc(draft.ifsc);
    if (draft.upiId) setUpiId(draft.upiId);

    if (draft.savedAt) setDraftSavedAt(draft.savedAt);
    setSavedDraft(null);
  }

  function handleSaveDraft() {
    try {
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const draftData: VendorApplicationData = {
        businessName,
        contactPerson,
        businessEmail,
        phone,
        address,
        city,
        state: stateVal,
        gstin,
        registrationDetails,
        websiteUrl,
        printerTechnologies,
        materialsSupported: materials,
        buildVolumeX,
        buildVolumeY,
        buildVolumeZ,
        printerCount,
        capabilities,
        turnaround,
        maxCapacity,
        serviceRegions,
        shippingCapabilities,
        payoutMethod,
        beneficiaryName,
        accountNumber,
        ifsc,
        upiId,
        savedAt: now,
      };
      localStorage.setItem(VENDOR_DRAFT_KEY, JSON.stringify(draftData));
      setDraftSavedAt(now);
      setError(null);
    } catch {
      setError("Could not save application draft to local storage.");
    }
  }

  // Toggles
  const toggleTech = (tech: string) => {
    setPrinterTechnologies((prev) =>
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]
    );
  };

  const toggleMaterial = (mat: string) => {
    setMaterials((prev) =>
      prev.includes(mat) ? prev.filter((m) => m !== mat) : [...prev, mat]
    );
  };

  const toggleCapability = (cap: string) => {
    setCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  };

  const addCustomCapability = () => {
    const trimmed = customCapability.trim();
    if (!trimmed || capabilities.includes(trimmed)) return;
    setCapabilities([...capabilities, trimmed]);
    setCustomCapability("");
  };

  const toggleRegion = (region: string) => {
    setServiceRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
  };

  const toggleShipping = (ship: string) => {
    setShippingCapabilities((prev) =>
      prev.includes(ship) ? prev.filter((s) => s !== ship) : [...prev, ship]
    );
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanBusinessName = businessName.trim();
    if (!cleanBusinessName || cleanBusinessName.length < 2) {
      setError("Please provide your business or legal entity name.");
      return;
    }

    if (!contactPerson.trim()) {
      setError("Please provide a primary contact person.");
      return;
    }

    if (!businessEmail.trim() || !businessEmail.includes("@")) {
      setError("Please provide a valid business email address.");
      return;
    }

    if (!phone.trim()) {
      setError("Please provide an operations phone number for dispatch.");
      return;
    }

    if (!city.trim() || !stateVal.trim()) {
      setError("Please provide your facility city and state.");
      return;
    }

    if (printerTechnologies.length === 0) {
      setError("Please select at least one printer technology (e.g. FDM, SLA).");
      return;
    }

    if (materials.length === 0) {
      setError("Please select at least one production material.");
      return;
    }

    if (payoutMethod === "bank") {
      if (!beneficiaryName.trim() || !accountNumber.trim() || !ifsc.trim()) {
        setError("Please complete your bank payout details (Beneficiary, Account No, IFSC).");
        return;
      }
    } else {
      if (!upiId.trim() || !upiId.includes("@")) {
        setError("Please provide a valid UPI ID for production payouts.");
        return;
      }
    }

    if (!isSignedIn) {
      handleSaveDraft();
      setError(
        "Please sign in or create an account to submit your application. Your draft has been saved locally."
      );
      setTimeout(() => {
        router.push("/login?redirect=/vendor/apply");
      }, 1500);
      return;
    }

    setSubmitting(true);

    try {
      const fullApplicationData: VendorApplicationData = {
        businessName: cleanBusinessName,
        contactPerson: contactPerson.trim(),
        businessEmail: businessEmail.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        state: stateVal.trim(),
        gstin: gstin.trim(),
        registrationDetails: registrationDetails.trim(),
        websiteUrl: websiteUrl.trim(),
        printerTechnologies,
        materialsSupported: materials,
        buildVolumeX: buildVolumeX.trim() || "256",
        buildVolumeY: buildVolumeY.trim() || "256",
        buildVolumeZ: buildVolumeZ.trim() || "256",
        printerCount: printerCount.trim() || "1",
        capabilities,
        turnaround,
        maxCapacity,
        serviceRegions,
        shippingCapabilities,
        payoutMethod,
        beneficiaryName: beneficiaryName.trim(),
        accountNumber: accountNumber.trim(),
        ifsc: ifsc.trim().toUpperCase(),
        upiId: upiId.trim(),
      };

      const res = await applyVendor({
        businessName: cleanBusinessName,
        location: `${city.trim()}, ${stateVal.trim()}`,
        materialsSupported: materials,
        capacityNotes: JSON.stringify(fullApplicationData),
      });

      if (!res.success) {
        setError(res.error || "Failed to submit vendor application. Please try again.");
      } else {
        try {
          localStorage.removeItem(VENDOR_DRAFT_KEY);
        } catch {
          // Ignore
        }
        setSubmitted(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  // 1. APPROVED SCREEN
  if (existingStatus === "approved") {
    return (
      <Card className="flex flex-col items-center gap-6 p-8 text-center sm:p-12 border-line bg-surface">
        <div className="flex size-14 items-center justify-center rounded-full bg-accent-muted text-accent">
          <CheckCircle2 className="size-7" />
        </div>
        <div className="flex flex-col gap-2 max-w-md">
          <h2 className="font-display text-2xl font-bold text-fg">Approved Manufacturing Partner</h2>
          <p className="text-sm text-muted">
            Your print farm <span className="font-medium text-fg">{businessName || existingProfile?.business_name}</span> is an active, verified manufacturing hub on DripLnk Mart.
          </p>
        </div>
        <ButtonLink href="/dashboard/vendor" size="lg" className="min-h-[44px] min-w-[44px]">
          Open Vendor Dashboard
          <ArrowRight className="size-4" />
        </ButtonLink>
      </Card>
    );
  }

  // 2. APPLICATION RECEIVED / UNDER ADMIN REVIEW SCREEN
  if (submitted || existingStatus === "pending") {
    return (
      <div className="flex flex-col gap-6">
        <Card className="flex flex-col items-center gap-6 p-8 text-center sm:p-12 border-line bg-surface">
          {/* Header */}
          <div className="flex flex-col items-center gap-2">
            <span className="font-mono text-xs font-semibold tracking-widest text-accent uppercase">
              Application Received
            </span>
            <h2 className="font-display text-2xl font-bold text-fg sm:text-3xl">
              APPLICATION RECEIVED
            </h2>
          </div>

          {/* Submission Checklist */}
          <div className="w-full max-w-md rounded-[var(--radius-control)] border border-line bg-canvas/60 p-5 text-left text-sm">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-line/60 pb-2.5">
                <span className="text-fg font-medium">Business verification</span>
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-accent">
                  <Check className="size-3.5 stroke-[2.5]" /> Submitted
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-line/60 pb-2.5">
                <span className="text-fg font-medium">Capabilities</span>
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-accent">
                  <Check className="size-3.5 stroke-[2.5]" /> Submitted
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-fg font-medium">Payout information</span>
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-accent">
                  <Check className="size-3.5 stroke-[2.5]" /> Submitted
                </span>
              </div>
            </div>
          </div>

          {/* Status Callout */}
          <div className="flex flex-col items-center gap-2 pt-2">
            <span className="font-mono text-xs uppercase tracking-wider text-muted">Status:</span>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 font-mono text-xs font-semibold text-amber-400">
              <Clock className="size-3.5 animate-pulse" />
              UNDER ADMIN REVIEW
            </div>
            <p className="mt-2 max-w-md text-sm text-muted leading-relaxed">
              We&apos;ll notify you when your application has been reviewed.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-line w-full max-w-md">
            <button
              type="button"
              onClick={() => setShowApplicationDetails(!showApplicationDetails)}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-6 text-sm font-medium text-fg hover:bg-raised transition-colors"
            >
              {showApplicationDetails ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              <span>{showApplicationDetails ? "Hide Application" : "View Application"}</span>
            </button>
            <ButtonLink href="/mart" variant="secondary" className="min-h-[44px]">
              Explore Mart
            </ButtonLink>
          </div>
        </Card>

        {/* View Application Drawer / Expanded Details */}
        {showApplicationDetails && (
          <Card className="flex flex-col gap-6 p-6 sm:p-8 border-line bg-surface">
            <div className="border-b border-line pb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-fg">
                  Submitted Application Record
                </h3>
                <p className="text-xs text-muted">
                  Review the exact verification and operational parameters submitted to DripLnk admins.
                </p>
              </div>
              <ShieldCheck className="size-5 text-accent" />
            </div>

            <div className="grid gap-6 sm:grid-cols-2 text-xs">
              {/* Business Info */}
              <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-canvas p-4">
                <span className="font-mono uppercase text-accent font-semibold text-[11px]">
                  01. Business & Legal
                </span>
                <p><span className="text-muted">Legal Name:</span> <span className="font-medium text-fg">{businessName || "—"}</span></p>
                <p><span className="text-muted">Contact:</span> <span className="font-medium text-fg">{contactPerson || "—"}</span></p>
                <p><span className="text-muted">Email:</span> <span className="font-medium text-fg">{businessEmail || "—"}</span></p>
                <p><span className="text-muted">Phone:</span> <span className="font-medium text-fg">{phone || "—"}</span></p>
                <p><span className="text-muted">Location:</span> <span className="font-medium text-fg">{address ? `${address}, ` : ""}{city}, {stateVal}</span></p>
              </div>

              {/* Verification */}
              <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-canvas p-4">
                <span className="font-mono uppercase text-accent font-semibold text-[11px]">
                  02. Verification
                </span>
                <p><span className="text-muted">GSTIN:</span> <span className="font-mono font-medium text-fg">{gstin || "Not provided / Unregistered"}</span></p>
                <p><span className="text-muted">Registration / CIN:</span> <span className="font-medium text-fg">{registrationDetails || "Proprietorship / Studio"}</span></p>
                <p><span className="text-muted">Website:</span> <span className="font-medium text-fg">{websiteUrl || "—"}</span></p>
              </div>

              {/* Capabilities */}
              <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-canvas p-4">
                <span className="font-mono uppercase text-accent font-semibold text-[11px]">
                  03. Fleet & Materials
                </span>
                <p><span className="text-muted">Technologies:</span> <span className="font-medium text-fg">{printerTechnologies.join(", ") || "—"}</span></p>
                <p><span className="text-muted">Materials:</span> <span className="font-medium text-fg">{materials.join(", ") || "—"}</span></p>
                <p><span className="text-muted">Build Volume:</span> <span className="font-mono font-medium text-fg">{buildVolumeX} × {buildVolumeY} × {buildVolumeZ} mm</span></p>
                <p><span className="text-muted">Printer Fleet:</span> <span className="font-mono font-medium text-fg">{printerCount} active machines</span></p>
                <p><span className="text-muted">Specializations:</span> <span className="font-medium text-fg">{capabilities.join(", ") || "Standard printing"}</span></p>
              </div>

              {/* Operations & Payout */}
              <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-canvas p-4">
                <span className="font-mono uppercase text-accent font-semibold text-[11px]">
                  04. Operations & Payout
                </span>
                <p><span className="text-muted">Turnaround:</span> <span className="font-medium text-fg">{turnaround}</span></p>
                <p><span className="text-muted">Capacity:</span> <span className="font-medium text-fg">{maxCapacity}</span></p>
                <p><span className="text-muted">Regions:</span> <span className="font-medium text-fg">{serviceRegions.join(", ")}</span></p>
                <p><span className="text-muted">Payout:</span> <span className="font-medium text-fg">{payoutMethod === "bank" ? `Bank: ${beneficiaryName} (IFSC: ${ifsc})` : `UPI: ${upiId}`}</span></p>
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // 3. APPLICATION FORM
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-[var(--radius-control)] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400"
        >
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Saved Draft Banner */}
      {savedDraft && !error && (
        <div
          role="status"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[var(--radius-control)] border border-accent/40 bg-accent-muted/20 p-4 text-xs text-accent"
        >
          <div className="flex items-center gap-2">
            <Save className="size-4 shrink-0" />
            <span>
              A saved draft application from {savedDraft.savedAt || "a previous session"} was found.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => restoreDraft(savedDraft)}
              className="rounded bg-accent px-3 py-1.5 font-semibold text-accent-contrast shadow-sm hover:bg-accent/90 transition-colors"
            >
              Restore Draft
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(VENDOR_DRAFT_KEY);
                setSavedDraft(null);
              }}
              className="px-2 py-1 text-muted hover:text-fg transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {draftSavedAt && !error && (
        <div
          role="status"
          className="flex items-center justify-between rounded-[var(--radius-control)] border border-line bg-surface/80 px-4 py-3 text-xs text-muted"
        >
          <div className="flex items-center gap-2">
            <Save className="size-4 text-accent" />
            <span>Vendor draft saved locally at {draftSavedAt}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(VENDOR_DRAFT_KEY);
              setDraftSavedAt(null);
            }}
            className="text-xs text-muted underline hover:text-fg"
          >
            Clear draft
          </button>
        </div>
      )}

      {/* Reviewer Changes Requested Feedback */}
      {existingStatus === "changes_requested" && adminNotes && (
        <div className="rounded-[var(--radius-control)] border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1.5">
            <AlertCircle className="size-4 shrink-0" />
            <span>Action Required: Changes Requested by Reviewer</span>
          </div>
          <p className="text-sm text-fg leading-relaxed whitespace-pre-line pl-6">
            {adminNotes}
          </p>
        </div>
      )}

      {/* VALUE PROPOSITION: How It Works */}
      <div className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-gradient-to-b from-surface to-canvas p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
            How It Works
          </span>
          <h2 className="font-display text-2xl font-bold text-fg">
            Become a Manufacturing Partner
          </h2>
          <p className="text-sm text-muted leading-relaxed max-w-2xl">
            Receive qualified manufacturing orders matched to your equipment, materials, and capacity. Direct-to-farm routing with guaranteed settlements.
          </p>
        </div>

        {/* 4-Step Pipeline Flow */}
        <div className="grid gap-3 sm:grid-cols-4 pt-1">
          <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-canvas/80 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-accent">01</span>
              <Printer className="size-4 text-muted" />
            </div>
            <span className="font-semibold text-fg text-xs">Capabilities</span>
            <p className="text-[11px] text-muted leading-relaxed">
              Declare printer technologies, materials, build volumes, and active fleet size.
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-canvas/80 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-accent">02</span>
              <ShieldCheck className="size-4 text-muted" />
            </div>
            <span className="font-semibold text-fg text-xs">Business Verification</span>
            <p className="text-[11px] text-muted leading-relaxed">
              Submit legal entity details, GSTIN, or studio credentials for verified compliance.
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-canvas/80 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-accent">03</span>
              <Clock className="size-4 text-muted" />
            </div>
            <span className="font-semibold text-fg text-xs">Operations</span>
            <p className="text-[11px] text-muted leading-relaxed">
              Define production turnaround SLAs, batch volumes, and dispatch regions.
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-canvas/80 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-accent">04</span>
              <CreditCard className="size-4 text-muted" />
            </div>
            <span className="font-semibold text-fg text-xs">Settlement</span>
            <p className="text-[11px] text-muted leading-relaxed">
              Direct automated bank or UPI settlements dispatched on order delivery.
            </p>
          </div>
        </div>
      </div>

      {/* Profile Completeness Meter with Dual-Metric Verification Status */}
      <ProfileCompleteness
        items={[
          {
            label: "Manufacturing capabilities",
            completed: materials.length > 0 && printerTechnologies.length > 0,
          },
          {
            label: "Business verification (GSTIN / Reg)",
            completed: Boolean(
              businessName.trim() &&
                businessEmail.trim() &&
                phone.trim() &&
                city.trim() &&
                (gstin.trim() || registrationDetails.trim())
            ),
          },
          {
            label: "Operations & capacity",
            completed: Boolean(turnaround.trim() && maxCapacity.trim()),
          },
          {
            label: "Settlement & payout details",
            completed: Boolean(
              payoutMethod === "upi"
                ? upiId.trim()
                : beneficiaryName.trim() && accountNumber.trim() && ifsc.trim()
            ),
            hint: "Reviewed by DripLnk",
          },
        ]}
        verificationStatus={existingStatus}
      />

      {/* ========================================================================= */}
      {/* 01. CAPABILITIES & FLEET                                                  */}
      {/* ========================================================================= */}
      <section
        aria-labelledby="section-capabilities"
        className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8 shadow-sm"
      >
        <div className="border-b border-line pb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-accent uppercase tracking-wider">
                01
              </span>
              <h2 id="section-capabilities" className="font-display text-lg font-semibold text-fg">
                CAPABILITIES & FLEET
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted">
              Specify your printer fleet technology, supported material types, and machine envelope.
            </p>
          </div>
          <Printer className="size-5 text-muted/60" />
        </div>

        {/* Printer Technology */}
        <div className="flex flex-col gap-2.5">
          <label className="text-sm font-medium text-fg">
            Printer technology <span className="text-accent">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {ALL_PRINTER_TECHS.map((tech) => {
              const selected = printerTechnologies.includes(tech);
              return (
                <button
                  key={tech}
                  type="button"
                  onClick={() => toggleTech(tech)}
                  className={cn(
                    "inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer",
                    selected
                      ? "border-accent bg-accent/15 text-accent font-semibold shadow-xs"
                      : "border-line bg-canvas text-muted hover:text-fg hover:border-line-strong"
                  )}
                >
                  {selected && <Check className="size-3.5" />}
                  <span>{tech}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Materials */}
        <div className="flex flex-col gap-2.5 border-t border-line pt-5">
          <label className="text-sm font-medium text-fg">
            Materials <span className="text-accent">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {ALL_MATERIALS.map((mat) => {
              const selected = materials.includes(mat);
              return (
                <button
                  key={mat}
                  type="button"
                  onClick={() => toggleMaterial(mat)}
                  className={cn(
                    "inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer",
                    selected
                      ? "border-accent bg-accent/15 text-accent font-semibold shadow-xs"
                      : "border-line bg-canvas text-muted hover:text-fg hover:border-line-strong"
                  )}
                >
                  {selected && <Check className="size-3.5" />}
                  <span>{mat}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Build Volume & Printer Count */}
        <div className="grid gap-5 sm:grid-cols-2 border-t border-line pt-5">
          {/* Build Volume */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-fg">
              Build volume <span className="text-muted text-xs font-normal">(Maximum single-part envelope)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-1 rounded-[var(--radius-control)] border border-line bg-canvas px-2.5 py-1.5">
                <span className="font-mono text-xs font-semibold text-muted">X</span>
                <input
                  type="number"
                  min="50"
                  max="2000"
                  value={buildVolumeX}
                  onChange={(e) => setBuildVolumeX(e.target.value)}
                  className="w-full bg-transparent text-sm text-fg font-mono focus:outline-none"
                  placeholder="256"
                />
                <span className="font-mono text-[10px] text-muted">mm</span>
              </div>

              <div className="flex items-center gap-1 rounded-[var(--radius-control)] border border-line bg-canvas px-2.5 py-1.5">
                <span className="font-mono text-xs font-semibold text-muted">Y</span>
                <input
                  type="number"
                  min="50"
                  max="2000"
                  value={buildVolumeY}
                  onChange={(e) => setBuildVolumeY(e.target.value)}
                  className="w-full bg-transparent text-sm text-fg font-mono focus:outline-none"
                  placeholder="256"
                />
                <span className="font-mono text-[10px] text-muted">mm</span>
              </div>

              <div className="flex items-center gap-1 rounded-[var(--radius-control)] border border-line bg-canvas px-2.5 py-1.5">
                <span className="font-mono text-xs font-semibold text-muted">Z</span>
                <input
                  type="number"
                  min="50"
                  max="2000"
                  value={buildVolumeZ}
                  onChange={(e) => setBuildVolumeZ(e.target.value)}
                  className="w-full bg-transparent text-sm text-fg font-mono focus:outline-none"
                  placeholder="256"
                />
                <span className="font-mono text-[10px] text-muted">mm</span>
              </div>
            </div>
          </div>

          {/* Printer Count */}
          <div className="flex flex-col gap-2">
            <label htmlFor="vendor_printer_count" className="text-sm font-medium text-fg">
              Printer count <span className="text-accent">*</span>
            </label>
            <input
              id="vendor_printer_count"
              type="number"
              min="1"
              max="500"
              required
              value={printerCount}
              onChange={(e) => setPrinterCount(e.target.value)}
              placeholder="e.g. 4"
              className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 font-mono text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <span className="text-xs text-muted">Active operational machines in your facility</span>
          </div>
        </div>

        {/* Capabilities Chips */}
        <div className="flex flex-col gap-2.5 border-t border-line pt-5">
          <label className="text-sm font-medium text-fg">Capabilities</label>

          {/* Active / Selectable Capabilities */}
          <div className="flex flex-wrap items-center gap-2">
            {DEFAULT_CAPABILITIES.map((cap) => {
              const selected = capabilities.includes(cap);
              return (
                <button
                  key={cap}
                  type="button"
                  onClick={() => toggleCapability(cap)}
                  className={cn(
                    "inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer",
                    selected
                      ? "border-accent bg-accent/15 text-accent font-semibold shadow-xs"
                      : "border-line bg-canvas text-muted hover:text-fg hover:border-line-strong"
                  )}
                >
                  {selected && <Check className="size-3.5" />}
                  <span>{cap}</span>
                </button>
              );
            })}

            {/* Custom user-added capabilities */}
            {capabilities
              .filter((c) => !DEFAULT_CAPABILITIES.includes(c))
              .map((c) => (
                <span
                  key={c}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-1.5 text-xs font-medium text-accent shadow-xs"
                >
                  <Check className="size-3.5" />
                  <span>{c}</span>
                  <button
                    type="button"
                    onClick={() => toggleCapability(c)}
                    className="ml-1 text-muted hover:text-fg cursor-pointer"
                    aria-label={`Remove capability ${c}`}
                  >
                    ×
                  </button>
                </span>
              ))}
          </div>

          {/* Inline Add Custom Capability */}
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={customCapability}
              onChange={(e) => setCustomCapability(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomCapability();
                }
              }}
              placeholder="Add specialized capability (e.g. Ultrasonic Welding, Sanding, UV Coating)..."
              className="h-10 flex-1 rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 text-xs text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              type="button"
              onClick={addCustomCapability}
              className="inline-flex h-10 min-w-[48px] items-center justify-center gap-1 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-xs font-medium text-fg hover:bg-raised transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>[+]</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 02. BUSINESS VERIFICATION                                                 */}
      {/* ========================================================================= */}
      <section
        aria-labelledby="section-business-verification"
        className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8 shadow-sm"
      >
        <div className="border-b border-line pb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-accent uppercase tracking-wider">
                02
              </span>
              <h2 id="section-business-verification" className="font-display text-lg font-semibold text-fg">
                BUSINESS VERIFICATION
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted">
              Official studio or manufacturing facility legal identity, contact channels, and GSTIN credentials.
            </p>
          </div>
          <Building2 className="size-5 text-muted/60" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Business / Legal Name */}
          <div className="flex flex-col gap-2">
            <label htmlFor="vendor_business_name" className="text-sm font-medium text-fg">
              Business / legal name <span className="text-accent">*</span>
            </label>
            <input
              id="vendor_business_name"
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Apex 3D Labs LLP"
              className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Contact Person */}
          <div className="flex flex-col gap-2">
            <label htmlFor="vendor_contact_person" className="text-sm font-medium text-fg">
              Contact person <span className="text-accent">*</span>
            </label>
            <div className="relative">
              <User className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
              <input
                id="vendor_contact_person"
                type="text"
                required
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Full name"
                className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas pr-3 pl-10 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          {/* Business Email */}
          <div className="flex flex-col gap-2">
            <label htmlFor="vendor_email" className="text-sm font-medium text-fg">
              Business email <span className="text-accent">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
              <input
                id="vendor_email"
                type="email"
                required
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                placeholder="orders@apex3dlabs.com"
                className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas pr-3 pl-10 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-2">
            <label htmlFor="vendor_phone" className="text-sm font-medium text-fg">
              Phone <span className="text-accent">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
              <input
                id="vendor_phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas pr-3 pl-10 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          {/* Address */}
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor="vendor_address" className="text-sm font-medium text-fg">
              Facility address
            </label>
            <div className="relative">
              <MapPin className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
              <input
                id="vendor_address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Industrial area, plot / unit number, street address"
                className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas pr-3 pl-10 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          {/* City */}
          <div className="flex flex-col gap-2">
            <label htmlFor="vendor_city" className="text-sm font-medium text-fg">
              City <span className="text-accent">*</span>
            </label>
            <input
              id="vendor_city"
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Bengaluru / Pune"
              className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* State */}
          <div className="flex flex-col gap-2">
            <label htmlFor="vendor_state" className="text-sm font-medium text-fg">
              State <span className="text-accent">*</span>
            </label>
            <input
              id="vendor_state"
              type="text"
              required
              value={stateVal}
              onChange={(e) => setStateVal(e.target.value)}
              placeholder="e.g. Karnataka / Maharashtra"
              className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* GSTIN */}
          <div className="flex flex-col gap-2 border-t border-line/60 pt-4 sm:col-span-1">
            <label htmlFor="vendor_gstin" className="text-sm font-medium text-fg">
              GSTIN
            </label>
            <input
              id="vendor_gstin"
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="29AAAAA0000A1Z5"
              className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 font-mono text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <span className="text-xs text-muted">
              15-character Goods and Services Tax Identification Number.
            </span>
          </div>

          {/* Business Registration Details */}
          <div className="flex flex-col gap-2 border-t border-line/60 pt-4 sm:col-span-1">
            <label htmlFor="vendor_reg_details" className="text-sm font-medium text-fg">
              Business registration details
            </label>
            <input
              id="vendor_reg_details"
              type="text"
              value={registrationDetails}
              onChange={(e) => setRegistrationDetails(e.target.value)}
              placeholder="MSME / UDYAM-XX-00-0000000 or CIN / LLPIN"
              className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <span className="text-xs text-muted">
              Udyam MSME number, CIN, or shop establishment license.
            </span>
          </div>

          {/* Website / Social Link */}
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor="vendor_website" className="text-sm font-medium text-fg">
              Website / social link
            </label>
            <div className="relative">
              <ExternalLink className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
              <input
                id="vendor_website"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourprintstudio.com or LinkedIn company profile"
                className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas pr-3 pl-10 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 03. OPERATIONS & LOGISTICS                                                */}
      {/* ========================================================================= */}
      <section
        aria-labelledby="section-operations"
        className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8 shadow-sm"
      >
        <div className="border-b border-line pb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-accent uppercase tracking-wider">
                03
              </span>
              <h2 id="section-operations" className="font-display text-lg font-semibold text-fg">
                OPERATIONS & LOGISTICS
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted">
              Turnaround SLA, maximum monthly capacity, dispatch zones, and shipping methods.
            </p>
          </div>
          <Clock className="size-5 text-muted/60" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Typical Turnaround */}
          <div className="flex flex-col gap-2">
            <label htmlFor="vendor_turnaround" className="text-sm font-medium text-fg">
              Typical turnaround <span className="text-accent">*</span>
            </label>
            <div className="relative">
              <select
                id="vendor_turnaround"
                value={turnaround}
                onChange={(e) => setTurnaround(e.target.value)}
                className="h-11 w-full appearance-none rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 text-sm text-fg transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
              >
                {TURNAROUND_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted" />
            </div>
          </div>

          {/* Maximum Order Capacity */}
          <div className="flex flex-col gap-2">
            <label htmlFor="vendor_capacity" className="text-sm font-medium text-fg">
              Maximum order capacity <span className="text-accent">*</span>
            </label>
            <div className="relative">
              <select
                id="vendor_capacity"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(e.target.value)}
                className="h-11 w-full appearance-none rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 text-sm text-fg transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
              >
                {CAPACITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted" />
            </div>
          </div>
        </div>

        {/* Service Regions */}
        <div className="flex flex-col gap-2.5 border-t border-line pt-5">
          <label className="text-sm font-medium text-fg">
            Service regions <span className="text-accent">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {REGION_OPTIONS.map((region) => {
              const selected = serviceRegions.includes(region);
              return (
                <button
                  key={region}
                  type="button"
                  onClick={() => toggleRegion(region)}
                  className={cn(
                    "inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer",
                    selected
                      ? "border-accent bg-accent/15 text-accent font-semibold shadow-xs"
                      : "border-line bg-canvas text-muted hover:text-fg hover:border-line-strong"
                  )}
                >
                  {selected && <Check className="size-3.5" />}
                  <span>{region}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shipping Capability */}
        <div className="flex flex-col gap-2.5 border-t border-line pt-5">
          <label className="text-sm font-medium text-fg">
            Shipping capability <span className="text-accent">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {SHIPPING_OPTIONS.map((ship) => {
              const selected = shippingCapabilities.includes(ship);
              return (
                <button
                  key={ship}
                  type="button"
                  onClick={() => toggleShipping(ship)}
                  className={cn(
                    "inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer",
                    selected
                      ? "border-accent bg-accent/15 text-accent font-semibold shadow-xs"
                      : "border-line bg-canvas text-muted hover:text-fg hover:border-line-strong"
                  )}
                >
                  {selected && <Check className="size-3.5" />}
                  <span>{ship}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 04. SETTLEMENT & PAYOUT                                                   */}
      {/* ========================================================================= */}
      <section
        aria-labelledby="section-settlement"
        className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8 shadow-sm"
      >
        <div className="border-b border-line pb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-accent uppercase tracking-wider">
                04
              </span>
              <h2 id="section-settlement" className="font-display text-lg font-semibold text-fg">
                SETTLEMENT & PAYOUT
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted">
              Direct settlement account for fulfilled physical print order revenue.
            </p>
          </div>
          <CreditCard className="size-5 text-muted/60" />
        </div>

        {/* Method Selector */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setPayoutMethod("bank")}
            className={cn(
              "flex-1 rounded-[var(--radius-control)] border p-3 text-center text-sm font-medium transition-all cursor-pointer",
              payoutMethod === "bank"
                ? "border-accent bg-accent/10 text-accent font-semibold shadow-xs"
                : "border-line bg-canvas text-muted hover:text-fg"
            )}
          >
            Bank Transfer (NEFT / RTGS / IMPS)
          </button>
          <button
            type="button"
            onClick={() => setPayoutMethod("upi")}
            className={cn(
              "flex-1 rounded-[var(--radius-control)] border p-3 text-center text-sm font-medium transition-all cursor-pointer",
              payoutMethod === "upi"
                ? "border-accent bg-accent/10 text-accent font-semibold shadow-xs"
                : "border-line bg-canvas text-muted hover:text-fg"
            )}
          >
            UPI Settlement
          </button>
        </div>

        {payoutMethod === "bank" ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Beneficiary Name */}
            <div className="flex flex-col gap-2">
              <label htmlFor="vendor_beneficiary" className="text-sm font-medium text-fg">
                Account holder / Beneficiary name <span className="text-accent">*</span>
              </label>
              <input
                id="vendor_beneficiary"
                type="text"
                required={payoutMethod === "bank"}
                value={beneficiaryName}
                onChange={(e) => setBeneficiaryName(e.target.value)}
                placeholder="As per bank passbook / statement"
                className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Account Number */}
            <div className="flex flex-col gap-2">
              <label htmlFor="vendor_acc_num" className="text-sm font-medium text-fg">
                Bank account number <span className="text-accent">*</span>
              </label>
              <input
                id="vendor_acc_num"
                type="text"
                required={payoutMethod === "bank"}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. 0123456789012"
                className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 font-mono text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* IFSC Code */}
            <div className="flex flex-col gap-2">
              <label htmlFor="vendor_ifsc" className="text-sm font-medium text-fg">
                IFSC code <span className="text-accent">*</span>
              </label>
              <input
                id="vendor_ifsc"
                type="text"
                required={payoutMethod === "bank"}
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                placeholder="HDFC0001234"
                className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 font-mono text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <span className="text-xs text-muted">
                11-character Indian Financial System Code.
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor="vendor_upi" className="text-sm font-medium text-fg">
              UPI ID (VPA) <span className="text-accent">*</span>
            </label>
            <input
              id="vendor_upi"
              type="text"
              required={payoutMethod === "upi"}
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. apex3dlabs@okhdfcbank"
              className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 font-mono text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <span className="text-xs text-muted">
              Direct automated payout dispatch via UPI 2.0 merchant gateway.
            </span>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* ACTIONS                                                                   */}
      {/* ========================================================================= */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 pt-2">
        {/* [ Save Draft ] */}
        <button
          type="button"
          onClick={handleSaveDraft}
          className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-6 font-display text-sm font-semibold text-fg hover:bg-raised transition-colors"
        >
          <Save className="size-4 text-muted" />
          <span>Save Draft</span>
        </button>

        {/* [ Submit Application ] */}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-8 font-display text-sm font-semibold text-accent-contrast shadow-lg shadow-accent/20 transition-all hover:bg-accent/90 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Submitting Application...</span>
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              <span>Submit Application</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
