"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  X,
  Send,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Paperclip,
  Trash2,
} from "lucide-react";
import {
  submitFreelanceRequest,
  uploadFreelanceFile,
} from "@/driplnk-web-backend/actions/freelance";
import type { FreelancerProfile } from "@/lib/types";

export function HireModal({
  freelancer,
  isOpen,
  onClose,
}: {
  freelancer: FreelancerProfile;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [brief, setBrief] = useState("");
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successRequestId, setSuccessRequestId] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    setReferenceFiles((prev) => [...prev, ...files]);
  }

  function removeFile(index: number) {
    setReferenceFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const cleanBrief = brief.trim();
    if (cleanBrief.length < 10) {
      setErrorMessage("Please enter a brief of at least 10 characters describing your project.");
      return;
    }

    startTransition(async () => {
      try {
        const finalFilePaths: string[] = [];

        // Upload reference files through the server action: it verifies the
        // session, caps size/type, and pins the path to the caller's own
        // folder — the old browser-direct upload granted any anon-key holder
        // write access to every user folder.
        if (referenceFiles.length > 0) {
          setIsUploadingFiles(true);

          for (const file of referenceFiles) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("kind", "reference");

            const up = await uploadFreelanceFile(formData);
            if (!up.success || !up.filePath) {
              setErrorMessage(up.error || "A reference file failed to upload.");
              setIsUploadingFiles(false);
              return;
            }
            finalFilePaths.push(up.filePath);
          }
          setIsUploadingFiles(false);
        }

        const res = await submitFreelanceRequest({
          freelancerProviderId: freelancer.provider_id,
          brief: cleanBrief,
          referenceFilePaths: finalFilePaths,
        });

        if (!res.success || !res.data?.requestId) {
          setErrorMessage(res.error || "Failed to submit request.");
          return;
        }

        setSuccessRequestId(res.data.requestId);
      } catch (err) {
        console.error("Hire request submission error:", err);
        setErrorMessage(err instanceof Error ? err.message : "Failed to submit hire request.");
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hire_modal_title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8 shadow-2xl">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 grid size-11 place-items-center rounded-[var(--radius-control)] text-muted transition-colors hover:bg-raised hover:text-fg"
        >
          <X className="size-5" />
        </button>

        {successRequestId ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-accent-muted text-accent">
              <CheckCircle2 className="size-8" />
            </div>
            <h3 className="font-display text-xl font-bold text-fg">Hire Request Submitted!</h3>
            <p className="max-w-md text-sm text-muted">
              Your project brief was sent to{" "}
              <strong className="text-fg">{freelancer.display_name}</strong>. They will review
              the scope and accept with the agreed price.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link
                href="/dashboard/freelance-requests"
                className="inline-flex h-11 items-center justify-center rounded-[var(--radius-control)] bg-accent px-6 text-sm font-semibold text-accent-contrast shadow hover:bg-accent/90"
              >
                View My Requests
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-[var(--radius-control)] border border-line bg-surface px-6 text-sm font-medium text-fg hover:bg-raised"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-accent">
                Part & CAD Request
              </span>
              <h2 id="hire_modal_title" className="mt-1 font-display text-xl font-bold text-fg">
                Hire {freelancer.display_name}
              </h2>
              <p className="mt-1 text-xs text-muted">
                Base rate:{" "}
                <span className="font-mono font-medium text-fg">
                  ₹{freelancer.base_rate.toLocaleString("en-IN")}{" "}
                  {freelancer.rate_type === "hourly" ? "/ hr" : "fixed"}
                </span>
                . Final milestone price is set manually by the specialist upon review.
              </p>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-[var(--radius-control)] border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400"
              >
                <AlertCircle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Project Brief */}
            <div className="flex flex-col gap-2">
              <label htmlFor="project_brief" className="text-sm font-medium text-fg">
                Project Brief & Requirements <span className="text-accent">*</span>
              </label>
              <textarea
                id="project_brief"
                required
                rows={5}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Detail what you need: part purpose, dimensions, mating components, target 3D print process (FDM/SLA/SLS), or send PCB DXF for enclosure design..."
                className="w-full rounded-[var(--radius-control)] border border-line bg-canvas p-3.5 text-sm text-fg placeholder:text-faint focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Optional Reference Files */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-fg">
                Reference Files & Sketches (Optional)
              </label>
              <label
                htmlFor="ref_files_input"
                className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-dashed border-line bg-canvas/60 px-4 py-3 text-xs text-muted hover:border-line-strong hover:text-fg"
              >
                <UploadCloud className="size-4 text-accent" />
                <span>Choose STEP, STL, DXF, PDF or image references...</span>
              </label>
              <input
                id="ref_files_input"
                type="file"
                multiple
                onChange={handleFilesSelected}
                className="sr-only"
              />

              {referenceFiles.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {referenceFiles.map((file, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between rounded border border-line bg-canvas px-3 py-1.5 text-xs text-fg"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Paperclip className="size-3.5 text-muted" />
                        <span className="truncate">{file.name}</span>
                        <span className="font-mono text-faint">
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="grid size-11 place-items-center rounded text-muted hover:text-red-400"
                        aria-label={`Remove file ${file.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-[var(--radius-control)] border border-line bg-canvas/40 p-3 text-xs leading-relaxed text-muted">
              🔒 <strong>Offline coordination note:</strong> Once{" "}
              {freelancer.display_name} accepts your request, each party&apos;s registered email
              address will be displayed in your dashboard to coordinate deliverables and payments
              directly.
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending || isUploadingFiles}
                className="inline-flex min-h-[44px] items-center rounded-[var(--radius-control)] border border-line bg-surface px-4 text-sm font-medium text-muted hover:text-fg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || isUploadingFiles}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-6 font-display text-sm font-semibold text-accent-contrast hover:bg-accent/90 disabled:opacity-50"
              >
                {isPending || isUploadingFiles ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Submitting Brief...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Request</span>
                    <Send className="size-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
