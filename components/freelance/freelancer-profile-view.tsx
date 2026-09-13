"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Briefcase,
  Layers,
  Sparkles,
  ArrowRight,
  UserCheck,
} from "lucide-react";
import { HireModal } from "@/components/freelance/hire-modal";
import type { FreelancerProfile } from "@/lib/types";

export function FreelancerProfileView({
  profile,
  currentUserId,
  isSelf,
  isLoggedIn,
}: {
  profile: FreelancerProfile;
  currentUserId?: string | null;
  isSelf: boolean;
  isLoggedIn: boolean;
}) {
  const [isHireModalOpen, setIsHireModalOpen] = useState(false);

  const initials = profile.display_name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col gap-10">
      {/* Header Section */}
      <div className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="grid size-20 shrink-0 place-items-center rounded-[var(--radius-card)] border border-line bg-canvas font-display text-2xl font-bold text-accent overflow-hidden">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="size-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold text-fg sm:text-3xl">
                  {profile.display_name}
                </h1>
                <CheckCircle2 className="size-5 text-accent" aria-label="Approved Specialist" />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs text-muted">Vetted CAD Engineer</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2.5 py-0.5 font-mono text-xs font-medium text-accent">
                  <ShieldCheck className="size-3.5" />
                  Print-Ready Standard
                </span>
              </div>
            </div>
          </div>

          {/* Rate and CTA Container */}
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="rounded-[var(--radius-control)] border border-line bg-canvas/80 px-4 py-2.5 text-left sm:text-right">
              <span className="block font-mono text-[0.6875rem] uppercase tracking-wider text-muted">
                Starting Rate
              </span>
              <span className="font-mono text-xl font-bold text-accent">
                ₹{profile.base_rate.toLocaleString("en-IN")}{" "}
                <span className="text-xs font-normal text-muted">
                  {profile.rate_type === "hourly" ? "/ hr" : "fixed"}
                </span>
              </span>
            </div>

            {/* Hire CTA Button with Guards */}
            <div>
              {!isLoggedIn ? (
                <Link
                  href={`/login?redirect=/freelance/${profile.provider_id}`}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-6 font-display text-sm font-semibold text-accent-contrast shadow-lg shadow-accent/20 transition-all hover:bg-accent/90"
                >
                  <span>Log in to hire</span>
                  <ArrowRight className="size-4" />
                </Link>
              ) : isSelf ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-[var(--radius-control)] border border-line bg-canvas px-3 py-2 text-xs font-mono text-muted">
                    This is your public profile
                  </span>
                  <Link
                    href="/freelance/apply"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-line bg-surface px-4 text-xs font-medium text-fg hover:bg-raised"
                  >
                    Edit Profile
                  </Link>
                </div>
              ) : (
                <button
                  type="button"
                  id="hire_specialist_btn"
                  onClick={() => setIsHireModalOpen(true)}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-8 font-display text-sm font-semibold text-accent-contrast shadow-lg shadow-accent/20 transition-all hover:bg-accent/90"
                >
                  <Briefcase className="size-4" />
                  <span>Hire {profile.display_name.split(" ")[0]}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Bio & Experience left, Skills & Portfolio right */}
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Bio Card */}
          <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8">
            <h2 className="font-display text-lg font-semibold text-fg">Design Background & Capabilities</h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-sm leading-relaxed text-pretty text-muted whitespace-pre-line">
                {profile.bio ||
                  "This specialist has been vetted for physical manufacturing tolerances, parametric CAD accuracy, and functional 3D printing."}
              </p>
            </div>
          </div>

          {/* The Guarantee Callout */}
          <div className="flex items-start gap-4 rounded-[var(--radius-card)] border border-accent/30 bg-accent-muted/10 p-6">
            <ShieldCheck className="size-6 shrink-0 text-accent mt-0.5" />
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-sm font-semibold text-fg">
                Guaranteed Print Tolerance & Assembly Fit
              </h3>
              <p className="text-xs leading-relaxed text-muted">
                All models delivered through DripLnk are evaluated for overhangs, wall thickness,
                and mechanical tolerances. Files can be directly exported or transferred to Mart
                for 3D print fulfillment.
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar: Skills & Portfolio */}
        <div className="flex flex-col gap-6">
          {/* Skills Card */}
          <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-6">
            <h3 className="font-display text-sm font-semibold text-fg">Specialist Skills</h3>
            <div className="flex flex-wrap gap-2">
              {profile.skills.length > 0 ? (
                profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex min-h-[32px] items-center rounded border border-line bg-canvas px-3 py-1 text-xs font-medium text-fg"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted">General CAD & 3D Modeling</span>
              )}
            </div>
          </div>

          {/* Portfolio Links Card */}
          <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-6">
            <h3 className="font-display text-sm font-semibold text-fg">Portfolio Repositories</h3>
            {profile.portfolio_urls && profile.portfolio_urls.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {profile.portfolio_urls.map((url, idx) => (
                  <li key={idx}>
                    <a
                      href={url.startsWith("http") ? url : `https://${url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[44px] items-center justify-between rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 py-2 text-xs font-medium text-fg transition-colors hover:border-line-strong hover:text-accent"
                    >
                      <span className="truncate max-w-[200px]">{url.replace(/^https?:\/\//, "")}</span>
                      <ExternalLink className="size-3.5 shrink-0 text-muted" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">No external portfolio links provided.</p>
            )}
          </div>
        </div>
      </div>

      {/* Hire Modal Component */}
      {currentUserId && (
        <HireModal
          freelancer={profile}
          currentUserId={currentUserId}
          isOpen={isHireModalOpen}
          onClose={() => setIsHireModalOpen(false)}
        />
      )}
    </div>
  );
}
