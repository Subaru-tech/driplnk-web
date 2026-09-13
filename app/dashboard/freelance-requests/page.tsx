import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, Users } from "lucide-react";
import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { getBuyerFreelanceRequests } from "@/driplnk-web-backend/db/queries";
import { BuyerRequestsClient } from "@/components/dashboard/buyer-requests-client";
import { StatCard } from "@/components/dashboard/stat-card";

export const metadata: Metadata = {
  title: "Hire Requests — DripLnk",
  description: "Track CAD briefs, specialist quotes, and custom 3D model deliverables.",
};

export const dynamic = "force-dynamic";

export default async function BuyerFreelanceRequestsPage() {
  const user = await getUnifiedUser();
  if (!user) {
    redirect("/login?redirect=/dashboard/freelance-requests");
  }

  const { data: requests } = await getBuyerFreelanceRequests();

  const requestedCount = requests.filter((r) => r.status === "requested").length;
  const activeCount = requests.filter(
    (r) => r.status === "accepted" || r.status === "in_progress"
  ).length;
  const deliveredCount = requests.filter((r) => r.status === "delivered").length;
  const completedCount = requests.filter((r) => r.status === "completed").length;

  return (
    <div className="flex flex-col gap-8 py-2">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-fg">Hire Requests</h1>
          <p className="mt-1 text-sm text-muted">
            Track your custom CAD briefs, specialist quotes, and final files.
          </p>
        </div>

        <Link
          href="/freelance"
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-4 text-xs font-semibold text-accent-contrast shadow hover:bg-accent/90"
        >
          <Sparkles className="size-3.5" />
          <span>Browse Specialists</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Awaiting Quote"
          value={requestedCount > 0 ? String(requestedCount) : null}
        />
        <StatCard
          label="In Progress"
          value={activeCount > 0 ? String(activeCount) : null}
        />
        <StatCard
          label="Delivered"
          value={deliveredCount > 0 ? String(deliveredCount) : null}
        />
        <StatCard
          label="Completed"
          value={completedCount > 0 ? String(completedCount) : null}
        />
      </div>

      {/* Requests Feed */}
      <BuyerRequestsClient initialRequests={requests} />
    </div>
  );
}
