"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  PackageCheck,
  Printer,
  Truck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { respondToMartOrderAction } from "@/driplnk-web-backend/actions/vendor";
import type { MartOrderStatus } from "@/lib/types";

interface VendorOrderActionsProps {
  orderId: string;
  currentStatus: MartOrderStatus;
}

export function VendorOrderActions({
  orderId,
  currentStatus,
}: VendorOrderActionsProps) {
  const router = useRouter();
  const [localStatus, setLocalStatus] = useState<MartOrderStatus>(currentStatus);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Derive the active status during render rather than mirroring the prop in
     an effect — a state copy of a prop re-renders twice for no benefit. */
  const activeStatus = localStatus ?? currentStatus;

  const handleAction = async (
    action: "accept" | "print" | "ship" | "deliver" | "cancel"
  ) => {
    setLoadingAction(action);
    setError(null);
    try {
      const res = await respondToMartOrderAction(orderId, action);
      if (!res.success) {
        setError(res.error || "Action failed.");
      } else {
        const nextMap: Record<string, MartOrderStatus> = {
          accept: "accepted",
          print: "printing",
          ship: "shipped",
          deliver: "delivered",
          cancel: "cancelled",
        };
        if (nextMap[action]) {
          setLocalStatus(nextMap[action]);
        }
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {activeStatus === "placed" && (
          <>
            <Button
              size="sm"
              onClick={() => handleAction("accept")}
              disabled={Boolean(loadingAction)}
              className="min-h-[44px] min-w-[44px]"
            >
              {loadingAction === "accept" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Check className="size-4" />
                  Accept Order
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleAction("cancel")}
              disabled={Boolean(loadingAction)}
              className="min-h-[44px] min-w-[44px] text-rose-400 hover:text-rose-300"
            >
              {loadingAction === "cancel" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="size-4" />
                  Decline
                </>
              )}
            </Button>
          </>
        )}

        {activeStatus === "accepted" && (
          <Button
            size="sm"
            onClick={() => handleAction("print")}
            disabled={Boolean(loadingAction)}
            className="min-h-[44px] min-w-[44px] bg-amber-500 hover:bg-amber-600 text-white"
          >
            {loadingAction === "print" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Printer className="size-4" />
                Start Printing
              </>
            )}
          </Button>
        )}

        {activeStatus === "printing" && (
          <Button
            size="sm"
            onClick={() => handleAction("ship")}
            disabled={Boolean(loadingAction)}
            className="min-h-[44px] min-w-[44px] bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loadingAction === "ship" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Truck className="size-4" />
                Mark Shipped
              </>
            )}
          </Button>
        )}

        {activeStatus === "shipped" && (
          <Button
            size="sm"
            onClick={() => handleAction("deliver")}
            disabled={Boolean(loadingAction)}
            className="min-h-[44px] min-w-[44px] bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loadingAction === "deliver" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <PackageCheck className="size-4" />
                Mark Delivered
              </>
            )}
          </Button>
        )}

        {activeStatus === "delivered" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-muted px-3 py-1 font-mono text-xs text-accent min-h-[32px]">
            <Clock className="size-3.5" />
            Delivered (Awaiting Buyer)
          </span>
        )}

        {activeStatus === "completed" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-xs text-emerald-400 min-h-[32px]">
            <CheckCircle2 className="size-3.5" />
            Order Completed
          </span>
        )}

        {activeStatus === "cancelled" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 font-mono text-xs text-rose-400 min-h-[32px]">
            <XCircle className="size-3.5" />
            Cancelled
          </span>
        )}
      </div>

      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}
