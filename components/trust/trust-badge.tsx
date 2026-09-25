"use client";

import { ShieldCheck, Sparkles, Clock } from "lucide-react";
import { cn } from "@/lib/cn";

export type TrustBadgeType = "verified" | "featured" | "new";

interface TrustBadgeProps {
  type: TrustBadgeType;
  size?: "sm" | "md";
  showDescription?: boolean;
  className?: string;
}

export function TrustBadge({
  type,
  size = "sm",
  showDescription = false,
  className,
}: TrustBadgeProps) {
  // 1. RECENT / FRESHNESS: Rendered as a distinct small subtle tag, NOT a trust badge
  if (type === "new") {
    if (showDescription) {
      return (
        <div
          className={cn(
            "flex items-start gap-3 rounded-[var(--radius-control)] border border-sky-500/20 bg-sky-500/5 p-3 text-xs",
            className
          )}
        >
          <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-sky-400">
            NEW
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-fg">Recently Approved</span>
            <span className="text-[11px] text-muted">New addition to the specialist network.</span>
          </div>
        </div>
      );
    }

    return (
      <span
        className={cn(
          "inline-flex items-center rounded bg-sky-500/10 border border-sky-500/25 font-mono font-bold uppercase tracking-wider text-sky-400 select-none",
          size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
          className
        )}
        title="Recently approved on the network"
      >
        New
      </span>
    );
  }

  // 2. EDITORIAL DISTINCTION: Featured by DripLink curators
  if (type === "featured") {
    if (showDescription) {
      return (
        <div
          className={cn(
            "flex items-start gap-3 rounded-[var(--radius-control)] border border-purple-500/30 bg-purple-500/10 p-3 text-xs",
            className
          )}
        >
          <Sparkles className="size-4 shrink-0 mt-0.5 text-purple-400" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-purple-300">Featured by DripLnk</span>
            <span className="text-[11px] text-muted">Curated by DripLnk for demonstrated physical precision.</span>
          </div>
        </div>
      );
    }

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 font-mono font-medium tracking-wide text-purple-400 select-none",
          size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
          className
        )}
        title="Curated by DripLnk for demonstrated physical precision"
      >
        <Sparkles className={size === "sm" ? "size-3 text-purple-400" : "size-3.5 text-purple-400"} />
        <span>Featured</span>
      </span>
    );
  }

  // 3. TRUST & APPROVAL: Verified platform-approved badge
  if (showDescription) {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-[var(--radius-control)] border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs",
          className
        )}
      >
        <ShieldCheck className="size-4 shrink-0 mt-0.5 text-emerald-400" />
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-emerald-300">Verified Partner</span>
          <span className="text-[11px] text-muted">Platform-approved identity and inspected equipment.</span>
        </div>
      </div>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 font-mono font-semibold tracking-wide text-emerald-400 select-none",
        size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        className
      )}
      title="Platform-approved identity & verified capabilities"
    >
      <ShieldCheck className={size === "sm" ? "size-3.5 text-emerald-400" : "size-4 text-emerald-400"} />
      <span>Verified</span>
    </span>
  );
}
