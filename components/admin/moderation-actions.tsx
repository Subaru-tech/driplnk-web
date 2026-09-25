"use client";

import { Check, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { clearModerationFlag, resolveModelReport } from "@/driplnk-web-backend/actions/admin";
import { cn } from "@/lib/cn";

export function ModerationQueueActions({
  modelId,
  reportId,
  fullWidth = false,
}: {
  modelId: string;
  reportId?: string;
  fullWidth?: boolean;
}) {
  const [loadingAction, setLoadingAction] = useState<"clear" | "unpublish" | null>(null);
  const toast = useToast();

  async function handleClear() {
    setLoadingAction("clear");
    try {
      const res = await clearModerationFlag(modelId);
      if (res.success) {
        toast("success", "Moderation flags cleared and open reports resolved.");
      } else {
        toast("error", res.error || "Failed to clear moderation flags.");
      }
    } catch {
      toast("error", "An unexpected error occurred.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleUnpublish() {
    const reason = window.prompt("Reason for unpublishing this design (sent to creator / audit log):", "Violates platform safety or intellectual property guidelines.");
    if (!reason) return;

    setLoadingAction("unpublish");
    try {
      if (reportId) {
        const res = await resolveModelReport({
          reportId,
          resolution: reason,
          unpublish: true,
        });
        if (res.success) {
          toast("warning", "Model unpublished and report marked resolved.");
        } else {
          toast("error", res.error || "Failed to unpublish model.");
        }
      } else {
        // Direct unpublish via resolveModelReport with placeholder or clear
        const res = await resolveModelReport({
          reportId: "00000000-0000-0000-0000-000000000000",
          resolution: reason,
          unpublish: true,
        }).catch(async () => {
          // Fallback direct status update
          const { updateModelStatusAdmin } = await import("@/driplnk-web-backend/actions/admin");
          return updateModelStatusAdmin({ modelId, status: "rejected", reviewNotes: reason });
        });

        if (res.success) {
          toast("warning", "Model unpublished from marketplace.");
        } else {
          toast("error", res.error || "Failed to unpublish model.");
        }
      }
    } catch {
      toast("error", "An unexpected error occurred while unpublishing.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className={cn("flex items-center gap-2", fullWidth ? "w-full" : "justify-end")}>
      <Button
        variant="secondary"
        size="sm"
        loading={loadingAction === "clear"}
        disabled={loadingAction !== null}
        onClick={handleClear}
        aria-label="Clear moderation flag"
        className={cn("text-xs gap-1.5", fullWidth && "flex-1")}
      >
        <ShieldCheck className="size-3.5 text-accent" aria-hidden="true" />
        Clear
      </Button>

      <Button
        variant="danger"
        size="sm"
        loading={loadingAction === "unpublish"}
        disabled={loadingAction !== null}
        onClick={handleUnpublish}
        aria-label="Unpublish model"
        className={cn("text-xs gap-1.5", fullWidth && "flex-1")}
      >
        <ShieldAlert className="size-3.5" aria-hidden="true" />
        Unpublish
      </Button>
    </div>
  );
}
