import { ArrowLeft, Mail, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { OrderTimeline } from "@/components/dashboard/order-timeline";
import { Card, CardTitle } from "@/components/ui/card";
import { OrderStatusPill } from "@/components/ui/status-pill";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getMartOrder } from "@/driplnk-web-backend/db/queries";
import { BuyerCompleteOrderButton } from "@/components/dashboard/buyer-mart-order-actions";

export const metadata: Metadata = { title: "Order Details" };

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: PageProps<"/dashboard/mart-orders/[id]">) {
  const { id } = await params;
  const { data: order } = await getMartOrder(id);

  if (!order) notFound();

  const ref = `DL-${order.id.slice(0, 6).toUpperCase()}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/mart-orders"
          className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg min-h-[44px]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All mart orders
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-2xl font-bold text-fg">{ref}</h2>
            <OrderStatusPill status={order.status} />
          </div>

          {order.status === "delivered" && (
            <BuyerCompleteOrderButton orderId={order.id} />
          )}
        </div>
        <p className="text-sm text-muted">Ordered on {formatDateTime(order.created_at)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card className="flex flex-col gap-6 p-6">
          <CardTitle>Manufacturing & Dispatch Progress</CardTitle>
          <OrderTimeline status={order.status} />
        </Card>

        <div className="flex flex-col gap-6">
          {/* Print Hub / Counterparty info */}
          <Card className="flex flex-col gap-4 p-6">
            <CardTitle>Assigned Regional Print Hub</CardTitle>
            <div className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-fg">{order.counterparty_name || "Regional Print Farm"}</span>
              {order.counterparty_location && (
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <MapPin className="size-3.5 text-faint" />
                  <span>{order.counterparty_location}</span>
                </div>
              )}
              {order.counterparty_email ? (
                <div className="mt-2 rounded-[var(--radius-control)] border border-line bg-surface-muted/30 p-3">
                  <span className="text-xs text-muted block mb-1">Direct Hub Contact (Offline Coordination):</span>
                  <a
                    href={`mailto:${order.counterparty_email}`}
                    className="flex items-center gap-2 text-sm font-mono text-accent hover:underline"
                  >
                    <Mail className="size-4" />
                    <span>{order.counterparty_email}</span>
                  </a>
                </div>
              ) : (
                <p className="text-xs text-faint">
                  Hub contact details are revealed once the order is accepted by the farm.
                </p>
              )}
            </div>
          </Card>

          {/* Specifications & Cost */}
          <Card className="flex flex-col gap-4 p-6">
            <CardTitle>Specifications & Quoted Cost</CardTitle>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">Selected Material</dt>
                <dd className="font-mono text-fg uppercase">{order.material}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">Calculated Part Mass</dt>
                <dd className="font-mono text-fg">{order.weight_g ? `${order.weight_g} g` : "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">Tolerance Standard</dt>
                <dd className="font-mono text-accent">±0.08 mm Guaranteed</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-line pt-3">
                <dt className="font-medium text-fg">Total Quoted Price</dt>
                <dd className="font-mono text-lg font-bold text-accent">
                  {formatCurrency(order.price)}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
