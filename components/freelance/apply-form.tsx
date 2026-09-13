"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Plus,
  Trash2,
  Wrench,
  Link as LinkIcon,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { applyFreelancer } from "@/driplnk-web-backend/actions/freelance";
import type { FreelancerProfile, RateType } from "@/lib/types";
import { cn } from "@/lib/cn";

const SUGGESTED_SKILLS = [
  "SolidWorks",
  "Fusion 360",
  "LeaFF OS",
  "Enclosures & IoT",
  "Snap-fit Geometry",
  "Tolerance ±0.05mm",
  "DfAM & Lightweighting",
  "Topology Optimization",
  "Planetary Gears",
  "Threaded Inserts",
  "Reverse Engineering",
  "ZBrush Sculpting",
];

export function ApplyForm({
  existingProfile,
  initialName,
}: {
  existingProfile?: FreelancerProfile | null;
  initialName?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [displayName, setDisplayName] = useState(
    existingProfile?.display_name || initialName || ""
  );
  const [bio, setBio] = useState(existingProfile?.bio || "");
  const [skills, setSkills] = useState<string[]>(
    existingProfile?.skills?.length ? existingProfile.skills : ["SolidWorks", "Fusion 360"]
  );
  const [newSkill, setNewSkill] = useState("");
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>(
    existingProfile?.portfolio_urls?.length ? existingProfile.portfolio_urls : [""]
  );
  const [rateType, setRateType] = useState<RateType>(existingProfile?.rate_type || "hourly");
  const [baseRate, setBaseRate] = useState<string>(
    existingProfile?.base_rate ? String(existingProfile.base_rate) : "1200"
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function addSkill(skillToAdd: string) {
    const trimmed = skillToAdd.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    setSkills([...skills, trimmed]);
    setNewSkill("");
  }

  function removeSkill(skillToRemove: string) {
    setSkills(skills.filter((s) => s !== skillToRemove));
  }

  function handleAddPortfolioUrl() {
    setPortfolioUrls([...portfolioUrls, ""]);
  }

  function handleUpdatePortfolioUrl(index: number, value: string) {
    const updated = [...portfolioUrls];
    updated[index] = value;
    setPortfolioUrls(updated);
  }

  function handleRemovePortfolioUrl(index: number) {
    const updated = portfolioUrls.filter((_, i) => i !== index);
    setPortfolioUrls(updated.length ? updated : [""]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = displayName.trim();
    if (!cleanName || cleanName.length < 2) {
      setErrorMessage("Please enter a display name with at least 2 characters.");
      return;
    }

    const rateNum = Number(baseRate);
    if (isNaN(rateNum) || rateNum < 0) {
      setErrorMessage("Please enter a valid non-negative base rate.");
      return;
    }

    if (skills.length === 0) {
      setErrorMessage("Please add at least one manufacturing or CAD skill.");
      return;
    }

    const cleanUrls = portfolioUrls.map((u) => u.trim()).filter(Boolean);

    startTransition(async () => {
      const res = await applyFreelancer({
        displayName: cleanName,
        bio: bio.trim() || undefined,
        skills,
        portfolioUrls: cleanUrls,
        rateType,
        baseRate: rateNum,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to register profile. Please try again.");
        return;
      }

      setSuccessMessage(
        existingProfile
          ? "Your specialist profile has been updated!"
          : "Welcome! Your freelancer profile is approved and live on DripLnk."
      );

      setTimeout(() => {
        router.push("/dashboard/freelancer");
        router.refresh();
      }, 1200);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-[var(--radius-control)] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400"
        >
          <AlertCircle className="size-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-[var(--radius-control)] border border-accent/40 bg-accent-muted/20 p-4 text-sm text-accent"
        >
          <CheckCircle2 className="size-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Basic Info Card */}
      <div className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8">
        <div className="border-b border-line pb-4">
          <h2 className="font-display text-lg font-semibold text-fg">Specialist Profile</h2>
          <p className="mt-1 text-sm text-muted">
            This information is shown to creators and engineering teams looking to hire CAD specialists.
          </p>
        </div>

        {/* Display Name */}
        <div className="flex flex-col gap-2">
          <label htmlFor="display_name" className="text-sm font-medium text-fg">
            Display Name <span className="text-accent">*</span>
          </label>
          <input
            id="display_name"
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Arjun Verma"
            className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Bio */}
        <div className="flex flex-col gap-2">
          <label htmlFor="bio" className="text-sm font-medium text-fg">
            Professional Bio & Manufacturing Experience
          </label>
          <textarea
            id="bio"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Describe your design focus, tolerance tolerances achieved, additive manufacturing materials (FDM, SLA, SLS, Metal), and past mechanical projects..."
            className="w-full rounded-[var(--radius-control)] border border-line bg-canvas p-3.5 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Skills Section */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-fg">
            Specialist Skills & CAD Tools <span className="text-accent">*</span>
          </label>

          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-canvas px-4 py-2 text-sm text-fg"
              >
                <span>{skill}</span>
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  className="grid size-6 place-items-center rounded-full text-muted hover:bg-raised hover:text-fg"
                  aria-label={`Remove skill ${skill}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill(newSkill);
                }
              }}
              placeholder="Add custom skill (press Enter)..."
              className="h-11 flex-1 rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              type="button"
              onClick={() => addSkill(newSkill)}
              className="inline-flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-line bg-surface px-4 text-sm font-medium text-fg hover:bg-raised"
            >
              <Plus className="size-4" />
              <span>Add</span>
            </button>
          </div>

          {/* Quick Suggestions */}
          <div className="mt-2 flex flex-col gap-1.5">
            <span className="text-xs text-muted font-mono uppercase tracking-wider">
              Popular skills:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_SKILLS.filter((s) => !skills.includes(s)).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => addSkill(suggestion)}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-line/60 bg-canvas/60 px-3.5 py-2 text-xs text-muted hover:border-line-strong hover:text-fg"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pricing & Rates */}
        <div className="border-t border-line pt-6">
          <h3 className="font-display text-base font-semibold text-fg">Pricing Structure</h3>
          <p className="mt-1 text-xs text-muted">
            Set your standard rate. Final milestone pricing for each request is confirmed directly
            with the buyer before work begins.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* Rate Type */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-fg">Billing Model</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRateType("hourly")}
                  className={cn(
                    "flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-control)] border px-3 text-sm font-medium transition-colors",
                    rateType === "hourly"
                      ? "border-accent bg-accent/15 text-accent font-semibold"
                      : "border-line bg-canvas text-muted hover:text-fg"
                  )}
                >
                  Hourly (₹ / hr)
                </button>
                <button
                  type="button"
                  onClick={() => setRateType("fixed")}
                  className={cn(
                    "flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-control)] border px-3 text-sm font-medium transition-colors",
                    rateType === "fixed"
                      ? "border-accent bg-accent/15 text-accent font-semibold"
                      : "border-line bg-canvas text-muted hover:text-fg"
                  )}
                >
                  Fixed Milestone
                </button>
              </div>
            </div>

            {/* Base Rate Input */}
            <div className="flex flex-col gap-2">
              <label htmlFor="base_rate" className="text-sm font-medium text-fg">
                {rateType === "hourly" ? "Starting Hourly Rate (₹ INR)" : "Starting Project Fee (₹ INR)"}
              </label>
              <div className="relative">
                <span className="absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-sm text-faint">
                  ₹
                </span>
                <input
                  id="base_rate"
                  type="number"
                  min="0"
                  step="50"
                  required
                  value={baseRate}
                  onChange={(e) => setBaseRate(e.target.value)}
                  className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas pr-3 pl-8 text-sm font-mono text-fg focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio URLs */}
        <div className="border-t border-line pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-fg">Portfolio & Model Repositories</h3>
              <p className="mt-1 text-xs text-muted">
                Links to your CAD portfolio, GrabCAD, Onshape public files, or GitHub repository.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddPortfolioUrl}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-control)] border border-line bg-canvas px-3 text-xs font-medium text-fg hover:bg-raised"
            >
              <Plus className="size-3.5" />
              Add Link
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {portfolioUrls.map((url, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => handleUpdatePortfolioUrl(index, e.target.value)}
                    placeholder="https://grabcad.com/your-profile or https://onshape.com/..."
                    className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas pr-3 pl-9 text-sm text-fg placeholder:text-faint focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                {portfolioUrls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemovePortfolioUrl(index)}
                    className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] border border-line bg-canvas text-muted hover:bg-red-500/10 hover:text-red-400"
                    aria-label="Remove link"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Submission CTA */}
      <div className="flex items-center justify-end gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-8 font-display text-sm font-semibold text-accent-contrast shadow-lg shadow-accent/20 transition-all hover:bg-accent/90 disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Saving Profile...</span>
            </>
          ) : (
            <>
              <span>{existingProfile ? "Update Specialist Profile" : "Register as Specialist"}</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
