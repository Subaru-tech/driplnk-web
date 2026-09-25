"use client";

import { useState } from "react";
import {
  Factory,
  Check,
  X,
  FileEdit,
  Eye,
  MapPin,
  Printer,
  Layers,
  Box,
  CreditCard,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { updateProviderStatusAdmin } from "@/driplnk-web-backend/actions/admin";
import type { AdminPendingProvider } from "@/driplnk-web-backend/db/queries";
import { formatDate } from "@/lib/format";
import { ProfileCompleteness } from "@/components/trust/profile-completeness";
import { RequestChangesModal } from "./request-changes-modal";
import type { VendorApplicationData } from "@/components/vendor/apply-form";

interface VendorReviewCardProps {
  provider: AdminPendingProvider;
}

export function VendorReviewCard({ provider }: VendorReviewCardProps) {
  const [loadingAction, setLoadingAction] = useState<"approve" | "reject" | null>(null);
  const [isChangesModalOpen, setIsChangesModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const toast = useToast();

  const details = provider.details;
  const businessName = details.business_name || provider.applicant_name;
  const location = details.location || "Unspecified Location";
  const materials = details.materials_supported || [];

  // Parse structured application JSON from capacity_notes if present
  let appData: Partial<VendorApplicationData> | null = null;
  if (details.capacity_notes) {
    try {
      appData = JSON.parse(details.capacity_notes);
    } catch {
      // Legacy unformatted text
    }
  }

  const gstin = appData?.gstin || "Not provided";
  const printerCount = appData?.printerCount || "1+";
  const buildVolX = appData?.buildVolumeX || "256";
  const buildVolY = appData?.buildVolumeY || "256";
  const buildVolZ = appData?.buildVolumeZ || "256";
  const buildVolumeText = `${buildVolX} × ${buildVolY} × ${buildVolZ} mm`;

  // Calculate completeness
  const completenessItems = [
    { label: "Business legal identity & contact", completed: Boolean(businessName && details.location) },
    { label: "Business verification & GSTIN", completed: Boolean(appData?.gstin || appData?.registrationDetails) },
    { label: "Printer fleet specs & build volume", completed: Boolean(appData?.printerCount && appData?.buildVolumeX) },
    { label: "Materials catalog & technologies", completed: materials.length > 0 },
    { label: "Operations SLA & payout setup", completed: Boolean(appData?.turnaround && (appData?.accountNumber || appData?.upiId)) },
  ];

  async function handleApprove() {
    setLoadingAction("approve");
    try {
      const res = await updateProviderStatusAdmin({
        providerId: provider.provider_id,
        status: "approved",
      });
      if (res.success) {
        toast("success", `Print Vendor ${businessName} approved for Mart order routing.`);
      } else {
        toast("error", res.error || "Failed to approve vendor.");
      }
    } catch {
      toast("error", "An error occurred while approving the vendor.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleReject() {
    setLoadingAction("reject");
    try {
      const res = await updateProviderStatusAdmin({
        providerId: provider.provider_id,
        status: "rejected",
      });
      if (res.success) {
        toast("warning", `Print Vendor ${businessName} rejected.`);
      } else {
        toast("error", res.error || "Failed to reject vendor.");
      }
    } catch {
      toast("error", "An error occurred while rejecting the vendor.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <>
      <Card className="flex flex-col justify-between gap-5 p-5 sm:p-6 border-line bg-surface hover:border-line-strong transition-all shadow-xs">
        <div className="flex flex-col gap-4">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg border border-line bg-canvas text-accent">
                <Factory className="size-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-display text-base font-semibold text-fg truncate">
                  {businessName}
                </h4>
                <p className="text-xs text-muted truncate flex items-center gap-1">
                  <MapPin className="size-3 text-faint" />
                  {location}
                </p>
              </div>
            </div>

            <StatusPill
              tone={
                provider.status === "approved"
                  ? "accent"
                  : provider.status === "changes_requested"
                  ? "warning"
                  : provider.status === "rejected"
                  ? "danger"
                  : "warning"
              }
            >
              {provider.status === "changes_requested" ? "Changes Requested" : provider.status}
            </StatusPill>
          </div>

          {/* Admin Notes if changes requested */}
          {provider.admin_notes && (
            <div className="rounded-[var(--radius-control)] bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-400">
              <span className="font-semibold font-mono uppercase text-[10px]">Feedback Note:</span>{" "}
              {provider.admin_notes}
            </div>
          )}

          {/* Grid of Key Manufacturing Parameters */}
          <div className="grid grid-cols-2 gap-3 border-y border-line/60 py-3 text-xs">
            {/* GSTIN */}
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[11px] uppercase text-muted">GSTIN:</span>
              <span className="font-mono font-medium text-fg truncate">{gstin}</span>
            </div>

            {/* Printers */}
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[11px] uppercase text-muted">Printers:</span>
              <span className="font-mono font-semibold text-fg inline-flex items-center gap-1">
                <Printer className="size-3.5 text-accent" />
                {printerCount} active
              </span>
            </div>

            {/* Materials */}
            <div className="flex flex-col gap-0.5 col-span-2">
              <span className="font-mono text-[11px] uppercase text-muted">Materials:</span>
              <span className="font-medium text-fg">
                {materials.length > 0 ? materials.join(" · ") : "Standard Materials"}
              </span>
            </div>

            {/* Build Volume */}
            <div className="flex flex-col gap-0.5 col-span-2">
              <span className="font-mono text-[11px] uppercase text-muted">Build Volume:</span>
              <span className="font-mono font-medium text-accent inline-flex items-center gap-1">
                <Box className="size-3.5" />
                {buildVolumeText}
              </span>
            </div>
          </div>

          {/* Profile Completeness */}
          <ProfileCompleteness items={completenessItems} compact showDisclaimer={false} />
        </div>

        {/* Actions Row */}
        <div className="flex flex-col gap-2 pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsDetailsModalOpen(true)}
            className="w-full justify-center gap-1.5"
          >
            <Eye className="size-3.5" />
            View Verification
          </Button>

          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="primary"
              size="sm"
              loading={loadingAction === "approve"}
              disabled={loadingAction !== null}
              onClick={handleApprove}
              className="justify-center gap-1 text-xs"
            >
              <Check className="size-3.5" />
              Approve
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsChangesModalOpen(true)}
              className="justify-center gap-1 text-xs text-amber-400 hover:text-amber-300"
            >
              <FileEdit className="size-3.5" />
              Changes
            </Button>

            <Button
              variant="danger"
              size="sm"
              loading={loadingAction === "reject"}
              disabled={loadingAction !== null}
              onClick={handleReject}
              className="justify-center gap-1 text-xs"
            >
              <X className="size-3.5" />
              Reject
            </Button>
          </div>
        </div>
      </Card>

      {/* Request Changes Modal */}
      <RequestChangesModal
        providerId={provider.provider_id}
        applicantName={businessName}
        providerType="vendor"
        isOpen={isChangesModalOpen}
        onClose={() => setIsChangesModalOpen(false)}
      />

      {/* View Verification Modal */}
      {isDetailsModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-in fade-in"
        >
          <div className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8 shadow-2xl flex flex-col gap-5">
            <button
              type="button"
              onClick={() => setIsDetailsModalOpen(false)}
              className="absolute top-4 right-4 rounded p-1 text-muted hover:text-fg transition-colors"
            >
              <X className="size-5" />
            </button>

            <div className="border-b border-line pb-4 flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-accent-muted text-accent">
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-fg">{businessName}</h3>
                <p className="text-xs text-muted font-mono">{provider.applicant_email}</p>
              </div>
            </div>

            {/* Completeness full checklist */}
            <ProfileCompleteness items={completenessItems} />

            {/* Legal & Contact Info */}
            <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-canvas p-4 text-xs">
              <span className="font-mono uppercase text-muted font-semibold text-[11px]">
                Business Verification & Contact
              </span>
              <p><span className="text-muted">GSTIN:</span> <span className="font-mono font-medium text-fg">{gstin}</span></p>
              <p><span className="text-muted">Registration:</span> <span className="font-medium text-fg">{appData?.registrationDetails || "Proprietorship"}</span></p>
              <p><span className="text-muted">Contact Person:</span> <span className="font-medium text-fg">{appData?.contactPerson || provider.applicant_name}</span></p>
              <p><span className="text-muted">Phone:</span> <span className="font-medium text-fg">{appData?.phone || "—"}</span></p>
              <p><span className="text-muted">Address:</span> <span className="font-medium text-fg">{appData?.address ? `${appData.address}, ` : ""}{location}</span></p>
              {appData?.websiteUrl && (
                <p>
                  <span className="text-muted">Website:</span>{" "}
                  <a href={appData.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline inline-flex items-center gap-1">
                    {appData.websiteUrl} <ExternalLink className="size-3" />
                  </a>
                </p>
              )}
            </div>

            {/* Manufacturing Capabilities & Operations */}
            <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-canvas p-4 text-xs">
              <span className="font-mono uppercase text-muted font-semibold text-[11px]">
                Fleet & Operational Parameters
              </span>
              <p><span className="text-muted">Printer Count:</span> <span className="font-mono font-medium text-fg">{printerCount} active machines</span></p>
              <p><span className="text-muted">Build Volume:</span> <span className="font-mono font-medium text-fg">{buildVolumeText}</span></p>
              <p><span className="text-muted">Technologies:</span> <span className="font-medium text-fg">{appData?.printerTechnologies?.join(", ") || "FDM, SLA"}</span></p>
              <p><span className="text-muted">Materials:</span> <span className="font-medium text-fg">{materials.join(", ")}</span></p>
              <p><span className="text-muted">Turnaround SLA:</span> <span className="font-medium text-fg">{appData?.turnaround || "24-48 hours"}</span></p>
              <p><span className="text-muted">Capacity:</span> <span className="font-medium text-fg">{appData?.maxCapacity || "Standard"}</span></p>
              <p><span className="text-muted">Regions:</span> <span className="font-medium text-fg">{appData?.serviceRegions?.join(", ") || "Pan-India"}</span></p>
            </div>

            {/* Payout Details */}
            <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-canvas p-4 text-xs">
              <span className="font-mono uppercase text-muted font-semibold text-[11px]">
                Payout Settlement Information
              </span>
              {appData?.payoutMethod === "upi" ? (
                <p><span className="text-muted">UPI ID:</span> <span className="font-mono font-semibold text-fg">{appData.upiId}</span></p>
              ) : (
                <>
                  <p><span className="text-muted">Beneficiary:</span> <span className="font-medium text-fg">{appData?.beneficiaryName || "—"}</span></p>
                  <p><span className="text-muted">Account Number:</span> <span className="font-mono font-semibold text-fg">{appData?.accountNumber ? `••••${appData.accountNumber.slice(-4)}` : "—"}</span></p>
                  <p><span className="text-muted">IFSC Code:</span> <span className="font-mono font-semibold text-fg">{appData?.ifsc || "—"}</span></p>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-muted border-t border-line pt-3 font-mono">
              <span>Applied: {formatDate(provider.created_at)}</span>
              <span>Status: {provider.status.toUpperCase()}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
