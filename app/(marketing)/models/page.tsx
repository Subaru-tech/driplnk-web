import { PackageSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FeaturedModels } from "@/components/marketing/featured-models";
import { MarketplaceModelCard } from "@/components/marketing/marketplace-model-card";
import { ModelsCatalogLayout } from "@/components/marketing/models-catalog-layout";
import { ModelsHeader } from "@/components/marketing/models-header";
import { ModelsPagination } from "@/components/marketing/models-pagination";
import { Section } from "@/components/marketing/section";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { getMarketplaceCategoryCounts, getMarketplaceModels } from "@/driplnk-web-backend";

export const metadata: Metadata = {
  title: "Browse 3D Models & CAD Marketplace — DripLnk",
  description:
    "Discover, download, customize, and build from a growing library of 3D models and CAD parts. Ready for 3D printing and LeaFF OS.",
};

export const dynamic = "force-dynamic";

const GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";

async function Results({
  category,
  subcategory,
  license,
  search,
  sort,
  page,
  price,
  format,
  counts,
}: {
  category?: string;
  subcategory?: string;
  license?: string;
  search?: string;
  sort?: "newest" | "price_low" | "price_high";
  page: number;
  price?: string;
  format?: string;
  counts: Record<string, number>;
}) {
  // Map "Decorative" to "Art & Decor" so database models match
  const effectiveCategory = category?.toLowerCase() === "decorative" ? "Art & Decor" : category;

  const { data } = await getMarketplaceModels({
    category: effectiveCategory,
    licenseType: license,
    search,
    sort,
    page,
    pageSize: 12,
  });

  let models = data.models;

  // Optional subcategory filter
  if (subcategory) {
    const subClean = subcategory.toLowerCase();
    models = models.filter(
      (m) =>
        m.title.toLowerCase().includes(subClean) ||
        m.description?.toLowerCase().includes(subClean) ||
        m.category?.toLowerCase().includes(subClean)
    );
  }

  // Optional price filter
  if (price === "free") {
    models = models.filter((m) => m.price === 0);
  } else if (price === "paid") {
    models = models.filter((m) => m.price > 0);
  }

  // Optional format filter
  if (format) {
    const targetFmt = format.toUpperCase();
    models = models.filter((m) =>
      m.formats?.some((f) => f.toUpperCase().includes(targetFmt))
    );
  }

  const total = models.length !== data.models.length ? models.length : data.total;
  const totalPages = Math.max(1, Math.ceil(total / 12));

  if (models.length === 0) {
    const hasFilters = Boolean(search || category || subcategory || license || price || format);
    return (
      <ModelsCatalogLayout total={0} counts={counts}>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/40 px-6 py-16 text-center">
          <div className="mb-4 grid size-14 place-items-center rounded-2xl border border-line bg-raised shadow-xs">
            <PackageSearch className="size-7 text-accent" strokeWidth={1.5} />
          </div>
          <h3 className="font-display text-lg font-semibold text-fg">No models found</h3>
          <p className="mt-1 max-w-md text-xs text-muted">
            Try another keyword or remove a filter.
          </p>

          <div className="mt-6 flex items-center gap-3">
            {hasFilters && (
              <Link
                href="/models"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-surface px-4 text-xs font-semibold text-fg hover:bg-raised transition-colors"
              >
                Clear all filters
              </Link>
            )}
            <Link
              href="/dashboard/models/upload"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-accent px-4 text-xs font-semibold text-accent-contrast shadow-xs hover:bg-accent-hover transition-colors"
            >
              + Upload Model
            </Link>
          </div>
        </div>
      </ModelsCatalogLayout>
    );
  }

  return (
    <ModelsCatalogLayout total={total} counts={counts}>
      <div className="flex flex-col gap-8">
        <div className={GRID}>
          {models.map((model) => (
            <MarketplaceModelCard key={model.id} model={model} />
          ))}
        </div>

        <ModelsPagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          searchParams={{
            category,
            subcategory,
            license,
            q: search,
            sort,
            price,
            format,
          }}
        />
      </div>
    </ModelsCatalogLayout>
  );
}

function ResultsSkeleton({ counts }: { counts: Record<string, number> }) {
  return (
    <ModelsCatalogLayout total={0} counts={counts}>
      <SkeletonGroup label="Loading models" className={GRID}>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="aspect-4/3 w-full rounded-xl" />
        ))}
      </SkeletonGroup>
    </ModelsCatalogLayout>
  );
}

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const category = typeof params.category === "string" ? params.category : undefined;
  const subcategory = typeof params.subcategory === "string" ? params.subcategory : undefined;
  const license = typeof params.license === "string" ? params.license : undefined;
  const search = typeof params.q === "string" ? params.q : undefined;
  const sortParam = typeof params.sort === "string" ? params.sort : undefined;
  const price = typeof params.price === "string" ? params.price : undefined;
  const format = typeof params.format === "string" ? params.format : undefined;

  const sort =
    sortParam === "price_low" || sortParam === "price_high" || sortParam === "newest"
      ? sortParam
      : "newest";

  const pageParam = typeof params.page === "string" ? parseInt(params.page, 10) : 1;
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  const [{ data: counts }, { data: initialData }] = await Promise.all([
    getMarketplaceCategoryCounts(),
    getMarketplaceModels({ page: 1, pageSize: 4, sort: "newest" }),
  ]);

  const showFeatured = page === 1 && !search && !category && !subcategory && !license && !price && !format;

  return (
    <Section>
      <div className="flex flex-col gap-10">
        {/* Marketplace Header & Category Strip */}
        <Suspense fallback={null}>
          <ModelsHeader counts={counts} />
        </Suspense>

        {/* Featured / Trending Spotlight with Marketplace Dividers */}
        {showFeatured && (
          <div className="flex flex-col gap-10">
            <div className="border-t border-line/80" />
            <FeaturedModels models={initialData.models} />
            <div className="border-t border-line/80" />
          </div>
        )}

        {/* Catalog Results with Two-Column Filter Layout */}
        <Suspense
          key={`${category ?? ""}-${subcategory ?? ""}-${license ?? ""}-${search ?? ""}-${sort}-${page}-${price ?? ""}-${format ?? ""}`}
          fallback={<ResultsSkeleton counts={counts} />}
        >
          <Results
            category={category}
            subcategory={subcategory}
            license={license}
            search={search}
            sort={sort}
            page={page}
            price={price}
            format={format}
            counts={counts}
          />
        </Suspense>
      </div>
    </Section>
  );
}
