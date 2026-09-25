import { Truck, Mail, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackendNotice } from "@/components/dashboard/backend-notice";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonGroup, Skeleton } from "@/components/ui/skeleton";
import { OrderStatusPill } from "@/components/ui/status-pill";
import { formatCurrency, formatDate } from "@/lib/format";
import { getMartOrders } from "@/driplnk-web-backend/db/queries";
import { BuyerCompleteOrderButton } from "@/components/dashboard/buyer-mart-order-actions";

export const metadata: Metadata = { title: "Mart Orders" };

export const dynamic = "force-dynamic";

async function OrderList() {
  const { data: orders, backendReady } = await getMartOrders();

  if (orders.length === 0) {
    return (
      <>
        {backendReady ? null : <BackendNotice />}
        <EmptyState
          icon={Truck}
          size="lg"
          message="No orders yet — upload a CAD model to get a regional print quote"
          action={
            <ButtonLink href="/mart" variant="secondary" className="min-h-[44px] min-w-[44px]">
              Go to Mart
            </ButtonLink>
          }
        />
      </>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface md:block">
        <table className="w-full table-fixed">
          <thead>
            <tr className="text-left">
              <th scope="col" className="w-32 px-4 py-3 text-xs font-medium text-muted">
                Order ID
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-muted">
                Material & Hub
              </th>
              <th scope="col" className="w-32 px-4 py-3 text-xs font-medium text-muted">
                Status
              </th>
              <th scope="col" className="w-36 px-4 py-3 text-xs font-medium text-muted">
                Ordered
              </th>
              <th scope="col" className="w-28 px-4 py-3 text-right text-xs font-medium text-muted">
                Total
              </th>
              <th scope="col" className="w-36 px-4 py-3 text-right text-xs font-medium text-muted">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const ref = `DL-${order.id.slice(0, 6).toUpperCase()}`;
              return (
                <tr key={order.id} className="border-t border-line transition-colors hover:bg-raised">
                  <td className="px-4 py-4">
                    <Link
                      href={`/dashboard/mart-orders/${order.id}`}
                      className="font-mono text-sm font-medium text-fg hover:text-accent inline-block min-h-[44px] leading-[44px]"
                    >
                      {ref}
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-fg">
                        {order.material.toUpperCase()} Print ({order.weight_g ? `${order.weight_g}g` : "Custom"})
                      </span>
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span>{order.counterparty_name || "Assigned Print Hub"}</span>
                        {order.counterparty_location && (
                          <span className="flex items-center gap-0.5 text-faint">
                            <MapPin className="size-3" />
                            {order.counterparty_location}
                          </span>
                        )}
                      </div>
                      {order.counterparty_email && (
                        <a
                          href={`mailto:${order.counterparty_email}`}
                          className="flex items-center gap-1 text-xs text-accent hover:underline mt-0.5"
                        >
                          <Mail className="size-3" />
                          <span>{order.counterparty_email}</span>
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <OrderStatusPill status={order.status} />
                  </td>
                  <td className="px-4 py-4 text-sm whitespace-nowrap text-muted">
                    {formatDate(order.created_at)}
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sm whitespace-nowrap font-medium text-fg">
                    {formatCurrency(order.price)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {order.status === "delivered" ? (
                      <BuyerCompleteOrderButton orderId={order.id} />
                    ) : (
                      <Link
                        href={`/dashboard/mart-orders/${order.id}`}
                        className="text-xs text-muted hover:text-fg font-mono inline-block min-h-[44px] leading-[44px]"
                      >
                        Details →
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="flex flex-col gap-4 md:hidden">
        {orders.map((order) => {
          const ref = `DL-${order.id.slice(0, 6).toUpperCase()}`;
          return (
            <div
              key={order.id}
              className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/dashboard/mart-orders/${order.id}`}
                  className="font-mono text-sm font-bold text-fg hover:text-accent min-h-[44px] flex items-center"
                >
                  {ref}
                </Link>
                <OrderStatusPill status={order.status} />
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-fg">
                  {order.material.toUpperCase()} Print ({order.weight_g ? `${order.weight_g}g` : "Custom"})
                </p>
                <p className="text-xs text-muted">
                  {order.counterparty_name || "Assigned Print Hub"}
                </p>
                {order.counterparty_email && (
                  <a
                    href={`mailto:${order.counterparty_email}`}
                    className="flex items-center gap-1.5 text-xs text-accent hover:underline py-1"
                  >
                    <Mail className="size-3" />
                    <span>{order.counterparty_email}</span>
                  </a>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-line/40 pt-3">
                <span className="text-xs text-muted">{formatDate(order.created_at)}</span>
                <span className="font-mono text-base font-bold text-fg">
                  {formatCurrency(order.price)}
                </span>
              </div>

              {order.status === "delivered" && (
                <div className="pt-2">
                  <BuyerCompleteOrderButton orderId={order.id} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function OrderListSkeleton() {
  return (
    <SkeletonGroup label="Loading orders" className="flex flex-col gap-3">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </SkeletonGroup>
  );
}

export default function MartOrdersPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-fg">Mart Orders</h2>
          <p className="text-sm text-muted">Track your physical 3D print orders from quote to delivery.</p>
        </div>
        <ButtonLink href="/mart" size="sm" className="min-h-[44px] min-w-[44px]">
          Get New Quote
        </ButtonLink>
      </div>

      <Suspense fallback={<OrderListSkeleton />}>
        <OrderList />
      </Suspense>
    </div>
  );
}
