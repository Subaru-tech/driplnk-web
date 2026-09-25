import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Clock,
  Download,
  Mail,
  MapPin,
  Package,
  Printer,
  ShieldAlert,
  Sparkles,
  Truck,
} from "lucide-react";
import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { getMyVendorProvider } from "@/driplnk-web-backend/actions/vendor";
import { getVendorOrders } from "@/driplnk-web-backend/db/queries";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderStatusPill } from "@/components/ui/status-pill";
import { formatCurrency, formatDate } from "@/lib/format";
import { VendorOrderActions } from "@/components/dashboard/vendor-order-actions";
import { ProfileCompleteness } from "@/components/trust/profile-completeness";

export const metadata: Metadata = {
  title: "Vendor Hub — DripLnk Mart",
};

export const dynamic = "force-dynamic";

export default async function VendorDashboardPage() {
  const user = await getUnifiedUser();
  if (!user) {
    redirect("/login?redirect=/dashboard/vendor");
  }

  const { provider, profile } = await getMyVendorProvider();

  // 1. Not a vendor yet -> prompt to apply
  if (!provider) {
    return (
      <div className="flex flex-col gap-6 py-6">
        <div>
          <h2 className="font-display text-2xl font-bold text-fg">Vendor Hub</h2>
          <p className="text-sm text-muted">Manage your 3D print fleet and incoming customer print orders.</p>
        </div>

        <Card className="flex flex-col items-center gap-6 p-8 text-center sm:p-12">
          <div className="flex size-14 items-center justify-center rounded-full bg-accent-muted text-accent">
            <Printer className="size-7" />
          </div>
          <div className="flex flex-col gap-2 max-w-md">
            <h3 className="font-display text-xl font-bold text-fg">Become a Print Vendor</h3>
            <p className="text-sm text-muted leading-relaxed">
              Connect your print farm or studio to DripLnk Mart. Receive guaranteed-rate printing jobs calculated automatically from uploaded CAD meshes.
            </p>
          </div>
          <ButtonLink href="/vendor/apply" size="lg" className="min-h-[44px] min-w-[44px]">
            Apply as a Print Hub
          </ButtonLink>
        </Card>
      </div>
    );
  }

  const vendorCompletenessItems = [
    { label: "Basic information", completed: Boolean(profile?.business_name || user.name) },
    { label: "Location & contact", completed: Boolean(profile?.location) },
    { label: "Manufacturing capabilities", completed: Boolean(profile?.materials_supported && profile.materials_supported.length > 0) },
    { label: "Machine specifications", completed: Boolean(profile?.capacity_notes) },
    { label: "Verification document", completed: false, hint: "Reviewed by DripLnk" },
  ];

  // 2. Changes requested
  if (provider.status === "changes_requested") {
    return (
      <div className="flex flex-col gap-6 py-6 max-w-3xl mx-auto w-full">
        <div>
          <h2 className="font-display text-2xl font-bold text-fg">Vendor Hub</h2>
          <p className="text-sm text-muted">Your application to join the print farm network.</p>
        </div>

        <Card className="flex flex-col items-center gap-6 p-8 text-center sm:p-12 border-amber-500/30">
          <div className="flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
            <ShieldAlert className="size-7" />
          </div>
          <div className="flex flex-col gap-2 max-w-md">
            <span className="inline-flex self-center items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-xs font-medium text-amber-400">
              Action Required: Changes Requested
            </span>
            <h3 className="font-display text-xl font-bold text-fg">
              {profile?.business_name || "Print Hub Application"}
            </h3>
            <p className="text-sm text-muted leading-relaxed">
              Our moderation team reviewed your print farm submission and requested adjustments. Please address the feedback below and update your details.
            </p>
          </div>

          {/* Admin Notes */}
          {provider.admin_notes && (
            <div className="w-full max-w-lg text-left rounded-[var(--radius-control)] border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1.5">
                <AlertCircle className="size-4 shrink-0" />
                <span>Reviewer Note:</span>
              </div>
              <p className="text-xs sm:text-sm text-fg leading-relaxed whitespace-pre-line pl-6">
                {provider.admin_notes}
              </p>
            </div>
          )}

          <div className="w-full max-w-lg text-left">
            <ProfileCompleteness
              items={vendorCompletenessItems}
              verificationStatus={provider.status}
            />
          </div>

          <ButtonLink href="/vendor/apply" className="min-h-[44px] min-w-[44px]">
            Edit & Resubmit Application
          </ButtonLink>
        </Card>
      </div>
    );
  }

  // 3. Pending approval
  if (provider.status === "pending") {
    return (
      <div className="flex flex-col gap-6 py-6 max-w-3xl mx-auto w-full">
        <div>
          <h2 className="font-display text-2xl font-bold text-fg">Vendor Hub</h2>
          <p className="text-sm text-muted">Your application to join the print farm network.</p>
        </div>

        <Card className="flex flex-col items-center gap-6 p-8 text-center sm:p-12">
          <div className="flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
            <Clock className="size-7" />
          </div>
          <div className="flex flex-col gap-2 max-w-md">
            <span className="inline-flex self-center items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 font-mono text-xs font-medium text-amber-400">
              Application Pending Review
            </span>
            <h3 className="font-display text-xl font-bold text-fg">
              {profile?.business_name || "Print Hub Application"}
            </h3>
            <p className="text-sm text-muted leading-relaxed">
              Your application is under manual founder review. Our team will verify your printer fleet specifications, setup custom pricing rules, and enable your incoming order queue.
            </p>
          </div>

          <div className="w-full max-w-lg text-left">
            <ProfileCompleteness
              items={vendorCompletenessItems}
              verificationStatus={provider.status}
            />
          </div>

          <ButtonLink href="/vendor/apply" variant="secondary" className="min-h-[44px] min-w-[44px]">
            View Application Details
          </ButtonLink>
        </Card>
      </div>
    );
  }

  // 3. Rejected
  if (provider.status === "rejected") {
    return (
      <div className="flex flex-col gap-6 py-6">
        <Card className="flex flex-col items-center gap-4 p-8 text-center sm:p-12">
          <div className="flex size-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
            <ShieldAlert className="size-7" />
          </div>
          <h3 className="font-display text-xl font-bold text-fg">Application Not Approved</h3>
          <p className="text-sm text-muted max-w-md leading-relaxed">
            Your vendor application could not be approved at this time. Please contact support or re-apply with updated equipment details.
          </p>
          <ButtonLink href="/vendor/apply" variant="secondary" className="min-h-[44px] min-w-[44px]">
            Re-apply
          </ButtonLink>
        </Card>
      </div>
    );
  }

  // 4. Approved Vendor -> Full Dashboard
  const { data: orders } = await getVendorOrders();

  const activeJobs = orders.filter((o) => ["placed", "accepted", "printing", "shipped"].includes(o.status));
  const completedJobs = orders.filter((o) => ["delivered", "completed"].includes(o.status));

  return (
    <div className="flex flex-col gap-8">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl font-bold text-fg">
              {profile?.business_name || "Vendor Hub"}
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-muted px-2.5 py-0.5 font-mono text-xs font-medium text-accent">
              Approved Hub
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            {profile?.location && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5 text-faint" />
                {profile.location}
              </span>
            )}
            <span>•</span>
            <span>Materials: {profile?.materials_supported?.map((m) => m.toUpperCase()).join(", ") || "All standard"}</span>
          </div>
        </div>

        <ButtonLink href="/vendor/apply" variant="secondary" size="sm" className="min-h-[44px] min-w-[44px]">
          Edit Hub Profile
        </ButtonLink>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex flex-col gap-1 p-5">
          <span className="text-xs font-medium text-muted uppercase tracking-wider">Active Print Jobs</span>
          <span className="font-mono text-3xl font-bold text-fg">{activeJobs.length}</span>
          <span className="text-xs text-faint">In production or queued</span>
        </Card>

        <Card className="flex flex-col gap-1 p-5">
          <span className="text-xs font-medium text-muted uppercase tracking-wider">Total Fulfilled</span>
          <span className="font-mono text-3xl font-bold text-fg">{completedJobs.length}</span>
          <span className="text-xs text-faint">Delivered & verified</span>
        </Card>

        <Card className="flex flex-col gap-1 p-5">
          <span className="text-xs font-medium text-muted uppercase tracking-wider">Gross Order Value</span>
          <span className="font-mono text-3xl font-bold text-accent">
            {formatCurrency(orders.reduce((acc, o) => acc + (o.status !== "cancelled" ? o.price : 0), 0))}
          </span>
          <span className="text-xs text-faint">Offline customer settlement</span>
        </Card>
      </div>

      {/* Incoming Orders Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-fg">Incoming Print Orders</h3>
          <span className="font-mono text-xs text-muted">{orders.length} total orders</span>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            icon={Printer}
            size="lg"
            message="No print jobs assigned yet — new orders matching your pricing rules will appear here"
          />
        ) : (
          <div className="flex flex-col gap-4">
            {orders.map((order) => {
              const ref = `DL-${order.id.slice(0, 6).toUpperCase()}`;
              return (
                <Card
                  key={order.id}
                  className="flex flex-col gap-4 p-5 sm:p-6 transition-colors hover:border-line-hover"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/40 pb-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-fg">{ref}</span>
                      <OrderStatusPill status={order.status} />
                      <span className="font-mono text-xs text-faint">{formatDate(order.created_at)}</span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-lg font-bold text-fg">
                        {formatCurrency(order.price)}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-muted uppercase">Customer</span>
                      <span className="text-sm font-medium text-fg">{order.counterparty_name}</span>
                      {order.counterparty_email && (
                        <a
                          href={`mailto:${order.counterparty_email}`}
                          className="flex items-center gap-1 text-xs text-accent hover:underline"
                        >
                          <Mail className="size-3" />
                          <span>{order.counterparty_email}</span>
                        </a>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-muted uppercase">Specification</span>
                      <span className="font-mono text-sm text-fg">
                        {order.material.toUpperCase()} • {order.weight_g ? `${order.weight_g}g` : "Custom weight"}
                      </span>
                      <span className="text-xs text-faint">Calibrated ±0.08 mm tolerances</span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-muted uppercase">Model File</span>
                      <span className="font-mono text-xs text-muted truncate max-w-xs">
                        {order.file_path || "Stored securely in cloud bucket"}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between border-t border-line/40 pt-4 mt-1">
                    <span className="text-xs text-faint">Lifecycle state machine</span>
                    <VendorOrderActions orderId={order.id} currentStatus={order.status} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
