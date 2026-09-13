import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  FileCheck,
  Plus,
  ShieldAlert,
  Sparkles,
  Wrench,
} from "lucide-react";
import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import {
  getMyFreelanceProvider,
  getFreelancerIncomingRequests,
} from "@/driplnk-web-backend/db/queries";
import { FreelancerJobsClient } from "@/components/dashboard/freelancer-jobs-client";
import { StatCard } from "@/components/dashboard/stat-card";

export const metadata: Metadata = {
  title: "Specialist Jobs — DripLnk",
  description: "Manage incoming CAD and 3D modeling hire requests, milestones, and deliverables.",
};

export const dynamic = "force-dynamic";

export default async function FreelancerDashboardPage() {
  const user = await getUnifiedUser();
  if (!user) {
    redirect("/login?redirect=/dashboard/freelancer");
  }

  const { data: provider } = await getMyFreelanceProvider();

  // Gated: User must have an approved provider row of type 'freelancer'
  if (!provider || provider.status !== "approved") {
    return (
      <div className="flex flex-col gap-6 py-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-fg">Specialist Studio</h1>
          <p className="mt-1 text-sm text-muted">
            Manage your custom 3D modeling requests and milestone deliverables.
          </p>
        </div>

        <div className="flex flex-col items-center gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center sm:p-12">
          <div className="grid size-14 place-items-center rounded-full bg-accent-muted text-accent">
            <Wrench className="size-7" />
          </div>
          <div className="flex flex-col gap-2 max-w-md">
            <h2 className="font-display text-xl font-semibold text-fg">
              {provider?.status === "pending"
                ? "Your specialist application is under review"
                : "You don't have a specialist profile yet"}
            </h2>
            <p className="text-sm leading-relaxed text-muted">
              {provider?.status === "pending"
                ? "Our engineering team verifies manufacturing and CAD experience before profiles go live. You'll receive notification once approved."
                : "Join the DripLnk specialist network to receive paid CAD requests, mechanical engineering jobs, and 3D enclosure briefs from hardware builders."}
            </p>
          </div>

          <Link
            href="/freelance/apply"
            className="mt-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-6 font-display text-sm font-semibold text-accent-contrast shadow-lg hover:bg-accent/90"
          >
            <Sparkles className="size-4" />
            <span>{provider?.status === "pending" ? "Update Application" : "Apply as a Specialist"}</span>
          </Link>
        </div>
      </div>
    );
  }

  const { data: requests } = await getFreelancerIncomingRequests();

  const pendingCount = requests.filter((r) => r.status === "requested").length;
  const activeCount = requests.filter(
    (r) => r.status === "accepted" || r.status === "in_progress"
  ).length;
  const deliveredCount = requests.filter((r) => r.status === "delivered").length;
  const completedCount = requests.filter((r) => r.status === "completed").length;

  return (
    <div className="flex flex-col gap-8 py-2">
      {/* Overview Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-fg">Specialist Studio</h1>
          <p className="mt-1 text-sm text-muted">
            Incoming briefs, milestones, and deliverable handoffs.
          </p>
        </div>

        <Link
          href="/freelance/apply"
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-4 text-xs font-medium text-fg hover:bg-raised"
        >
          <Wrench className="size-3.5" />
          <span>Edit Specialist Profile</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Pending Review"
          value={pendingCount > 0 ? String(pendingCount) : null}
        />
        <StatCard
          label="Active Jobs"
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

      {/* Requests Table / Feed */}
      <FreelancerJobsClient
        initialRequests={requests}
        currentUserId={user.id}
      />
    </div>
  );
}
