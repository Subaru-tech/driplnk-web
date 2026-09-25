"use client";

import { useState } from "react";
import { AlertCircle, FileEdit, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { updateProviderStatusAdmin } from "@/driplnk-web-backend/actions/admin";

interface RequestChangesModalProps {
  providerId: string;
  applicantName: string;
  providerType: "vendor" | "freelancer";
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const FREELANCER_PRESETS = [
  "Please provide active portfolio links or 3D model repositories.",
  "Please add specific CAD software certifications or tolerance specs.",
  "Please provide a direct contact handle (WhatsApp/Discord) for rush briefs.",
];

const VENDOR_PRESETS = [
  "Please provide a valid GSTIN or Udyam MSME registration document.",
  "Please upload photos or specifications of your calibrated printer fleet.",
  "Please clarify your build volume envelope and monthly filament capacity.",
  "Please verify bank beneficiary details and IFSC code.",
];

export function RequestChangesModal({
  providerId,
  applicantName,
  providerType,
  isOpen,
  onClose,
  onSuccess,
}: RequestChangesModalProps) {
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  if (!isOpen) return null;

  const presets = providerType === "vendor" ? VENDOR_PRESETS : FREELANCER_PRESETS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!notes.trim()) {
      toast("error", "Please specify the changes or missing details required from the applicant.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await updateProviderStatusAdmin({
        providerId,
        status: "changes_requested",
        notes: notes.trim(),
      });

      if (res.success) {
        toast(
          "success",
          `Changes requested for ${applicantName}. They have been notified to update their application.`
        );
        onClose();
        if (onSuccess) onSuccess();
      } else {
        toast("error", res.error || "Failed to request changes.");
      }
    } catch {
      toast("error", "An unexpected error occurred while requesting changes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-changes-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-in fade-in"
    >
      <div className="relative w-full max-w-lg rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded p-1 text-muted hover:text-fg transition-colors"
          aria-label="Close dialog"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-line pb-4">
          <div className="grid size-9 place-items-center rounded-lg bg-amber-500/10 text-amber-400">
            <FileEdit className="size-5" />
          </div>
          <div>
            <h3 id="request-changes-title" className="font-display text-base font-semibold text-fg">
              Request Changes
            </h3>
            <p className="text-xs text-muted">
              Guide <span className="font-medium text-fg">{applicantName}</span> to correct or provide missing details.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="change_notes" className="text-xs font-medium text-fg">
              Feedback & Required Revisions <span className="text-accent">*</span>
            </label>
            <textarea
              id="change_notes"
              rows={4}
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Please update your GSTIN number to a valid 15-character ID and attach at least two photos of physical print tolerances..."
              className="w-full rounded-[var(--radius-control)] border border-line bg-canvas p-3 text-xs text-fg placeholder:text-faint focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Quick presets */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-mono uppercase text-muted">Quick suggestions:</span>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNotes((prev) => (prev ? `${prev}\n${preset}` : preset))}
                  className="rounded-full border border-line/60 bg-canvas/60 px-2.5 py-1 text-[11px] text-muted hover:border-line-strong hover:text-fg text-left transition-colors"
                >
                  + {preset.slice(0, 45)}...
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-[var(--radius-control)] bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-400/90 leading-relaxed">
            <AlertCircle className="size-4 shrink-0" />
            <span>
              Requesting changes avoids outright rejection. The applicant can resubmit without starting over.
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submitting}>
              Send Change Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
