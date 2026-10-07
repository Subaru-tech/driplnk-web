import { Box, Clock, Truck, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { BackendNotice } from "@/components/dashboard/backend-notice";
import { ModelCard } from "@/components/dashboard/model-card";
import { OrderRowCompact } from "@/components/dashboard/order-row";
import { StartModelCard } from "@/components/dashboard/start-model-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCredits } from "@/lib/format";
import { getActiveOrderCount, getMartOrders, getModelCount, getModels, getProfile, getMyFreelanceProvider } from "@/driplnk-web-backend/db/queries";
import { getMyVendorProvider } from "@/driplnk-web-backend/actions/vendor";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const [profile, modelCount, activeOrders, recentModels, recentOrders, freelancerProvider, vendorResult] = await Promise.all([
    getProfile(),
    getModelCount(),
    getActiveOrderCount(),
    getModels(4),
    getMartOrders(3),
    getMyFreelanceProvider(),
    getMyVendorProvider(),
  ]);

  const freelancerStatus = freelancerProvider.data?.status ?? null;
  const vendorStatus = vendorResult.provider?.status ?? null;

  const backendReady = profile.backendReady && modelCount.backendReady;

  return (
    <div className="flex flex-col gap-8">
      {backendReady ? null : <BackendNotice />}

      {/* Approved partner role banners — 1-click access to specialized studios */}
      {freelancerStatus === "approved" && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/25 bg-accent/[0.04] px-4 py-3 text-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-4 shrink-0 text-accent" />
            <span className="font-medium text-fg">Verified CAD Specialist</span>
            <span className="hidden sm:inline font-mono text-xs text-muted">• Studio and hire briefs active</span>
          </div>
          <Link href="/dashboard/freelancer" className="shrink-0 text-xs font-medium text-accent hover:underline">
            Open Studio →
          </Link>
        </div>
      )}
      {vendorStatus === "approved" && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/25 bg-accent/[0.04] px-4 py-3 text-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-4 shrink-0 text-accent" />
            <span className="font-medium text-fg">Certified Manufacturing Partner</span>
            <span className="hidden sm:inline font-mono text-xs text-muted">• Print farm routing active</span>
          </div>
          <Link href="/dashboard/vendor" className="shrink-0 text-xs font-medium text-accent hover:underline">
            Open Vendor Hub →
          </Link>
        </div>
      )}

      {/* Pending application banners — pulled from DB, not faked */}
      {(freelancerStatus === "pending" || freelancerStatus === "changes_requested") && (
        <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3.5 text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-accent" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-fg">
              {freelancerStatus === "changes_requested"
                ? "Changes requested on your Specialist application"
                : "Your CAD Specialist application is under review"}
            </span>
            <span className="text-xs text-muted">
              {freelancerStatus === "changes_requested"
                ? "Admin has requested adjustments. Review the feedback and resubmit."
                : "Our engineering team verifies CAD experience before profiles go live."}
            </span>
          </div>
          <Link href="/freelance/apply" className="ml-auto shrink-0 text-xs font-medium text-accent hover:underline">
            {freelancerStatus === "changes_requested" ? "View & resubmit →" : "View status →"}
          </Link>
        </div>
      )}
      {(vendorStatus === "pending" || vendorStatus === "changes_requested") && (
        <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-accent" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-fg">
              {vendorStatus === "changes_requested"
                ? "Changes requested on your Manufacturing Partner application"
                : "Your Manufacturing Partner application is under review"}
            </span>
            <span className="text-xs text-muted">
              {vendorStatus === "changes_requested"
                ? "Admin has requested adjustments to your vendor profile."
                : "Our operations team verifies print farm capacity before onboarding."}
            </span>
          </div>
          <Link href="/vendor/apply" className="ml-auto shrink-0 text-xs font-medium text-accent hover:underline">
            {vendorStatus === "changes_requested" ? "View & resubmit →" : "View status →"}
          </Link>
        </div>
      )}

      {/* Fix §4 — zero-state: if no models yet, lead with the actionable card
          so new accounts aren't greeted with a row of inert zeros.
          Once there's data, the stat row is meaningful and comes first. */}
      {modelCount.backendReady && modelCount.data === 0 ? (
        <>
          <StartModelCard />

          {/* Stat row — spec §6.1 — secondary position for empty accounts */}
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Credit Balance"
              value={profile.data ? formatCredits(profile.data.credits_balance) : null}
              action={{ href: "/dashboard/billing", label: "Buy more" }}
            />
            <StatCard
              label="Models Created"
              value={modelCount.backendReady ? formatCredits(modelCount.data) : null}
            />
            <StatCard
              label="Active Mart Orders"
              value={activeOrders.backendReady ? formatCredits(activeOrders.data) : null}
            />
          </div>
        </>
      ) : (
        <>
          {/* Stat row — spec §6.1 */}
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Credit Balance"
              value={profile.data ? formatCredits(profile.data.credits_balance) : null}
              action={{ href: "/dashboard/billing", label: "Buy more" }}
            />
            <StatCard
              label="Models Created"
              value={modelCount.backendReady ? formatCredits(modelCount.data) : null}
            />
            <StatCard
              label="Active Mart Orders"
              value={activeOrders.backendReady ? formatCredits(activeOrders.data) : null}
            />
          </div>

          <StartModelCard />
        </>
      )}

      {/* Recent Models — horizontal scroll row, max 4 (spec §6.1) */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-medium text-fg">Recent Models</h2>
          {recentModels.data.length > 0 ? (
            <Link
              href="/dashboard/models"
              className="text-sm font-medium text-accent hover:text-accent-hover"
            >
              View all →
            </Link>
          ) : null}
        </div>

        {recentModels.data.length === 0 ? (
          <Card>
            <EmptyState
              icon={Box}
              message="No models yet — create your first one"
              action={
                <ButtonLink href="leaffos://new" size="sm" prefetch={false}>
                  Open LeaFF OS
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          /* The one intentional horizontal-scroll row on the site (spec §7). */
          <div className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            {recentModels.data.map((model) => (
              <div key={model.id} className="w-56 shrink-0">
                <ModelCard model={model} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Mart Orders — max 3 (spec §6.1) */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-medium text-fg">Recent Mart Orders</h2>
          {recentOrders.data.length > 0 ? (
            <Link
              href="/dashboard/mart-orders"
              className="text-sm font-medium text-accent hover:text-accent-hover"
            >
              View all →
            </Link>
          ) : null}
        </div>

        <Card className="p-2 md:p-2">
          {recentOrders.data.length === 0 ? (
            <EmptyState icon={Truck} message="No orders yet." size="sm" />
          ) : (
            <ul className="flex flex-col">
              {recentOrders.data.map((order) => (
                <li key={order.id}>
                  <OrderRowCompact order={order} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
