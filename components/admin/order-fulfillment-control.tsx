"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ORDER_STATUSES, type OrderStatus } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { updateMartOrderAdmin } from "@/driplnk-web-backend/actions/admin";

export function OrderFulfillmentControl({
  orderId,
  initialVendor,
  initialNotes,
  initialStatus,
  layout = "table",
}: {
  orderId: string;
  initialVendor: string | null;
  initialNotes: string | null;
  initialStatus: OrderStatus;
  layout?: "table" | "card";
}) {
  const [vendor, setVendor] = useState(initialVendor ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await updateMartOrderAdmin({
        orderId,
        assignedVendor: vendor,
        vendorNotes: notes,
        status,
      });

      if (res.success) {
        toast("success", "Order fulfillment updated successfully.");
      } else {
        toast("error", res.error || "Failed to update order fulfillment.");
      }
    } catch {
      toast("error", "An unexpected error occurred while updating the order.");
    } finally {
      setIsSaving(false);
    }
  }

  if (layout === "card") {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Assigned Vendor</label>
          <Input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="e.g. Rapid3D Hub"
            className="h-9 text-sm"
            aria-label="Assigned vendor"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Vendor Notes</label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. High-temp PETG, 0.2mm layer"
            className="h-9 text-sm"
            aria-label="Vendor notes"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Order Stage</label>
          <div className="flex items-center gap-2">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
              className="h-9 flex-1 text-sm font-medium"
              aria-label="Order status"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>

            <Button
              variant="secondary"
              size="sm"
              loading={isSaving}
              onClick={handleSave}
              className="h-9 shrink-0 px-4 text-xs font-medium"
              aria-label="Save fulfillment changes"
            >
              <Save className="size-3.5" aria-hidden="true" />
              Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
      <Input
        value={vendor}
        onChange={(e) => setVendor(e.target.value)}
        placeholder="Assign vendor..."
        className="h-8 min-w-32 text-xs"
        aria-label="Assigned vendor"
      />

      <Input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Vendor notes..."
        className="h-8 min-w-36 text-xs"
        aria-label="Vendor notes"
      />

      <Select
        value={status}
        onChange={(e) => setStatus(e.target.value as OrderStatus)}
        className="h-8 text-xs font-medium"
        aria-label="Order status"
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>

      <Button
        variant="secondary"
        size="sm"
        loading={isSaving}
        onClick={handleSave}
        className="h-8 shrink-0 px-2.5 text-xs"
        aria-label="Save fulfillment changes"
      >
        <Save className="size-3.5" aria-hidden="true" />
        Save
      </Button>
    </div>
  );
}
