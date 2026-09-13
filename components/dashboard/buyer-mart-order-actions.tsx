"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { respondToMartOrderAction } from "@/driplnk-web-backend/actions/vendor";

export function BuyerCompleteOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await respondToMartOrderAction(orderId, "complete");
      if (!res.success) {
        setError(res.error || "Failed to complete order.");
      } else {
        setIsCompleted(true);
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error completing order.");
    } finally {
      setLoading(false);
    }
  };

  if (isCompleted) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 font-mono text-xs text-emerald-400 min-h-[44px]">
        <CheckCircle2 className="size-4" />
        Order Completed
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        onClick={handleComplete}
        disabled={loading}
        className="min-h-[44px] min-w-[44px]"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <CheckCircle2 className="size-4 text-emerald-400" />
            Mark Completed
          </>
        )}
      </Button>
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}
