import { LibraryBig } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AcquiredModelCard } from "@/components/dashboard/acquired-model-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { getUserAcquiredModels } from "@/driplnk-web-backend";

export const metadata: Metadata = {
  title: "My Library — DripLnk",
  description: "View and download your acquired 3D models.",
};

export const dynamic = "force-dynamic";

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

async function LibraryGrid() {
  const { data: models } = await getUserAcquiredModels();

  if (models.length === 0) {
    return (
      <EmptyState
        icon={LibraryBig}
        size="lg"
        message="You haven't added any models to your library yet."
        action={
          <ButtonLink href="/models" size="lg">
            Browse Models Marketplace
          </ButtonLink>
        }
      />
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

function LibrarySkeleton() {
  return (
    <SkeletonGroup label="Loading library models" className={GRID}>
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="aspect-4/3 w-full rounded-[var(--radius-card)]" />
      ))}
    </SkeletonGroup>
  );
}

export default async function LibraryPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-fg">My Library</h1>
          <p className="text-sm text-muted">
            All models acquired or claimed into your personal DripLnk library. Download raw
            geometry files or send them directly to Mart for manufacturing.
          </p>
        </div>

        <ButtonLink href="/models" variant="secondary" size="sm">
          Browse Marketplace
        </ButtonLink>
      </div>

      <Suspense fallback={<LibrarySkeleton />}>
        <LibraryGrid />
      </Suspense>
    </div>
  );
}
