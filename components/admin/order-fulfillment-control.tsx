"use client";

import { Check, Save, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ORDER_STATUSES, type OrderStatus } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { updateMartOrderAdmin } from "@/driplnk-web-backend/actions/admin";
import { adminModerateMartOrderAction } from "@/driplnk-web-backend/actions/mart";

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

  async function handleModerate(action: "clear" | "reject") {
    setIsSaving(true);
    try {
      const res = await adminModerateMartOrderAction(
        orderId,
        action,
        action === "clear" ? "Cleared by admin" : "Prohibited firearm/weapon design"
      );
      if (res.success) {
        toast("success", action === "clear" ? "Order cleared and dispatched to vendor." : "Order rejected and cancelled.");
        if (action === "clear") {
          setStatus("Confirmed");
        } else {
          setStatus("Cancelled");
        }
      } else {
        toast("error", res.error || "Failed to process moderation action.");
      }
    } catch {
      toast("error", "An error occurred while moderating the order.");
    } finally {
      setIsSaving(false);
    }
  }

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

  const isHeld = (initialStatus as string) === "pending_moderation" || (status as string) === "pending_moderation";

  if (layout === "card") {
    return (
      <div className="flex flex-col gap-2.5">
        {isHeld && (
          <div className="flex items-center justify-between rounded-lg border border-warning/40 bg-warning/10 p-2.5">
            <div className="flex items-center gap-1.5 text-xs text-warning">
              <ShieldAlert className="size-4 shrink-0" />
              <span>Held for Weapon Review</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="primary"
                size="sm"
                loading={isSaving}
                onClick={() => handleModerate("clear")}
                className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <Check className="size-3 mr-1" /> Clear
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={isSaving}
                onClick={() => handleModerate("reject")}
                className="h-7 px-2 text-xs"
              >
                <X className="size-3 mr-1" /> Reject
              </Button>
            </div>
          </div>
        )}
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

  if (isHeld) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 font-mono text-xs font-medium text-warning">
          <ShieldAlert className="size-3.5" /> Held for Review
        </span>
        <Button
          variant="primary"
          size="sm"
          loading={isSaving}
          onClick={() => handleModerate("clear")}
          className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <Check className="size-3 mr-1" /> Clear & Dispatch
        </Button>
        <Button
          variant="danger"
          size="sm"
          loading={isSaving}
          onClick={() => handleModerate("reject")}
          className="h-7 px-2 text-xs"
        >
          <X className="size-3 mr-1" /> Reject
        </Button>
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
