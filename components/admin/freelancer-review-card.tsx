"use client";

import { useState } from "react";
import {
  Briefcase,
  Check,
  X,
  FileEdit,
  Eye,
  Link as LinkIcon,
  IndianRupee,
  Layers,
  Clock,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { updateProviderStatusAdmin } from "@/driplnk-web-backend/actions/admin";
import type { AdminPendingProvider } from "@/driplnk-web-backend/db/queries";
import { formatCurrency, formatDate } from "@/lib/format";
import { ProfileCompleteness } from "@/components/trust/profile-completeness";
import { RequestChangesModal } from "./request-changes-modal";

interface FreelancerReviewCardProps {
  provider: AdminPendingProvider;
}

export function FreelancerReviewCard({ provider }: FreelancerReviewCardProps) {
  const [loadingAction, setLoadingAction] = useState<"approve" | "reject" | null>(null);
  const [isChangesModalOpen, setIsChangesModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const toast = useToast();

  const details = provider.details;
  const name = details.display_name || provider.applicant_name;
  const skills = details.skills || [];
  const portfolioUrls = details.portfolio_urls || [];
  const rate = details.base_rate || 0;
  const rateType = details.rate_type || "hourly";

  // Parse structured bio if present
  const bio = details.bio || "";
  const titleMatch = bio.match(/Title:\s*([^·\n]+)/);
  const title = titleMatch ? titleMatch[1].trim() : "CAD Engineering Specialist";

  // Calculate completeness checklist
  const completenessItems = [
    { label: "Basic information & title", completed: Boolean(name && details.display_name) },
    { label: "CAD engineering skills", completed: skills.length > 0 },
    { label: "Portfolio repositories & files", completed: portfolioUrls.length > 0 },
    { label: "Hourly compensation rate", completed: rate > 0 },
    { label: "Verification agreements & contact", completed: bio.includes("Contact/ID") || bio.includes("I agree") || Boolean(details.bio) },
  ];

  async function handleApprove() {
    setLoadingAction("approve");
    try {
      const res = await updateProviderStatusAdmin({
        providerId: provider.provider_id,
        status: "approved",
      });
      if (res.success) {
        toast("success", `Freelancer ${name} approved and granted Verified status.`);
      } else {
        toast("error", res.error || "Failed to approve freelancer.");
      }
    } catch {
      toast("error", "An error occurred while approving the freelancer.");
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
        toast("warning", `Freelancer ${name} rejected.`);
      } else {
        toast("error", res.error || "Failed to reject freelancer.");
      }
    } catch {
      toast("error", "An error occurred while rejecting the freelancer.");
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
                <Briefcase className="size-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-display text-base font-semibold text-fg truncate">
                  {name}
                </h4>
                <p className="text-xs text-muted truncate">{title}</p>
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

          {/* Skills Grid */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted">
              Skills:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {skills.slice(0, 5).map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-line bg-canvas px-2.5 py-0.5 text-xs font-medium text-fg"
                >
                  {skill}
                </span>
              ))}
              {skills.length > 5 && (
                <span className="text-xs text-muted self-center">
                  +{skills.length - 5} more
                </span>
              )}
            </div>
          </div>

          {/* Portfolio & Rate Row */}
          <div className="grid grid-cols-2 gap-3 border-y border-line/60 py-3 text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[11px] uppercase text-muted">Portfolio:</span>
              <span className="font-medium text-fg inline-flex items-center gap-1">
                <LinkIcon className="size-3.5 text-accent" />
                {portfolioUrls.length} {portfolioUrls.length === 1 ? "link" : "links"}
              </span>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[11px] uppercase text-muted">Rate:</span>
              <span className="font-mono font-semibold text-accent">
                {formatCurrency(rate)}/{rateType === "hourly" ? "hr" : "fixed"}
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
            View Full Application
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
        applicantName={name}
        providerType="freelancer"
        isOpen={isChangesModalOpen}
        onClose={() => setIsChangesModalOpen(false)}
      />

      {/* View Full Application Modal */}
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
                <h3 className="font-display text-lg font-bold text-fg">{name}</h3>
                <p className="text-xs text-muted font-mono">{provider.applicant_email}</p>
              </div>
            </div>

            {/* Completeness full checklist */}
            <ProfileCompleteness items={completenessItems} />

            {/* Bio & Intro */}
            <div className="flex flex-col gap-1.5 rounded-[var(--radius-control)] border border-line bg-canvas p-4 text-xs">
              <span className="font-mono uppercase text-muted font-semibold text-[11px]">
                Bio / Introduction:
              </span>
              <p className="text-fg whitespace-pre-wrap leading-relaxed">
                {details.bio || "No bio submitted."}
              </p>
            </div>

            {/* Portfolio Links */}
            <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-canvas p-4 text-xs">
              <span className="font-mono uppercase text-muted font-semibold text-[11px]">
                Portfolio Links & Repositories ({portfolioUrls.length}):
              </span>
              {portfolioUrls.length === 0 ? (
                <span className="text-muted">No external portfolio links provided.</span>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {portfolioUrls.map((url, idx) => (
                    <a
                      key={idx}
                      href={url.startsWith("http") ? url : `https://${url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-accent hover:underline break-all"
                    >
                      <ExternalLink className="size-3 shrink-0" />
                      <span>{url}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Metadata Footer */}
            <div className="flex items-center justify-between text-xs text-muted border-t border-line pt-3 font-mono">
              <span>Applied: {formatDate(provider.created_at)}</span>
              <span>Rate: {formatCurrency(rate)}/{rateType}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
