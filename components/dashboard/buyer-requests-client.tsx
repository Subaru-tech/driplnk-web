"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileCheck,
  Mail,
  Paperclip,
  XCircle,
  Loader2,
  AlertCircle,
  Briefcase,
} from "lucide-react";
import {
  respondToFreelanceRequest,
  getFreelanceFileDownloadUrl,
} from "@/driplnk-web-backend/actions/freelance";
import type { FreelanceRequest } from "@/lib/types";
import { cn } from "@/lib/cn";

export function BuyerRequestsClient({
  initialRequests,
}: {
  initialRequests: FreelanceRequest[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [requests, setRequests] = useState<FreelanceRequest[]>(initialRequests);
  const [filterTab, setFilterTab] = useState<string>("all");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadingFilePath, setDownloadingFilePath] = useState<string | null>(null);

  const filtered = requests.filter((r) => {
    if (filterTab === "all") return true;
    if (filterTab === "active") return r.status === "accepted" || r.status === "in_progress";
    return r.status === filterTab;
  });

  async function handleDownload(requestId: string, filePath: string) {
    setDownloadingFilePath(filePath);
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
      setDownloadingFilePath(null);
    }
  }

  function handleMarkCompleted(requestId: string) {
    if (!confirm("Confirm that you have inspected the delivered files and are satisfied with the CAD model?")) return;

    startTransition(async () => {
      const res = await respondToFreelanceRequest({
        requestId,
        action: "complete",
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to complete request.");
        return;
      }

      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: "completed" } : r))
      );
      router.refresh();
    });
  }

  function handleCancel(requestId: string) {
    if (!confirm("Are you sure you want to cancel this hire request?")) return;

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
          { id: "requested", label: "Requested" },
          { id: "active", label: "In Progress" },
          { id: "delivered", label: "Delivered (Action Required)" },
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
          <p className="text-base font-medium text-fg">No freelance requests found.</p>
          <p className="mt-1 text-sm text-muted">
            Hire requests submitted to CAD specialists and enclosure designers will appear here.
          </p>
          <Link
            href="/freelance"
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] bg-accent px-6 text-sm font-semibold text-accent-contrast shadow hover:bg-accent/90"
          >
            Browse Specialists
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((req) => {
            const hasEmail = Boolean(req.freelancer_email);

            return (
              <div
                key={req.id}
                className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6 transition-colors hover:border-line-strong"
              >
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-muted font-display text-sm font-semibold text-accent overflow-hidden">
                      {req.freelancer_avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={req.freelancer_avatar}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        req.freelancer_name?.charAt(0).toUpperCase() || "S"
                      )}
                    </div>
                    <div className="flex flex-col">
                      <Link
                        href={`/freelance/${req.freelancer_provider_id}`}
                        className="font-display text-base font-semibold text-fg hover:text-accent flex items-center gap-1.5"
                      >
                        <span>{req.freelancer_name || "CAD Specialist"}</span>
                        <ExternalLink className="size-3 text-muted" />
                      </Link>
                      <span className="font-mono text-xs text-muted">
                        Submitted {new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
                      <strong>Specialist direct email:</strong>{" "}
                      <a
                        href={`mailto:${req.freelancer_email}`}
                        className="font-mono text-accent hover:underline"
                      >
                        {req.freelancer_email}
                      </a>{" "}
                      (Coordinate tolerances, revision loops, and payments directly)
                    </span>
                  </div>
                )}

                {/* Brief */}
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-xs text-muted uppercase tracking-wider">
                    Your Project Requirements
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
                          disabled={downloadingFilePath === path}
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

                {/* Delivered File Alert & Action */}
                {req.status === "delivered" && req.final_file_path && (
                  <div className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-purple-500/30 bg-purple-500/10 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-purple-300">
                        <FileCheck className="size-5" />
                        <span>Deliverable CAD files ready for inspection</span>
                      </div>
                      <button
                        type="button"
                        disabled={downloadingFilePath === req.final_file_path}
                        onClick={() => handleDownload(req.id, req.final_file_path!)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-control)] bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                      >
                        <Download className="size-4" />
                        <span>Download Finished Model</span>
                      </button>
                    </div>
                    <p className="text-xs text-muted">
                      Please inspect the delivered CAD / slice file. Once confirmed fit and tolerance,
                      click <strong>Mark Completed</strong> below.
                    </p>
                  </div>
                )}

                {/* Price & Actions Row */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-line/60 pt-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted">Agreed Price:</span>
                    <span className="font-mono text-sm font-semibold text-accent">
                      {req.agreed_price ? `₹${req.agreed_price.toLocaleString("en-IN")}` : "Awaiting quote"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {req.status === "delivered" && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleMarkCompleted(req.id)}
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-6 text-xs font-semibold text-accent-contrast hover:bg-accent/90 disabled:opacity-50"
                      >
                        <CheckCircle2 className="size-4" />
                        <span>Mark Completed</span>
                      </button>
                    )}

                    {req.status === "requested" && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleCancel(req.id)}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-line bg-surface px-4 text-xs font-medium text-muted hover:text-red-400 disabled:opacity-50"
                      >
                        Cancel Request
                      </button>
                    )}

                    {req.status === "completed" && (
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-green-400">
                        <CheckCircle2 className="size-4" />
                        Completed & Confirmed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
