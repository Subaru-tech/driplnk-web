"use client";

import { Box, Layers, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";

// Ordered priority category strip matching the requested engineering taxonomy
const PRIMARY_CATEGORIES = [
  { key: "mechanical", label: "Mechanical", dbCategory: "Mechanical" },
  { key: "robotics", label: "Robotics", dbCategory: "Robotics" },
  { key: "electronics", label: "Electronics", dbCategory: "Electronics" },
  { key: "tools", label: "Tools", dbCategory: "Tools & Jigs" },
  { key: "enclosures", label: "Enclosures", dbCategory: "Enclosures" },
  { key: "replacement", label: "Replacement Parts", dbCategory: "Replacement Parts" },
  { key: "educational", label: "Educational", dbCategory: "Educational" },
  { key: "decorative", label: "Decorative", dbCategory: "Art & Decor" },
  { key: "other", label: "Other", dbCategory: "Other" },
] as const;

export function ModelsHeader({
  counts = {},
}: {
  counts?: Record<string, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeCategory = searchParams.get("category") ?? "";
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  function applyParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page"); // Reset pagination

    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  // Keyboard shortcut '/' to quickly focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Debounce search update
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (search === current) return;
    const timer = setTimeout(() => {
      applyParams({ q: search || null });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-col gap-6">
      {/* Marketplace Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-surface to-canvas p-6 sm:p-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 size-72 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-4 max-w-3xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent-muted px-3 py-1 text-xs font-semibold text-accent">
                  <Box className="size-3.5" aria-hidden="true" />
                  CAD & 3D Assets
                </span>
                <span className="text-xs text-muted">Ready for 3D Printing & LeaFF OS</span>
              </div>

              <h1 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl md:text-5xl">
                Models
              </h1>
            </div>

            <Link
              href="/dashboard/models/upload"
              id="header-upload-model-btn"
              className="inline-flex items-center gap-2 self-start shrink-0 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-accent-contrast shadow-sm hover:bg-accent-hover active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="size-4" />
              <span>+ Upload Model</span>
            </Link>
          </div>

          <p className="text-sm text-muted sm:text-base leading-relaxed max-w-2xl">
            Engineering-grade CAD marketplace for functional 3D printing, robotics hardware, precision enclosures, and replacement parts.
          </p>

          {/* Prominent Search Bar */}
          <div className="relative mt-2 w-full max-w-2xl">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              id="models-marketplace-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search engineering models, STEP assemblies, enclosures... (Press / to focus)"
              aria-label="Search models"
              className="h-11 w-full rounded-xl border border-line bg-surface/90 pl-10 pr-20 text-sm text-fg shadow-xs backdrop-blur-sm placeholder:text-muted/60 transition-all hover:border-line-strong focus:border-accent focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {search ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  applyParams({ q: null });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:text-fg"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            ) : (
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded bg-raised px-1.5 py-0.5 text-[10px] font-mono text-muted border border-line">
                <span>/</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Navigation Strip */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-muted px-1">
          <span className="font-medium uppercase tracking-wider text-[11px] text-faint">
            Category Navigation
          </span>
          {activeCategory && (
            <button
              type="button"
              onClick={() => applyParams({ category: null })}
              className="text-xs text-accent hover:underline"
            >
              Reset to All
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => applyParams({ category: null })}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium transition-colors cursor-pointer",
              !activeCategory
                ? "border-accent bg-accent text-accent-contrast shadow-xs font-semibold"
                : "border-line bg-surface text-muted hover:border-line-strong hover:bg-raised hover:text-fg"
            )}
          >
            <Layers className="size-3.5" aria-hidden="true" />
            <span>All</span>
          </button>

          {PRIMARY_CATEGORIES.map((item) => {
            const isSelected =
              activeCategory.toLowerCase() === item.label.toLowerCase() ||
              activeCategory.toLowerCase() === item.key.toLowerCase() ||
              activeCategory.toLowerCase() === item.dbCategory.toLowerCase();
            const count = counts[item.dbCategory] ?? counts[item.label] ?? counts[item.key];

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => applyParams({ category: isSelected ? null : item.label })}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer",
                  isSelected
                    ? "border-accent bg-accent text-accent-contrast shadow-xs font-semibold"
                    : "border-line bg-surface text-muted hover:border-line-strong hover:bg-raised hover:text-fg"
                )}
              >
                <span>{item.label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px]",
                      isSelected
                        ? "bg-black/20 text-accent-contrast font-bold"
                        : "bg-raised text-faint group-hover:text-muted"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
