"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  ShieldCheck,
  Star,
  ArrowRight,
  Filter,
  CheckCircle2,
  X,
  Briefcase,
  ExternalLink,
} from "lucide-react";
import type { FreelancerProfile, RateType } from "@/lib/types";
import { cn } from "@/lib/cn";
import { TrustBadge } from "@/components/trust/trust-badge";

export type FreelanceBrowserProps = {
  initialProfiles: FreelancerProfile[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  initialTotalPages: number;
};

const POPULAR_SKILLS = [
  "All Skills",
  "SolidWorks",
  "Fusion 360",
  "LeaFF OS",
  "Enclosures",
  "Snap-fit",
  "Tolerance ±0.05mm",
  "Planetary Gears",
];

export function FreelanceBrowser({
  initialProfiles,
  initialTotal,
  initialPage,
  initialPageSize,
  initialTotalPages,
}: FreelanceBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("All Skills");
  const [selectedRateType, setSelectedRateType] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(initialPage);

  // Filter profiles based on current filter state
  const filteredProfiles = useMemo(() => {
    return initialProfiles.filter((p) => {
      // Rate type filter
      if (selectedRateType !== "all" && p.rate_type !== selectedRateType) {
        return false;
      }

      // Skill filter
      if (
        selectedSkill !== "All Skills" &&
        !p.skills.some((s) => s.toLowerCase().includes(selectedSkill.toLowerCase()))
      ) {
        return false;
      }

      // Search query (display_name, bio, skills)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.display_name.toLowerCase().includes(q);
        const matchesBio = p.bio?.toLowerCase().includes(q) ?? false;
        const matchesSkills = p.skills.some((s) => s.toLowerCase().includes(q));
        if (!matchesName && !matchesBio && !matchesSkills) {
          return false;
        }
      }

      return true;
    });
  }, [initialProfiles, selectedRateType, selectedSkill, searchQuery]);

  // Client pagination
  const pageSize = initialPageSize || 12;
  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / pageSize));
  const paginatedProfiles = useMemo(() => {
    const from = (currentPage - 1) * pageSize;
    return filteredProfiles.slice(from, from + pageSize);
  }, [filteredProfiles, currentPage, pageSize]);

  function handleReset() {
    setSearchQuery("");
    setSelectedSkill("All Skills");
    setSelectedRateType("all");
    setCurrentPage(1);
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
        {/* Search input */}
        <div className="relative w-full">
          <Search
            className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint"
            aria-hidden="true"
          />
          <input
            id="freelance_search"
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search specialists by name, CAD software, tolerance, or part type..."
            className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas pr-10 pl-10 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-muted hover:text-fg"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Rate Type Segmented Chips */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line/60 pt-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted uppercase tracking-wider">Rate:</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "all", label: "All Pricing" },
                { id: "hourly", label: "Hourly (₹/hr)" },
                { id: "fixed", label: "Fixed Milestone" },
              ].map((rate) => {
                const active = selectedRateType === rate.id;
                return (
                  <button
                    key={rate.id}
                    type="button"
                    onClick={() => {
                      setSelectedRateType(rate.id);
                      setCurrentPage(1);
                    }}
                    className={cn(
                      "inline-flex min-h-[44px] items-center rounded-full px-4 py-2 text-xs font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-contrast shadow-sm"
                        : "border border-line bg-canvas text-muted hover:border-line-strong hover:text-fg"
                    )}
                  >
                    {rate.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs text-accent">
            <ShieldCheck className="size-4" />
            <span>Vetted Print-Ready Standard</span>
          </div>
        </div>

        {/* Skill Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line/60 pt-4">
          <span className="font-mono text-xs text-muted uppercase tracking-wider">Skill:</span>
          {POPULAR_SKILLS.map((skill) => {
            const active = selectedSkill === skill;
            return (
              <button
                key={skill}
                type="button"
                onClick={() => {
                  setSelectedSkill(skill);
                  setCurrentPage(1);
                }}
                className={cn(
                  "inline-flex min-h-[44px] items-center rounded-full px-3.5 py-2 text-xs font-medium transition-colors",
                  active
                    ? "border border-accent bg-accent/15 text-accent"
                    : "border border-line bg-canvas text-muted hover:border-line-strong hover:text-fg"
                )}
              >
                {skill}
              </button>
            );
          })}
        </div>
      </div>

      {/* Result Count and Status */}
      <div className="flex items-center justify-between border-b border-line pb-3 text-xs text-muted">
        <span>
          Showing{" "}
          <span className="font-mono font-semibold text-fg">
            {filteredProfiles.length}
          </span>{" "}
          approved {filteredProfiles.length === 1 ? "specialist" : "specialists"}
        </span>
        {(searchQuery || selectedSkill !== "All Skills" || selectedRateType !== "all") && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-accent hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Specialist Cards Grid */}
      {paginatedProfiles.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line p-12 text-center">
          <p className="text-base font-medium text-fg">No specialists match your criteria.</p>
          <p className="mt-1 text-sm text-muted">
            Try broadening your search keywords or resetting the rate and skill filters.
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-line bg-surface px-6 text-sm font-medium text-fg hover:bg-raised"
          >
            Reset all filters
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {paginatedProfiles.map((freelancer) => {
            const initials = freelancer.display_name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <div
                key={freelancer.provider_id}
                className="flex flex-col justify-between rounded-[var(--radius-card)] border border-line bg-surface p-6 transition-all duration-200 hover:-translate-y-1 hover:border-line-strong hover:shadow-xl hover:shadow-black/20"
              >
                <div className="flex flex-col gap-4">
                  {/* Header: Avatar, Name, Verified Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] border border-line bg-canvas font-display text-sm font-semibold text-accent overflow-hidden">
                        {freelancer.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={freelancer.avatar_url}
                            alt={`${freelancer.display_name} profile photo`}
                            className="size-full object-cover"
                          />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-display text-base font-semibold text-fg">
                            {freelancer.display_name}
                          </span>
                          <CheckCircle2
                            className="size-4 text-accent"
                            aria-label="Approved Specialist"
                          />
                        </div>
                        <span className="font-mono text-xs text-muted">Vetted CAD Engineer</span>
                      </div>
                    </div>

                    <TrustBadge type="verified" />
                  </div>

                  {/* Bio */}
                  <p className="line-clamp-3 text-xs leading-relaxed text-muted">
                    {freelancer.bio || "Specialist in parametric CAD design and print-ready engineering."}
                  </p>

                  {/* Rate Chip */}
                  <div className="rounded-[var(--radius-control)] border border-line bg-canvas/60 p-3">
                    <span className="block font-mono text-[0.6875rem] uppercase tracking-wider text-muted">
                      Starting Rate
                    </span>
                    <span className="mt-0.5 font-mono text-sm font-semibold text-accent">
                      ₹{freelancer.base_rate.toLocaleString("en-IN")}{" "}
                      <span className="text-xs font-normal text-muted">
                        {freelancer.rate_type === "hourly" ? "/ hr" : "fixed"}
                      </span>
                    </span>
                  </div>

                  {/* Skills Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {freelancer.skills.slice(0, 4).map((skill) => (
                      <span
                        key={skill}
                        className="rounded border border-line bg-canvas px-2.5 py-1 text-[0.6875rem] font-medium text-muted"
                      >
                        {skill}
                      </span>
                    ))}
                    {freelancer.skills.length > 4 && (
                      <span className="rounded border border-line/60 bg-canvas/50 px-2 py-1 text-[0.6875rem] font-mono text-faint">
                        +{freelancer.skills.length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-6 border-t border-line pt-4">
                  <Link
                    href={`/freelance/${freelancer.provider_id}`}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-surface border border-line px-4 text-xs font-semibold text-fg transition-colors hover:bg-raised hover:border-line-strong hover:text-accent"
                  >
                    <span>View Profile & Hire</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 border-t border-line pt-8">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            className="inline-flex min-h-[44px] items-center rounded-[var(--radius-control)] border border-line bg-surface px-4 text-xs font-medium text-fg hover:bg-raised disabled:opacity-40"
          >
            Previous
          </button>
          <span className="font-mono text-xs text-muted">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            className="inline-flex min-h-[44px] items-center rounded-[var(--radius-control)] border border-line bg-surface px-4 text-xs font-medium text-fg hover:bg-raised disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
