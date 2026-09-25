import type { Metadata } from "next";
import { StatusPill } from "@/components/ui/status-pill";
import {
  getAdminPendingListings,
  getAdminPendingModels,
  getAdminPendingProviders,
  getAdminModerationQueue,
} from "@/driplnk-web-backend";
import { AdminQueueView } from "@/components/admin/admin-queue-view";

export const metadata: Metadata = {
  title: "Admin Queue — Model Reviews, Freelancers & Vendors | DripLnk",
};
export const dynamic = "force-dynamic";

export default async function AdminListingsPage() {
  const [{ data: listings }, { data: models }, { data: providers }, moderationQueue] = await Promise.all([
    getAdminPendingListings(),
    getAdminPendingModels(),
    getAdminPendingProviders(),
    getAdminModerationQueue(),
  ]);

  const pendingProvidersCount = providers.filter(
    (p) => p.status === "pending" || p.status === "changes_requested"
  ).length;
  const totalPending = listings.length + models.length + pendingProvidersCount + moderationQueue.length;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-6">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-fg">
            Admin Verification Queue
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            Inspect model submissions, review specialist and manufacturing vendor applications, request changes, and issue Verified badges.
          </p>
        </div>
        <StatusPill tone={totalPending > 0 ? "warning" : "neutral"} className="w-fit">
          {totalPending} awaiting review
        </StatusPill>
      </div>

      {/* Admin Queue View: Models, Freelancers, Vendors, and Moderation */}
      <AdminQueueView
        listings={listings}
        models={models}
        providers={providers}
        moderationQueue={moderationQueue}
      />
    </div>
  );
}
