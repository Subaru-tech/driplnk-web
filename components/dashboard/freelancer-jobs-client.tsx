"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileUp,
  Mail,
  Paperclip,
  XCircle,
  Loader2,
  AlertCircle,
  Play,
} from "lucide-react";
import {
  respondToFreelanceRequest,
  getFreelanceFileDownloadUrl,
  uploadFreelanceFile,
} from "@/driplnk-web-backend/actions/freelance";
import type { FreelanceRequest, FreelanceRequestStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

export function FreelancerJobsClient({
  initialRequests,
}: {
  initialRequests: FreelanceRequest[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [requests, setRequests] = useState<FreelanceRequest[]>(initialRequests);
  const [filterTab, setFilterTab] = useState<string>("all");

  // Accept modal state
  const [acceptingRequestId, setAcceptingRequestId] = useState<string | null>(null);
  const [agreedPriceInput, setAgreedPriceInput] = useState<string>("1500");

  // Deliver modal state
  const [deliveringRequestId, setDeliveringRequestId] = useState<string | null>(null);
  const [deliverFile, setDeliverFile] = useState<File | null>(null);
  const [isUploadingDeliverable, setIsUploadingDeliverable] = useState(false);

  // Status and error messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  const filtered = requests.filter((r) => {
    if (filterTab === "all") return true;
    if (filterTab === "active") return r.status === "accepted" || r.status === "in_progress";
    return r.status === filterTab;
  });

  async function handleDownload(requestId: string, filePath: string) {
    setDownloadingFileId(filePath);
    try {
      const res = await getFreelanceFileDownloadUrl({ requestId, filePath });
      if (res.success && res.data?.downloadUrl) {
        window.open(res.data.downloadUrl, "_blank");
      } else {
        alert(res.error || "Failed to download file.");
      }
    } catch (err) {
      alert("Error generating download link.");
    } finally {
      setDownloadingFileId(null);
    }
  }

  function handleConfirmAccept(requestId: string) {
    const priceNum = Number(agreedPriceInput);
    if (isNaN(priceNum) || priceNum <= 0) {
      setErrorMessage("Please enter a valid positive agreed price in ₹ INR.");
      return;
    }

    startTransition(async () => {
      const res = await respondToFreelanceRequest({
        requestId,
        action: "accept",
        agreedPrice: priceNum,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to accept request.");
        return;
      }

      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, status: "accepted", agreed_price: priceNum } : r
        )
      );
      setAcceptingRequestId(null);
      router.refresh();
    });
  }

  function handleStartWork(requestId: string) {
    startTransition(async () => {
      const res = await respondToFreelanceRequest({
        requestId,
        action: "start_work",
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to update status.");
        return;
      }

      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: "in_progress" } : r))
      );
      router.refresh();
    });
  }

  async function handleConfirmDeliver(requestId: string) {
    if (!deliverFile) {
      setErrorMessage("Please select a file to upload as the deliverable.");
      return;
    }

    setIsUploadingDeliverable(true);
    setErrorMessage(null);

    try {
      // Server-side upload: session-verified, size/type capped, path pinned
      // to the freelancer's own folder by the action itself.
      const formData = new FormData();
      formData.append("file", deliverFile);
      formData.append("kind", "deliverable");
      const up = await uploadFreelanceFile(formData);

      if (!up.success || !up.filePath) {
        setErrorMessage(up.error || "Upload failed.");
        setIsUploadingDeliverable(false);
        return;
      }
      const storagePath = up.filePath;

      const res = await respondToFreelanceRequest({
        requestId,
        action: "deliver",
        finalFilePath: storagePath,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to mark delivered.");
        setIsUploadingDeliverable(false);
        return;
      }

      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? { ...r, status: "delivered", final_file_path: storagePath }
            : r
        )
      );
      setDeliveringRequestId(null);
      setDeliverFile(null);
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error delivering file.");
    } finally {
      setIsUploadingDeliverable(false);
    }
  }

  function handleCancel(requestId: string) {
    if (!confirm("Are you sure you want to decline or cancel this request?")) return;

    startTransition(async () => {
      const res = await respondToFreelanceRequest({
        requestId,
        action: "cancel",
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to cancel request.");
        return;
      }

      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: "cancelled" } : r))
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-[var(--radius-control)] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
        {[
          { id: "all", label: "All Requests" },
          { id: "requested", label: "Pending Review" },
          { id: "active", label: "Active Jobs" },
          { id: "delivered", label: "Delivered" },
          { id: "completed", label: "Completed" },
          { id: "cancelled", label: "Cancelled" },
        ].map((tab) => {
          const active = filterTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={cn(
                "inline-flex min-h-[44px] items-center rounded-[var(--radius-control)] px-4 py-2 text-xs font-medium transition-colors",
                active
                  ? "border border-accent bg-accent/15 text-accent font-semibold"
                  : "border border-line bg-surface text-muted hover:border-line-strong hover:text-fg"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Requests List */}
      {filtered.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line p-12 text-center">
          <p className="text-base font-medium text-fg">No requests found in this view.</p>
          <p className="mt-1 text-sm text-muted">
            Incoming briefs from buyers seeking custom CAD parts will appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((req) => {
            const hasEmail = Boolean(req.buyer_email);

            return (
              <div
                key={req.id}
                className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6 transition-colors hover:border-line-strong"
              >
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-muted font-display text-sm font-semibold text-accent overflow-hidden">
                      {req.buyer_avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={req.buyer_avatar} alt="" className="size-full object-cover" />
                      ) : (
                        req.buyer_name?.charAt(0).toUpperCase() || "B"
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-display text-base font-semibold text-fg">
                        {req.buyer_name || "Buyer"}
                      </span>
                      <span className="font-mono text-xs text-muted">
                        Requested {new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 font-mono text-xs font-semibold capitalize",
                        req.status === "requested" && "bg-amber-500/15 text-amber-400 border border-amber-500/30",
                        req.status === "accepted" && "bg-blue-500/15 text-blue-400 border border-blue-500/30",
                        req.status === "in_progress" && "bg-accent/20 text-accent border border-accent/40",
                        req.status === "delivered" && "bg-purple-500/15 text-purple-400 border border-purple-500/30",
                        req.status === "completed" && "bg-green-500/15 text-green-400 border border-green-500/30",
                        req.status === "cancelled" && "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30"
                      )}
                    >
                      {req.status.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {/* Coordination Email Banner (Explicitly revealed once accepted) */}
                {hasEmail && (
                  <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-accent/30 bg-accent-muted/15 p-3 text-xs text-fg">
                    <Mail className="size-4 shrink-0 text-accent" />
                    <span>
                      <strong>Buyer contact email:</strong>{" "}
                      <a
                        href={`mailto:${req.buyer_email}`}
                        className="font-mono text-accent hover:underline"
                      >
                        {req.buyer_email}
                      </a>{" "}
                      (Coordinate models, specs, and external payments directly)
                    </span>
                  </div>
                )}

                {/* Brief & Requirements */}
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-xs text-muted uppercase tracking-wider">
                    Project Brief
                  </span>
                  <p className="rounded-[var(--radius-control)] border border-line bg-canvas/60 p-4 text-sm leading-relaxed text-fg whitespace-pre-line">
                    {req.brief}
                  </p>
                </div>

                {/* Reference Files */}
                {req.reference_file_paths && req.reference_file_paths.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-xs text-muted uppercase tracking-wider">
                      Reference Files Attached ({req.reference_file_paths.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {req.reference_file_paths.map((path, idx) => (
                        <button
                          key={idx}
                          type="button"
                          disabled={downloadingFileId === path}
                          onClick={() => handleDownload(req.id, path)}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-control)] border border-line bg-canvas px-3 text-xs font-medium text-fg hover:border-line-strong hover:text-accent disabled:opacity-50"
                        >
                          <Paperclip className="size-3.5 text-muted" />
                          <span className="truncate max-w-[180px]">
                            {path.split("/").pop()}
                          </span>
                          <Download className="size-3 text-muted" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price & Actions Row */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-line/60 pt-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted">Agreed Price:</span>
                    <span className="font-mono text-sm font-semibold text-accent">
                      {req.agreed_price ? `₹${req.agreed_price.toLocaleString("en-IN")}` : "—"}
                    </span>
                  </div>

                  {/* Contextual Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {req.status === "requested" && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setAcceptingRequestId(req.id);
                            setAgreedPriceInput("1500");
                          }}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] bg-accent px-5 text-xs font-semibold text-accent-contrast hover:bg-accent/90"
                        >
                          Accept Request
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancel(req.id)}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-line bg-surface px-4 text-xs font-medium text-muted hover:text-red-400"
                        >
                          Decline
                        </button>
                      </>
                    )}

                    {req.status === "accepted" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStartWork(req.id)}
                          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-line bg-surface px-4 text-xs font-semibold text-fg hover:bg-raised hover:text-accent"
                        >
                          <Play className="size-3.5" />
                          <span>Start Working</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeliveringRequestId(req.id)}
                          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-accent px-5 text-xs font-semibold text-accent-contrast hover:bg-accent/90"
                        >
                          <FileUp className="size-3.5" />
                          <span>Deliver Files</span>
                        </button>
                      </>
                    )}

                    {req.status === "in_progress" && (
                      <button
                        type="button"
                        onClick={() => setDeliveringRequestId(req.id)}
                        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-accent px-5 text-xs font-semibold text-accent-contrast hover:bg-accent/90"
                      >
                        <FileUp className="size-3.5" />
                        <span>Deliver Final Part</span>
                      </button>
                    )}

                    {req.status === "delivered" && (
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-purple-400">
                          Waiting for buyer completion confirmation
                        </span>
                        {req.final_file_path && (
                          <button
                            type="button"
                            onClick={() => handleDownload(req.id, req.final_file_path!)}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-control)] border border-line bg-canvas px-3 text-xs font-medium text-fg hover:bg-raised"
                          >
                            <Download className="size-3.5 text-muted" />
                            <span>View Deliverable</span>
                          </button>
                        )}
                      </div>
                    )}

                    {req.status === "completed" && (
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-green-400">
                        <CheckCircle2 className="size-4" />
                        Job Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accept Request Dialog */}
      {acceptingRequestId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-md rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-fg">Accept Freelance Request</h3>
            <p className="mt-1 text-xs text-muted">
              Specify the total agreed milestone price for this job in INR. Money will be settled
              directly between you and the buyer outside the platform.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <label htmlFor="agreed_price" className="text-sm font-medium text-fg">
                Agreed Price (₹ INR)
              </label>
              <div className="relative">
                <span className="absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-sm text-faint">
                  ₹
                </span>
                <input
                  id="agreed_price"
                  type="number"
                  min="1"
                  step="50"
                  value={agreedPriceInput}
                  onChange={(e) => setAgreedPriceInput(e.target.value)}
                  className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas pr-3 pl-8 text-sm font-mono text-fg focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setAcceptingRequestId(null)}
                className="inline-flex min-h-[44px] items-center rounded-[var(--radius-control)] border border-line bg-surface px-4 text-xs font-medium text-muted hover:text-fg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleConfirmAccept(acceptingRequestId)}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-6 text-xs font-semibold text-accent-contrast hover:bg-accent/90 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : "Confirm & Accept"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deliver Files Dialog */}
      {deliveringRequestId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-md rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-fg">Upload Deliverable Part</h3>
            <p className="mt-1 text-xs text-muted">
              Select the finished 3D CAD model, slice, or ZIP archive to deliver to the buyer.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <label
                htmlFor="deliverable_file"
                className="flex min-h-[56px] cursor-pointer flex-col items-center justify-center rounded-[var(--radius-control)] border border-dashed border-line bg-canvas p-4 text-xs text-muted hover:border-line-strong hover:text-fg"
              >
                <FileUp className="size-5 text-accent mb-1" />
                <span>{deliverFile ? deliverFile.name : "Select STEP, STL, 3MF, or ZIP file..."}</span>
              </label>
              <input
                id="deliverable_file"
                type="file"
                onChange={(e) => setDeliverFile(e.target.files?.[0] || null)}
                className="sr-only"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => {
                  setDeliveringRequestId(null);
                  setDeliverFile(null);
                }}
                disabled={isUploadingDeliverable}
                className="inline-flex min-h-[44px] items-center rounded-[var(--radius-control)] border border-line bg-surface px-4 text-xs font-medium text-muted hover:text-fg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUploadingDeliverable || !deliverFile}
                onClick={() => handleConfirmDeliver(deliveringRequestId)}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-6 text-xs font-semibold text-accent-contrast hover:bg-accent/90 disabled:opacity-50"
              >
                {isUploadingDeliverable ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  "Confirm & Deliver"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
