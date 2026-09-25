"use client";

import { Filter, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/cn";
import {
  CATEGORY_LIST,
  MODEL_FORMATS,
  MODEL_LICENSE_LIST,
  PRINT_MATERIALS,
  SUBCATEGORIES_BY_CATEGORY,
} from "@/lib/marketplace";

export const MODEL_SORTS = {
  newest: { label: "Newest arrivals" },
  price_low: { label: "Price: low to high" },
  price_high: { label: "Price: high to low" },
} as const;

export function MarketplaceTopBar({
  total = 0,
  onOpenMobileFilters,
}: {
  total: number;
  onOpenMobileFilters?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const category = searchParams.get("category") ?? "";
  const subcategory = searchParams.get("subcategory") ?? "";
  const license = searchParams.get("license") ?? "";
  const priceFilter = searchParams.get("price") ?? "";
  const format = searchParams.get("format") ?? "";
  const material = searchParams.get("material") ?? "";
  const sort = searchParams.get("sort") ?? "newest";

  const activeCount = [category, subcategory, license, priceFilter, format, material].filter(Boolean).length;

  function apply(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  function clearAll() {
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    if (q) params.set("q", q);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  return (
    <div className="flex flex-col gap-3 pb-2 border-b border-line/60">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-semibold text-fg">
            {subcategory || category || "All Models"}
          </h2>
          <span className="rounded-full bg-raised px-2.5 py-0.5 font-mono text-xs text-muted border border-line">
            {total} {total === 1 ? "model" : "models"}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Mobile filter button */}
          {onOpenMobileFilters && (
            <button
              type="button"
              onClick={onOpenMobileFilters}
              aria-label="Open filter drawer"
              className="flex lg:hidden items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg hover:bg-raised"
            >
              <SlidersHorizontal className="size-3.5 text-accent" />
              <span>Filters</span>
              {activeCount > 0 && (
                <span className="rounded-full bg-accent px-1.5 py-0.2 text-[10px] text-accent-contrast font-bold">
                  {activeCount}
                </span>
              )}
            </button>
          )}

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted hidden sm:inline">Sort:</span>
            <select
              id="models-sort-dropdown"
              aria-label="Sort models"
              value={sort}
              onChange={(e) => apply({ sort: e.target.value })}
              className="h-8 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-fg hover:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
            >
              {Object.entries(MODEL_SORTS).map(([key, opt]) => (
                <option key={key} value={key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Active Filter Badges */}
      {activeCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
          <span className="text-muted text-[11px]">Active filters:</span>
          {category && (
            <FilterTag label={`Category: ${category}`} onRemove={() => apply({ category: null, subcategory: null })} />
          )}
          {subcategory && (
            <FilterTag label={`Subcategory: ${subcategory}`} onRemove={() => apply({ subcategory: null })} />
          )}
          {license && (
            <FilterTag label={`License: ${license}`} onRemove={() => apply({ license: null })} />
          )}
          {priceFilter && (
            <FilterTag label={`Price: ${priceFilter}`} onRemove={() => apply({ price: null })} />
          )}
          {format && (
            <FilterTag label={`Format: ${format}`} onRemove={() => apply({ format: null })} />
          )}
          {material && (
            <FilterTag label={`Material: ${material}`} onRemove={() => apply({ material: null })} />
          )}
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 text-[11px] text-accent hover:underline font-medium ml-1 cursor-pointer"
          >
            <RotateCcw className="size-3" />
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-raised border border-line px-2 py-0.5 text-xs text-fg">
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${label}`}
        className="rounded p-0.5 text-muted hover:text-fg hover:bg-surface cursor-pointer"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

export function MarketplaceSidebarFilters({
  counts = {},
  className,
}: {
  counts?: Record<string, number>;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const category = searchParams.get("category") ?? "";
  const subcategory = searchParams.get("subcategory") ?? "";
  const license = searchParams.get("license") ?? "";
  const priceFilter = searchParams.get("price") ?? "";
  const format = searchParams.get("format") ?? "";
  const material = searchParams.get("material") ?? "";

  function apply(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  // Find subcategories if current category has any
  const matchedKey = Object.keys(SUBCATEGORIES_BY_CATEGORY).find(
    (k) => k.toLowerCase() === category.toLowerCase() || category.toLowerCase().includes(k)
  );
  const subcategories = matchedKey ? SUBCATEGORIES_BY_CATEGORY[matchedKey] : [];

  return (
    <aside
      aria-label="Marketplace filters"
      className={cn(
        "flex flex-col gap-6 rounded-xl border border-line bg-surface/60 p-4 backdrop-blur-xs",
        className
      )}
    >
      <div className="flex items-center justify-between pb-3 border-b border-line/60">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-accent" aria-hidden="true" />
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-fg">
            Filters
          </h3>
        </div>
      </div>

      {/* 1. Category */}
      <div className="flex flex-col gap-2.5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Category
        </h4>
        <div className="flex flex-col gap-1 text-xs">
          <label className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-raised cursor-pointer text-fg">
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="filter-cat"
                checked={!category}
                onChange={() => apply({ category: null, subcategory: null })}
                className="accent-accent cursor-pointer"
              />
              <span>All Categories</span>
            </span>
          </label>
          {CATEGORY_LIST.slice(0, 9).map((cat) => {
            const isChecked =
              category.toLowerCase() === cat.label.toLowerCase() ||
              category.toLowerCase() === cat.id.toLowerCase();
            const count = counts[cat.label] ?? counts[cat.id];
            return (
              <label
                key={cat.id}
                className={cn(
                  "flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-raised cursor-pointer transition-colors",
                  isChecked ? "bg-accent-muted/40 font-medium text-accent" : "text-muted hover:text-fg"
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="filter-cat"
                    checked={isChecked}
                    onChange={() => apply({ category: isChecked ? null : cat.label, subcategory: null })}
                    className="accent-accent cursor-pointer"
                  />
                  <span>{cat.label}</span>
                </span>
                {count !== undefined && count > 0 && (
                  <span className="font-mono text-[11px] text-faint">({count})</span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* 1b. Subcategories (Shown when active category has subcategories) */}
      {subcategories && subcategories.length > 0 && (
        <div className="flex flex-col gap-2.5 border-t border-line/50 pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Subcategory
          </h4>
          <div className="flex flex-col gap-1 text-xs">
            <label className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-raised cursor-pointer text-fg">
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="filter-subcat"
                  checked={!subcategory}
                  onChange={() => apply({ subcategory: null })}
                  className="accent-accent cursor-pointer"
                />
                <span>All Subcategories</span>
              </span>
            </label>
            {subcategories.map((sub) => {
              const isChecked = subcategory.toLowerCase() === sub.label.toLowerCase();
              return (
                <label
                  key={sub.id}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-raised cursor-pointer transition-colors",
                    isChecked ? "bg-accent-muted/40 font-medium text-accent" : "text-muted hover:text-fg"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="filter-subcat"
                      checked={isChecked}
                      onChange={() => apply({ subcategory: isChecked ? null : sub.label })}
                      className="accent-accent cursor-pointer"
                    />
                    <span>{sub.label}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. License */}
      <div className="flex flex-col gap-2.5 border-t border-line/50 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
          License
        </h4>
        <div className="flex flex-col gap-1 text-xs">
          <label className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-raised cursor-pointer text-fg">
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="filter-license"
                checked={!license}
                onChange={() => apply({ license: null })}
                className="accent-accent"
              />
              <span>All Licenses</span>
            </span>
          </label>
          {MODEL_LICENSE_LIST.map((lic) => {
            const isChecked = license === lic.id;
            return (
              <label
                key={lic.id}
                className={cn(
                  "flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-raised cursor-pointer transition-colors",
                  isChecked ? "bg-accent-muted/40 font-medium text-accent" : "text-muted hover:text-fg"
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="filter-license"
                    checked={isChecked}
                    onChange={() => apply({ license: isChecked ? null : lic.id })}
                    className="accent-accent"
                  />
                  <span>{lic.badge}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 3. Price Filter */}
      <div className="flex flex-col gap-2.5 border-t border-line/50 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Price
        </h4>
        <div className="flex flex-col gap-1 text-xs">
          {[
            { id: "", label: "All Prices" },
            { id: "free", label: "Free only" },
            { id: "paid", label: "Paid models" },
          ].map((item) => (
            <label
              key={item.id}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-raised cursor-pointer transition-colors",
                priceFilter === item.id ? "bg-accent-muted/40 font-medium text-accent" : "text-muted hover:text-fg"
              )}
            >
              <input
                type="radio"
                name="filter-price"
                checked={priceFilter === item.id}
                onChange={() => apply({ price: item.id || null })}
                className="accent-accent"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 4. Format Filter */}
      <div className="flex flex-col gap-2.5 border-t border-line/50 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
          File Format
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {MODEL_FORMATS.map((fmt) => {
            const isChecked = format === fmt;
            return (
              <button
                key={fmt}
                type="button"
                onClick={() => apply({ format: isChecked ? null : fmt })}
                className={cn(
                  "rounded-md border px-2.5 py-1 font-mono text-[11px] font-medium transition-colors cursor-pointer",
                  isChecked
                    ? "border-accent bg-accent text-accent-contrast font-bold"
                    : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg"
                )}
              >
                .{fmt.toLowerCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Print Material Recommendation */}
      <div className="flex flex-col gap-2.5 border-t border-line/50 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Print Material
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {PRINT_MATERIALS.map((mat) => {
            const isChecked = material === mat;
            return (
              <button
                key={mat}
                type="button"
                onClick={() => apply({ material: isChecked ? null : mat })}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                  isChecked
                    ? "border-accent bg-accent text-accent-contrast font-bold"
                    : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg"
                )}
              >
                {mat}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

// Backward compatibility export
export function ModelsFilters({ counts }: { counts: Record<string, number> }) {
  return <MarketplaceSidebarFilters counts={counts} />;
}
