"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Building2,
  MapPin,
  Layers,
  Wrench,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { applyVendor } from "@/driplnk-web-backend/actions/vendor";
import type { ProviderStatus, VendorProfile } from "@/lib/types";

interface VendorApplyFormProps {
  existingStatus?: ProviderStatus | null;
  existingProfile?: VendorProfile | null;
  isSignedIn: boolean;
}

const AVAILABLE_MATERIALS = [
  { id: "pla", label: "PLA+", desc: "Rapid prototyping & standard FDM" },
  { id: "petg", label: "PETG", desc: "Chemical & weather resistant" },
  { id: "abs", label: "ABS / ASA", desc: "High temp & UV enclosures" },
  { id: "resin", label: "Tough Resin", desc: "High precision SLA/MSLA" },
  { id: "nylon-cf", label: "Nylon PA12-CF", desc: "Industrial carbon fiber" },
];

export function VendorApplyForm({
  existingStatus,
  existingProfile,
  isSignedIn,
}: VendorApplyFormProps) {
  const router = useRouter();

  const [businessName, setBusinessName] = useState(existingProfile?.business_name || "");
  const [location, setLocation] = useState(existingProfile?.location || "");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(
    existingProfile?.materials_supported || ["pla", "petg"]
  );
  const [capacityNotes, setCapacityNotes] = useState(existingProfile?.capacity_notes || "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(existingStatus === "pending");

  const toggleMaterial = (id: string) => {
    setSelectedMaterials((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignedIn) {
      router.push("/login?redirect=/vendor/apply");
      return;
    }

    if (!businessName.trim() || businessName.trim().length < 2) {
      setError("Please provide a business or farm name (at least 2 characters).");
      return;
    }

    if (selectedMaterials.length === 0) {
      setError("Please select at least one supported material.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await applyVendor({
        businessName: businessName.trim(),
        location: location.trim() || undefined,
        materialsSupported: selectedMaterials,
        capacityNotes: capacityNotes.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error || "Failed to submit application. Please try again.");
      } else {
        setSubmitted(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  // 1. If approved, direct to vendor dashboard
  if (existingStatus === "approved") {
    return (
      <Card className="flex flex-col items-center gap-6 p-8 text-center sm:p-12">
        <div className="flex size-14 items-center justify-center rounded-full bg-accent-muted text-accent">
          <CheckCircle2 className="size-7" />
        </div>
        <div className="flex flex-col gap-2 max-w-md">
          <h2 className="font-display text-2xl font-bold text-fg">You are an Approved Vendor</h2>
          <p className="text-sm text-muted">
            Your print farm <span className="font-medium text-fg">{existingProfile?.business_name}</span> is active in the DripLnk Mart quote network.
          </p>
        </div>
        <ButtonLink href="/dashboard/vendor" size="lg" className="min-h-[44px] min-w-[44px]">
          Open Vendor Dashboard
          <ArrowRight className="size-4" />
        </ButtonLink>
      </Card>
    );
  }

  // 2. If submitted or pending, display explicit confirmation screen
  if (submitted || existingStatus === "pending") {
    return (
      <Card className="flex flex-col items-center gap-6 p-8 text-center sm:p-12 border-line bg-surface">
        <div className="flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
          <Clock className="size-7" />
        </div>
        <div className="flex flex-col gap-3 max-w-lg">
          <span className="inline-flex items-center gap-1.5 self-center rounded-full bg-amber-500/10 px-3 py-1 font-mono text-xs font-medium text-amber-400">
            Status: Under Founder Review
          </span>
          <h2 className="font-display text-2xl font-bold text-fg sm:text-3xl">
            Application Received
          </h2>
          <p className="text-base text-muted leading-relaxed">
            Thank you for applying to the DripLnk Mart network. Unlike open freelance profiles, all print hubs are vetted manually to ensure consistent build volumes, calibrated dimensional accuracy, and reliable regional fulfillment.
          </p>
          <div className="mt-4 rounded-[var(--radius-control)] border border-line bg-surface-muted/40 p-4 text-left text-sm text-muted">
            <p className="font-medium text-fg mb-1">What happens next:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Our engineering team verifies your printer fleet specs and sample tolerances.</li>
              <li>We will contact you to establish your custom per-gram pricing and turnaround SLAs.</li>
              <li>Once approved, incoming print orders will automatically appear in your Vendor Dashboard.</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <ButtonLink href="/mart" variant="secondary" className="min-h-[44px] min-w-[44px]">
            Explore DripLnk Mart
          </ButtonLink>
          <ButtonLink href="/dashboard" variant="ghost" className="min-h-[44px] min-w-[44px]">
            Return to Dashboard
          </ButtonLink>
        </div>
      </Card>
    );
  }

  // 3. New Application Form
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {error && (
        <div className="rounded-[var(--radius-control)] border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
          {error}
        </div>
      )}

      {/* Business Details */}
      <Card className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <Building2 className="size-5 text-accent" />
          <div>
            <h2 className="font-display text-lg font-medium text-fg">Hub & Farm Identity</h2>
            <p className="text-xs text-muted">How your print facility will be recognized in quote comparisons.</p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="businessName" className="text-sm font-medium text-fg">
              Business / Studio Name <span className="text-accent">*</span>
            </label>
            <input
              id="businessName"
              type="text"
              required
              placeholder="e.g. Apex 3D Labs, Hyperion Fab"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="h-11 rounded-[var(--radius-control)] border border-line bg-surface px-3.5 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="location" className="text-sm font-medium text-fg">
              Location / Region <span className="text-muted text-xs">(City, State)</span>
            </label>
            <div className="relative">
              <input
                id="location"
                type="text"
                placeholder="e.g. Bengaluru, KA"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface pl-9 pr-3.5 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
              />
              <MapPin className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted" />
            </div>
          </div>
        </div>
      </Card>

      {/* Materials Supported */}
      <Card className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <Layers className="size-5 text-accent" />
          <div>
            <h2 className="font-display text-lg font-medium text-fg">Supported Materials</h2>
            <p className="text-xs text-muted">Select all print materials your machines can reliably deliver.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AVAILABLE_MATERIALS.map((mat) => {
            const isSelected = selectedMaterials.includes(mat.id);
            return (
              <button
                type="button"
                key={mat.id}
                onClick={() => toggleMaterial(mat.id)}
                className={`flex flex-col items-start gap-1.5 rounded-[var(--radius-card)] border p-4 text-left transition-all min-h-[56px] ${
                  isSelected
                    ? "border-accent bg-accent-muted/30 text-fg"
                    : "border-line bg-surface hover:border-line-hover text-muted hover:text-fg"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-mono text-sm font-medium text-fg">{mat.label}</span>
                  {isSelected && <CheckCircle2 className="size-4 text-accent" />}
                </div>
                <span className="text-xs text-muted">{mat.desc}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Fleet & Capacity Notes */}
      <Card className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <Wrench className="size-5 text-accent" />
          <div>
            <h2 className="font-display text-lg font-medium text-fg">Fleet & Capacity Notes</h2>
            <p className="text-xs text-muted">Printer models, maximum build volume, and turnaround capabilities.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="capacityNotes" className="text-sm font-medium text-fg">
            Fleet Specifications & Turnaround
          </label>
          <textarea
            id="capacityNotes"
            rows={4}
            placeholder="e.g. 4x Bambu Lab X1-Carbon (256x256x256 mm), 2x Voron 2.4 (350x350x350 mm), Formlabs Form 3+. Typical turnaround 24-48 hours for engineering prototypes."
            value={capacityNotes}
            onChange={(e) => setCapacityNotes(e.target.value)}
            className="rounded-[var(--radius-control)] border border-line bg-surface p-3.5 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </div>
      </Card>

      {/* Submit Action */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-muted">
          <ShieldCheck className="size-4 text-accent" />
          <span>Manual vetting ensures zero race-to-the-bottom pricing.</span>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={submitting}
          className="w-full sm:w-auto min-h-[44px] min-w-[44px]"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Submitting Application...
            </>
          ) : (
            <>
              Submit Vendor Application
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
