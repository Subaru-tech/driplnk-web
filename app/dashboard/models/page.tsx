import {
  AlertCircle,
  ArrowUpRight,
  Box,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  LibraryBig,
  Plus,
  TrendingUp,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackendNotice } from "@/components/dashboard/backend-notice";
import { AcquiredModelCard } from "@/components/dashboard/acquired-model-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getCreatorStudioModels,
  getUserAcquiredModels,
  type CreatorStudioModel,
} from "@/driplnk-web-backend";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "My Models — Creator Studio | DripLnk",
};

export const dynamic = "force-dynamic";

type StudioTab = "all" | "draft" | "under_review" | "published" | "rejected" | "acquired";

const TABS: { id: StudioTab; label: string }[] = [
  { id: "all", label: "All Models" },
  { id: "draft", label: "Drafts" },
  { id: "under_review", label: "Under Review" },
  { id: "published", label: "Published" },
  { id: "rejected", label: "Rejected" },
  { id: "acquired", label: "Acquired Library" },
];

function StudioTabStrip({ active }: { active: StudioTab }) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none rounded-xl border border-line bg-surface p-1 w-full sm:w-fit">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`/dashboard/models?tab=${tab.id}`}
          className={cn(
            "rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
            active === tab.id
              ? "bg-canvas text-fg font-semibold shadow-xs"
              : "text-muted hover:text-fg hover:bg-raised/50"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: CreatorStudioModel["status"] }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent-muted/60 px-2.5 py-0.5 text-[11px] font-semibold text-accent border border-accent/20">
        <CheckCircle2 className="size-3" />
        <span>Published</span>
      </span>
    );
  }
  if (status === "under_review") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/20">
        <Clock className="size-3" />
        <span>Under Review</span>
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-muted/20 px-2.5 py-0.5 text-[11px] font-semibold text-danger border border-danger/20">
        <AlertCircle className="size-3" />
        <span>Fix & Resubmit</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-raised px-2.5 py-0.5 text-[11px] font-medium text-muted border border-line">
      <span>Draft</span>
    </span>
  );
}

async function CreatorStudioTable({ tab }: { tab: StudioTab }) {
  const { data: models, backendReady } = await getCreatorStudioModels(tab);

  if (models.length === 0) {
    const messages: Record<string, string> = {
      all: "You haven't uploaded any 3D models yet.",
      published: "No models are currently published to the marketplace.",
      under_review: "No models currently pending validation review.",
      draft: "No draft models found.",
      rejected: "No rejected models. All your submissions are in good standing!",
    };

    return (
      <div className="flex flex-col gap-4">
        {backendReady ? null : <BackendNotice />}
        <EmptyState
          icon={Box}
          size="lg"
          message={messages[tab] || "No models found in this tab."}
          action={
            <div className="flex items-center gap-3">
              <ButtonLink href="/dashboard/models/upload" className="gap-1.5">
                <Plus className="size-4" />
                <span>Upload a Model</span>
              </ButtonLink>
              <ButtonLink href="leaffos://new" variant="secondary" prefetch={false}>
                Open LeaFF OS
              </ButtonLink>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-line bg-raised/40 font-semibold uppercase tracking-wider text-faint text-[10px]">
            <tr>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Downloads</th>
              <th className="px-4 py-3">Earned</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {models.map((m) => (
              <tr key={m.id} className="hover:bg-raised/30 transition-colors">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="size-12 shrink-0 rounded-lg overflow-hidden border border-line bg-raised">
                      {m.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.thumbnail_url} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="grid size-full place-items-center">
                          <Box className="size-5 text-faint" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-fg line-clamp-1">{m.title}</span>
                      <span className="text-[11px] text-muted">{m.category || "Mechanical"}</span>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3.5">
                  <StatusBadge status={m.status} />
                </td>

                <td className="px-4 py-3.5 font-mono text-muted text-[11px]">
                  {formatDate(m.created_at)}
                </td>

                <td className="px-4 py-3.5 font-mono font-medium text-fg">
                  {m.price === 0 ? <span className="text-accent">Free</span> : formatCurrency(m.price)}
                </td>

                <td className="px-4 py-3.5 font-mono text-muted">{m.downloads}</td>

                <td className="px-4 py-3.5 font-mono font-semibold text-fg">
                  {formatCurrency(m.earnings)}
                </td>

                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <a
                      href={`leaffos://open?model=${m.id}`}
                      title="Open in LeaFF OS"
                      className="rounded-lg p-1.5 text-muted hover:text-accent hover:bg-raised border border-line transition-colors"
                    >
                      <Cpu className="size-3.5" />
                    </a>
                    {m.status === "published" ? (
                      <Link
                        href={`/models/${m.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-fg hover:border-accent hover:text-accent transition-colors"
                      >
                        <span>View</span>
                        <ArrowUpRight className="size-3" />
                      </Link>
                    ) : (
                      <Link
                        href={`/dashboard/models/upload?id=${m.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-fg hover:border-accent hover:text-accent transition-colors"
                      >
                        <span>Edit</span>
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {models.map((m) => (
          <div key={m.id} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center gap-3">
              <div className="size-14 shrink-0 rounded-lg overflow-hidden border border-line bg-raised">
                {m.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumbnail_url} alt="" className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center">
                    <Box className="size-6 text-faint" />
                  </div>
                )}
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-semibold text-sm text-fg truncate">{m.title}</span>
                <span className="text-xs text-muted">
                  {m.category} · {formatDate(m.created_at)}
                </span>
                <div className="pt-1">
                  <StatusBadge status={m.status} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-y border-line/60 py-2.5 text-center text-xs">
              <div>
                <span className="text-[10px] text-muted uppercase">Price</span>
                <p className="font-mono font-bold text-fg">
                  {m.price === 0 ? "Free" : formatCurrency(m.price)}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-muted uppercase">Downloads</span>
                <p className="font-mono font-bold text-fg">{m.downloads}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted uppercase">Earned</span>
                <p className="font-mono font-bold text-accent">{formatCurrency(m.earnings)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <a
                href={`leaffos://open?model=${m.id}`}
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
              >
                <Cpu className="size-3.5" />
                <span>LeaFF OS</span>
              </a>
              {m.status === "published" ? (
                <Link href={`/models/${m.id}`} className="text-xs font-semibold text-accent hover:underline">
                  View in Marketplace →
                </Link>
              ) : (
                <Link href={`/dashboard/models/upload?id=${m.id}`} className="text-xs font-semibold text-accent hover:underline">
                  Edit Model →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

async function LibraryGrid() {
  const { data: models, backendReady } = await getUserAcquiredModels();

  if (models.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {backendReady ? null : <BackendNotice />}
        <EmptyState
          icon={LibraryBig}
          size="lg"
          message="You have not claimed or acquired any models yet."
          action={<ButtonLink href="/models">Browse Marketplace</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className={GRID}>
      {models.map((item) => (
        <AcquiredModelCard key={item.acquisition_id} model={item} />
      ))}
    </div>
  );
}

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const tabParam = typeof params.tab === "string" ? params.tab : "all";
  const activeTab: StudioTab = TABS.some((t) => t.id === tabParam)
    ? (tabParam as StudioTab)
    : "all";

  // Fetch all models for top-level stats
  const { data: allModels } = await getCreatorStudioModels("all");
  const totalModels = allModels.length;
  const totalDownloads = allModels.reduce((sum, m) => sum + m.downloads, 0);
  const totalEarned = allModels.reduce((sum, m) => sum + m.earnings, 0);

  return (
    <div className="flex flex-col gap-8">
      {/* Studio Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-fg">
              My Models
            </h1>
            <span className="rounded-full bg-accent-muted px-2.5 py-0.5 text-[11px] font-semibold text-accent border border-accent/20">
              Creator Studio
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted">
            Manage your CAD designs, monitor marketplace performance, and track community royalties.
          </p>
        </div>

        <ButtonLink
          href="/dashboard/models/upload"
          id="creator-upload-btn"
          className="gap-2 bg-accent text-accent-contrast font-bold self-start sm:self-auto shadow-sm"
        >
          <Plus className="size-4" />
          <span>Upload Model</span>
        </ButtonLink>
      </div>

      {/* Analytics Snapshot Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-raised text-accent border border-line">
            <Box className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted">Published Designs</span>
            <span className="font-mono text-xl font-bold text-fg">{totalModels}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-raised text-accent border border-line">
            <Download className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted">Total Downloads</span>
            <span className="font-mono text-xl font-bold text-fg">{totalDownloads}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-raised text-accent border border-line">
            <TrendingUp className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted">Creator Revenue</span>
            <span className="font-mono text-xl font-bold text-accent">
              {formatCurrency(totalEarned)}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Filter Strip */}
      <StudioTabStrip active={activeTab} />

      {/* Tab Content */}
      {activeTab === "acquired" ? (
        <Suspense
          fallback={
            <SkeletonGroup label="Loading acquired models" className={GRID}>
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="aspect-4/3 w-full rounded-xl" />
              ))}
            </SkeletonGroup>
          }
        >
          <LibraryGrid />
        </Suspense>
      ) : (
        <Suspense
          key={activeTab}
          fallback={
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          }
        >
          <CreatorStudioTable tab={activeTab} />
        </Suspense>
      )}
    </div>
  );
}
