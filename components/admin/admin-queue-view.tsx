"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Box,
  Briefcase,
  Factory,
  Package,
  ShieldAlert,
  Users,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { ListingReviewActions } from "@/components/admin/listing-actions";
import { ModelReviewActions } from "@/components/admin/model-actions";
import { ModerationQueueActions } from "@/components/admin/moderation-actions";
import { FreelancerReviewCard } from "@/components/admin/freelancer-review-card";
import { VendorReviewCard } from "@/components/admin/vendor-review-card";
import type {
  AdminPendingProvider,
  AdminPendingModel,
  AdminListing,
} from "@/driplnk-web-backend/db/queries";
import type { AdminModerationItem } from "@/driplnk-web-backend/actions/admin";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export type AdminQueueTab = "models" | "freelancers" | "vendors" | "moderation";

interface AdminQueueViewProps {
  listings: AdminListing[];
  models: AdminPendingModel[];
  providers: AdminPendingProvider[];
  moderationQueue: AdminModerationItem[];
}

export function AdminQueueView({
  listings,
  models,
  providers,
  moderationQueue,
}: AdminQueueViewProps) {
  const [activeTab, setActiveTab] = useState<AdminQueueTab>("freelancers");

  const freelancers = providers.filter((p) => p.type === "freelancer");
  const vendors = providers.filter((p) => p.type === "vendor");
  const modelReviewsCount = listings.length + models.length;

  const pendingFreelancersCount = freelancers.filter(
    (f) => f.status === "pending" || f.status === "changes_requested"
  ).length;
  const pendingVendorsCount = vendors.filter(
    (v) => v.status === "pending" || v.status === "changes_requested"
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Navigation Tabs Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        {/* Conceptual Hierarchy Tree */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold uppercase text-accent tracking-wider mr-2">
            Admin Queue:
          </span>

          {/* Tab 1: Freelancer Applications */}
          <button
            type="button"
            onClick={() => setActiveTab("freelancers")}
            className={cn(
              "inline-flex items-center gap-2 rounded-[var(--radius-control)] px-3.5 py-2 text-xs font-medium transition-all",
              activeTab === "freelancers"
                ? "border border-line bg-surface text-fg font-semibold shadow-xs"
                : "border border-transparent text-muted hover:text-fg hover:bg-surface/50"
            )}
          >
            <Briefcase className="size-3.5 text-accent" />
            <span>Freelancer Applications</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.2 font-mono text-[10px]",
                pendingFreelancersCount > 0
                  ? "bg-accent/15 text-accent font-bold"
                  : "bg-raised text-muted"
              )}
            >
              {freelancers.length}
            </span>
          </button>

          {/* Tab 2: Vendor Applications */}
          <button
            type="button"
            onClick={() => setActiveTab("vendors")}
            className={cn(
              "inline-flex items-center gap-2 rounded-[var(--radius-control)] px-3.5 py-2 text-xs font-medium transition-all",
              activeTab === "vendors"
                ? "border border-line bg-surface text-fg font-semibold shadow-xs"
                : "border border-transparent text-muted hover:text-fg hover:bg-surface/50"
            )}
          >
            <Factory className="size-3.5 text-accent" />
            <span>Vendor Applications</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.2 font-mono text-[10px]",
                pendingVendorsCount > 0
                  ? "bg-accent/15 text-accent font-bold"
                  : "bg-raised text-muted"
              )}
            >
              {vendors.length}
            </span>
          </button>

          {/* Tab 3: Model Reviews */}
          <button
            type="button"
            onClick={() => setActiveTab("models")}
            className={cn(
              "inline-flex items-center gap-2 rounded-[var(--radius-control)] px-3.5 py-2 text-xs font-medium transition-all",
              activeTab === "models"
                ? "border border-line bg-surface text-fg font-semibold shadow-xs"
                : "border border-transparent text-muted hover:text-fg hover:bg-surface/50"
            )}
          >
            <Box className="size-3.5 text-accent" />
            <span>Model Reviews</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.2 font-mono text-[10px]",
                modelReviewsCount > 0
                  ? "bg-amber-500/15 text-amber-400 font-bold"
                  : "bg-raised text-muted"
              )}
            >
              {modelReviewsCount}
            </span>
          </button>

          {/* Tab 4: Content Moderation */}
          {moderationQueue.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("moderation")}
              className={cn(
                "inline-flex items-center gap-2 rounded-[var(--radius-control)] px-3.5 py-2 text-xs font-medium transition-all",
                activeTab === "moderation"
                  ? "border border-line bg-surface text-fg font-semibold shadow-xs"
                  : "border border-transparent text-muted hover:text-fg hover:bg-surface/50"
              )}
            >
              <ShieldAlert className="size-3.5 text-rose-400" />
              <span>IP & Content Reports</span>
              <span className="rounded-full bg-rose-500/15 px-2 py-0.2 font-mono text-[10px] font-bold text-rose-400">
                {moderationQueue.length}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: FREELANCER APPLICATIONS                                        */}
      {/* ===================================================================== */}
      {activeTab === "freelancers" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-fg">
                Freelancer Applications ({freelancers.length})
              </h3>
              <p className="text-xs text-muted">
                Review CAD specialists, verify modeling proficiencies, request revisions, and issue the Verified badge.
              </p>
            </div>
            {pendingFreelancersCount > 0 && (
              <StatusPill tone="warning">{pendingFreelancersCount} awaiting review</StatusPill>
            )}
          </div>

          {freelancers.length === 0 ? (
            <Card>
              <EmptyState
                icon={Briefcase}
                size="sm"
                message="No freelance CAD specialist applications are currently waiting for review."
              />
            </Card>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {freelancers.map((f) => (
                <FreelancerReviewCard key={f.provider_id} provider={f} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: VENDOR APPLICATIONS                                            */}
      {/* ===================================================================== */}
      {activeTab === "vendors" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-fg">
                Vendor Applications ({vendors.length})
              </h3>
              <p className="text-xs text-muted">
                Inspect 3D print farms, verify GSTIN and machine fleet capacity, request changes, or approve for Mart order routing.
              </p>
            </div>
            {pendingVendorsCount > 0 && (
              <StatusPill tone="warning">{pendingVendorsCount} awaiting review</StatusPill>
            )}
          </div>

          {vendors.length === 0 ? (
            <Card>
              <EmptyState
                icon={Factory}
                size="sm"
                message="No print farm vendor applications are currently waiting for review."
              />
            </Card>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {vendors.map((v) => (
                <VendorReviewCard key={v.provider_id} provider={v} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: MODEL REVIEWS                                                  */}
      {/* ===================================================================== */}
      {activeTab === "models" && (
        <div className="flex flex-col gap-8">
          {/* Models */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="size-4 text-accent" />
                <h3 className="font-display text-base font-semibold text-fg">
                  3D CAD Models ({models.length})
                </h3>
              </div>
              <span className="text-xs text-muted">Models entering /models catalog</span>
            </div>

            {models.length === 0 ? (
              <Card>
                <EmptyState
                  icon={Box}
                  size="sm"
                  message="No 3D CAD models currently awaiting review."
                />
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-line bg-raised/40 font-semibold uppercase tracking-wider text-faint text-[10px]">
                        <th scope="col" className="px-4 py-3">Model</th>
                        <th scope="col" className="px-4 py-3">Category</th>
                        <th scope="col" className="px-4 py-3">Price</th>
                        <th scope="col" className="px-4 py-3">Status</th>
                        <th scope="col" className="px-4 py-3">Submitted</th>
                        <th scope="col" className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {models.map((m) => (
                        <tr key={m.id} className="hover:bg-raised/30 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              {m.thumbnail_url ? (
                                <Image
                                  src={m.thumbnail_url}
                                  alt={m.title}
                                  width={36}
                                  height={36}
                                  className="size-9 rounded-md border border-line object-cover bg-raised"
                                />
                              ) : (
                                <div className="grid size-9 place-items-center rounded-md border border-line bg-raised text-muted">
                                  <Box className="size-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-fg">{m.title}</p>
                                <p className="truncate font-mono text-[11px] text-muted">
                                  {m.seller_name}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 capitalize text-muted">{m.category}</td>
                          <td className="px-4 py-3.5 font-mono text-muted">
                            {formatCurrency(m.price)}
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusPill tone="warning">{m.status}</StatusPill>
                          </td>
                          <td className="px-4 py-3.5 text-muted">{formatDate(m.created_at)}</td>
                          <td className="px-4 py-3.5 text-right">
                            <ModelReviewActions modelId={m.id} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          {/* Legacy Listings */}
          {listings.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-accent" />
                  <h3 className="font-display text-base font-semibold text-fg">
                    Marketplace Listings ({listings.length})
                  </h3>
                </div>
              </div>

              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-line bg-raised/40 font-semibold uppercase tracking-wider text-faint text-[10px]">
                        <th scope="col" className="px-4 py-3">Listing</th>
                        <th scope="col" className="px-4 py-3">Seller</th>
                        <th scope="col" className="px-4 py-3">Price</th>
                        <th scope="col" className="px-4 py-3">Submitted</th>
                        <th scope="col" className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {listings.map((l) => (
                        <tr key={l.id} className="hover:bg-raised/30 transition-colors">
                          <td className="px-4 py-3.5">
                            <p className="truncate font-semibold text-fg">{l.title}</p>
                          </td>
                          <td className="px-4 py-3.5 text-muted">
                            {l.seller?.studio_name || "Unknown"}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-medium text-fg">
                            {formatCurrency(l.price_inr)}
                          </td>
                          <td className="px-4 py-3.5 text-muted">{formatDate(l.created_at)}</td>
                          <td className="px-4 py-3.5 text-right">
                            <ListingReviewActions listingId={l.id} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: IP & CONTENT MODERATION                                        */}
      {/* ===================================================================== */}
      {activeTab === "moderation" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-fg">
                Reported Models & IP Moderation ({moderationQueue.length})
              </h3>
              <p className="text-xs text-muted">
                User reports for intellectual property infringement, prohibited weapon designs, or counterfeit claims.
              </p>
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line bg-raised/40 font-semibold uppercase tracking-wider text-faint text-[10px]">
                    <th scope="col" className="px-4 py-3">Reported Model</th>
                    <th scope="col" className="px-4 py-3">Reason</th>
                    <th scope="col" className="px-4 py-3">Reporter</th>
                    <th scope="col" className="px-4 py-3">Details / Evidence</th>
                    <th scope="col" className="px-4 py-3">Date</th>
                    <th scope="col" className="px-4 py-3 text-right">Moderation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {moderationQueue.map((item) => {
                    const report = item.reports?.[0];
                    return (
                      <tr key={item.id} className="hover:bg-raised/30 transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-fg">{item.title}</p>
                          <p className="text-[11px] text-muted font-mono">{item.seller_name}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusPill tone="danger">
                            {report?.reason || (item.moderation_flags?.weapon_match ? "Safety Keyword Match" : "Flagged")}
                          </StatusPill>
                        </td>
                        <td className="px-4 py-3.5 text-muted font-mono text-[11px]">
                          {report?.reporter_contact || "Automated Safety Filter"}
                        </td>
                        <td className="px-4 py-3.5 max-w-xs text-muted">
                          <p className="truncate">
                            {report?.details || (item.moderation_flags?.weapon_match ? "Prohibited weapon keywords detected" : "Flagged for administrative review")}
                          </p>
                          {report?.evidence_url && (
                            <a
                              href={report.evidence_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-accent underline mt-0.5"
                            >
                              <span>Evidence</span>
                              <ExternalLink className="size-3" />
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-muted">{formatDate(item.created_at)}</td>
                        <td className="px-4 py-3.5 text-right">
                          <ModerationQueueActions reportId={report?.id || item.id} modelId={item.id} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
