import { cn } from "@/lib/cn";

/* Spec §1.4 — Status pill
   Pill shape, 4px/10px padding, text-xs medium, colored muted bg + colored text.
   The vocabulary is FIXED per context (see §6.3) — components never invent
   ad-hoc status strings.
   Spec §8: colour is never the only signal, so the pill always carries text. */

export type StatusTone = "neutral" | "accent" | "warning" | "info" | "danger";

const tones: Record<StatusTone, string> = {
  neutral: "bg-raised text-muted",
  accent: "bg-accent-muted text-accent",
  warning: "bg-warning-muted text-warning",
  info: "bg-info-muted text-info",
  danger: "bg-danger-muted text-danger",
};

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Mart order status — spec §6.3
   The backend runs a 9-stage lifecycle; the user-facing set is deliberately
   smaller. Internal stages map to the nearest user-facing one.
   ------------------------------------------------------------------------ */

export const ORDER_STATUSES = [
  "Placed",
  "Confirmed",
  "Printing",
  "Shipped",
  "Delivered",
  "Cancelled",
  "Failed",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** The happy-path stages, in order — drives the detail-view stepper. */
export const ORDER_TIMELINE: OrderStatus[] = [
  "Placed",
  "Confirmed",
  "Printing",
  "Shipped",
  "Delivered",
];

const orderTones: Record<string, StatusTone> = {
  Placed: "neutral",
  placed: "neutral",
  pending_vendor_response: "neutral",
  "Awaiting Vendor": "neutral",
  pending_moderation: "warning",
  "Safety Review": "warning",
  Confirmed: "info",
  accepted: "info",
  Printing: "warning",
  printing: "warning",
  Shipped: "info",
  shipped: "info",
  Delivered: "accent",
  delivered: "accent",
  Completed: "accent",
  completed: "accent",
  Cancelled: "danger",
  cancelled: "danger",
  Failed: "danger",
};

const statusLabels: Record<string, string> = {
  pending_moderation: "Safety Review",
  pending_vendor_response: "Awaiting Vendor",
  placed: "Placed",
  accepted: "Confirmed",
  printing: "Printing",
  shipped: "Shipped",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  expired_no_vendor_response: "Expired",
};

export function OrderStatusPill({ status }: { status: string }) {
  const tone = orderTones[status] || "neutral";
  const label = statusLabels[status] || (status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " "));
  return <StatusPill tone={tone}>{label}</StatusPill>;
}

