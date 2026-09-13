"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { updateProviderStatusAdmin } from "@/driplnk-web-backend/actions/admin";
import { cn } from "@/lib/cn";

export function ProviderReviewActions({
  providerId,
  providerType,
  fullWidth = false,
}: {
  providerId: string;
  providerType: "vendor" | "freelancer";
  fullWidth?: boolean;
}) {
  const [loadingAction, setLoadingAction] = useState<"approve" | "reject" | null>(null);
  const toast = useToast();

  async function handleApprove() {
    setLoadingAction("approve");
    try {
      const res = await updateProviderStatusAdmin({ providerId, status: "approved" });
      if (res.success) {
        toast("success", `${providerType === "vendor" ? "Print Vendor" : "Freelancer"} approved successfully.`);
      } else {
        toast("error", res.error || "Failed to approve provider.");
      }
    } catch {
      toast("error", "An unexpected error occurred while approving the provider.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleReject() {
    setLoadingAction("reject");
    try {
      const res = await updateProviderStatusAdmin({ providerId, status: "rejected" });
      if (res.success) {
        toast("warning", `${providerType === "vendor" ? "Print Vendor" : "Freelancer"} rejected.`);
      } else {
        toast("error", res.error || "Failed to reject provider.");
      }
    } catch {
      toast("error", "An unexpected error occurred while rejecting the provider.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className={cn("flex items-center gap-2", fullWidth ? "w-full" : "justify-end")}>
      <Button
        variant="primary"
        size="sm"
        loading={loadingAction === "approve"}
        disabled={loadingAction !== null}
        onClick={handleApprove}
        aria-label={`Approve ${providerType}`}
        className={fullWidth ? "flex-1" : undefined}
      >
        <Check className="size-3.5" aria-hidden="true" />
        Approve
      </Button>

      <Button
        variant="danger"
        size="sm"
        loading={loadingAction === "reject"}
        disabled={loadingAction !== null}
        onClick={handleReject}
        aria-label={`Reject ${providerType}`}
        className={fullWidth ? "flex-1" : undefined}
      >
        <X className="size-3.5" aria-hidden="true" />
        Reject
      </Button>
    </div>
  );
}
