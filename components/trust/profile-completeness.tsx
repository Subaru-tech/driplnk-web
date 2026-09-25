"use client";

import { Check, Circle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ProfileChecklistItem {
  label: string;
  completed: boolean;
  hint?: string;
}

export interface ProfileCompletenessProps {
  items: ProfileChecklistItem[];
  className?: string;
  showDisclaimer?: boolean;
  compact?: boolean;
  verificationStatus?: "pending" | "changes_requested" | "approved" | "rejected" | "under_review" | string | null;
}

export function ProfileCompleteness({
  items,
  className,
  showDisclaimer = true,
  compact = false,
  verificationStatus,
}: ProfileCompletenessProps) {
  const completedCount = items.filter((i) => i.completed).length;
  const percentage = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  // Visual text progress indicator: e.g. ████████░░
  const totalBlocks = 10;
  const filledBlocks = Math.round((percentage / 100) * totalBlocks);
  const blockBar = "█".repeat(filledBlocks) + "░".repeat(totalBlocks - filledBlocks);

  return (
    <div
      className={cn(
        "flex flex-col gap-3.5 rounded-[var(--radius-control)] border border-line bg-canvas p-4 text-xs",
        className
      )}
    >
      {/* Header with Dual Metrics: Profile Completeness & Verification Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line/60 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">
            Profile completeness:
          </span>
          <span
            className={cn(
              "rounded px-2 py-0.5 font-mono text-xs font-bold",
              percentage === 100
                ? "bg-accent/15 text-accent"
                : percentage >= 60
                ? "bg-amber-500/15 text-amber-400"
                : "bg-raised text-muted"
            )}
          >
            {percentage}%
          </span>
          <span className="font-mono text-[11px] text-muted tracking-widest hidden md:inline ml-1">
            {blockBar}
          </span>
        </div>

        {verificationStatus && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted uppercase tracking-wider">
              Verification status:
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold",
                verificationStatus === "approved"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : verificationStatus === "changes_requested"
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : "bg-sky-500/15 text-sky-400 border border-sky-500/30"
              )}
            >
              {verificationStatus === "approved"
                ? "Verified"
                : verificationStatus === "changes_requested"
                ? "Changes Requested"
                : "Under Review"}
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            percentage === 100
              ? "bg-accent"
              : percentage >= 60
              ? "bg-amber-400"
              : "bg-muted"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Checklist */}
      {!compact && (
        <div className="flex flex-col gap-2 pt-1">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {item.completed ? (
                  <span className="grid size-4 place-items-center rounded-full bg-accent/15 text-accent">
                    <Check className="size-2.5 stroke-[3]" />
                  </span>
                ) : (
                  <Circle className="size-3.5 text-faint" />
                )}
                <span className={cn(item.completed ? "text-fg font-medium" : "text-muted")}>
                  {item.label}
                </span>
              </div>
              {item.hint && !item.completed && (
                <span className="text-[10px] text-faint font-mono">{item.hint}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Educational Callout */}
      {showDisclaimer && (
        <div className="flex items-start gap-2 border-t border-line/60 pt-2.5 text-[11px] text-faint leading-relaxed">
          <AlertCircle className="size-3.5 shrink-0 mt-0.5 text-muted" />
          <span>
            Completeness indicates application readiness. Verification status is granted after independent review by DripLnk admins.
          </span>
        </div>
      )}
    </div>
  );
}
