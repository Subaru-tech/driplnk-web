"use client";

import { Flag, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { submitModelReport } from "@/driplnk-web-backend/actions/admin";

export function ReportModelButton({
  modelId,
  modelTitle,
  userSignedIn,
  userEmail,
}: {
  modelId: string;
  modelTitle?: string;
  userSignedIn: boolean;
  userEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<"stolen_design" | "weapon_content" | "counterfeit" | "other">("stolen_design");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState(userEmail || "");
  const [submitting, setSubmitting] = useState(false);

  const toast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contact.trim()) {
      toast("error", "Please provide a contact email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitModelReport({
        modelId,
        reporterContact: contact.trim(),
        reason,
        evidenceUrl: evidenceUrl.trim() || undefined,
        details: details.trim() || undefined,
      });

      if (res.success) {
        toast("success", "Report received. An admin will review this design within 72 hours.");
        setOpen(false);
        setEvidenceUrl("");
        setDetails("");
      } else {
        toast("error", res.error || "Failed to submit report.");
      }
    } catch {
      toast("error", "An unexpected error occurred while submitting your report.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!userSignedIn) {
    return (
      <div className="flex items-center justify-between text-xs text-muted pt-2 border-t border-line/60">
        <span className="flex items-center gap-1.5 text-faint">
          <Flag className="size-3.5" />
          <span>Notice an issue with this design?</span>
        </span>
        <Link
          href={`/sign-in?redirect_url=/models/${modelId}`}
          className="text-muted hover:text-fg underline underline-offset-2 transition-colors"
        >
          Sign in to report
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between text-xs text-muted pt-2 border-t border-line/60">
        <span className="flex items-center gap-1.5 text-faint">
          <Flag className="size-3.5" />
          <span>Design rights or policy inquiry?</span>
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-muted hover:text-danger transition-colors font-medium cursor-pointer"
        >
          <span>Report design</span>
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Report this 3D Design">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          <p className="text-muted leading-relaxed">
            Submit an intellectual property infringement claim or safety violation report for{" "}
            <span className="font-semibold text-fg">&ldquo;{modelTitle || "this model"}&rdquo;</span>.
            Reports are handled in accordance with India&apos;s IT Rules 2021 and platform terms.
          </p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="report-reason" className="font-semibold text-fg">
              Reason for Report *
            </label>
            <select
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
              className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-fg focus:border-accent focus:outline-none"
            >
              <option value="stolen_design">Stolen Design / Copyright Infringement</option>
              <option value="weapon_content">Prohibited Weapon or Firearm Part</option>
              <option value="counterfeit">Counterfeit / Misleading Origin</option>
              <option value="other">Other Safety or Platform Violation</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="evidence-url" className="font-semibold text-fg">
              Evidence / Original Design URL
            </label>
            <input
              id="evidence-url"
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="e.g. https://www.printables.com/model/... or portfolio link"
              className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-fg placeholder:text-faint focus:border-accent focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="report-details" className="font-semibold text-fg">
              Details & Explanation
            </label>
            <textarea
              id="report-details"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe why this model infringes your copyright or violates platform policies..."
              className="rounded-lg border border-line bg-surface p-3 text-xs text-fg placeholder:text-faint focus:border-accent focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="reporter-contact" className="font-semibold text-fg">
              Your Contact Email *
            </label>
            <input
              id="reporter-contact"
              type="email"
              required
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="you@domain.com"
              className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-fg placeholder:text-faint focus:border-accent focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              loading={submitting}
            >
              Submit Report
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
