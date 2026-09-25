"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Printer,
  Sparkles,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export function PartnerPortal() {
  return (
    <div className="flex flex-col gap-12 max-w-5xl mx-auto w-full">
      {/* Overview Intro Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-line bg-surface/50 p-6">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
            Two Supply-Side Tracks
          </span>
          <h2 className="font-display text-xl font-semibold text-fg">
            Choose your partner pathway
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            All applications are directly reviewed by DripLink engineering and operations teams.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center font-mono text-xs text-muted">
          <span className="inline-block size-2 rounded-full bg-emerald-400" />
          <span>Applications Open</span>
        </div>
      </div>

      {/* Dual Pathway Grid */}
      <div className="grid gap-8 md:grid-cols-2 items-stretch">
        {/* Track 1: Specialist */}
        <div className="relative flex flex-col justify-between rounded-2xl border border-line bg-gradient-to-b from-surface to-canvas p-7 sm:p-8 transition-all duration-300 hover:border-line-strong hover:shadow-xl">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-accent">
                01 / CAD SPECIALIST
              </span>
              <span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent">
                <Sparkles className="size-5" />
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="font-display text-2xl font-bold text-fg">
                Become a Specialist
              </h3>
              <p className="text-sm leading-relaxed text-muted">
                Join our curated network of vetted CAD designers, mechanical engineers, and digital sculptors. Work directly with hardware builders and robotics teams.
              </p>
            </div>

            <div className="border-t border-line/60 pt-5">
              <span className="block font-mono text-xs font-semibold uppercase tracking-wider text-fg mb-3">
                Key Benefits
              </span>
              <ul className="flex flex-col gap-2.5 text-xs text-muted">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 shrink-0 text-accent" />
                  <span>Set your own hourly or milestone pricing (INR / USD)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 shrink-0 text-accent" />
                  <span>Escrow-backed milestone contracts with zero chargeback risk</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 shrink-0 text-accent" />
                  <span>Direct pipeline handoff into LeaFF OS & Mart manufacturing</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 shrink-0 text-accent" />
                  <span>Verified CAD Specialist trust badge on public directory</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-line/60 mt-8 flex flex-col gap-3">
            <ButtonLink
              href="/freelance/apply"
              size="lg"
              className="w-full justify-center"
            >
              <span>Become a Specialist</span>
              <ArrowRight className="size-4" />
            </ButtonLink>
            <Link
              href="/freelance"
              className="text-center text-xs text-muted hover:text-fg transition-colors"
            >
              Browse active specialists directory →
            </Link>
          </div>
        </div>

        {/* Track 2: Print Vendor */}
        <div className="relative flex flex-col justify-between rounded-2xl border border-line bg-gradient-to-b from-surface to-canvas p-7 sm:p-8 transition-all duration-300 hover:border-line-strong hover:shadow-xl">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-accent">
                02 / PRINT VENDOR
              </span>
              <span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent">
                <Printer className="size-5" />
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="font-display text-2xl font-bold text-fg">
                Become a Manufacturing Partner
              </h3>
              <p className="text-sm leading-relaxed text-muted">
                Connect your print farm or precision prototyping facility to DripLnk Mart. Receive qualified local and regional manufacturing orders with automated payouts.
              </p>
            </div>

            <div className="border-t border-line/60 pt-5">
              <span className="block font-mono text-xs font-semibold uppercase tracking-wider text-fg mb-3">
                Key Benefits
              </span>
              <ul className="flex flex-col gap-2.5 text-xs text-muted">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 shrink-0 text-accent" />
                  <span>Direct order matching based on your fleet build envelope</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 shrink-0 text-accent" />
                  <span>Verified CAD files (STL, STEP, 3MF) with geometry checks</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 shrink-0 text-accent" />
                  <span>Guaranteed automated bank/UPI payouts on verified delivery</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 shrink-0 text-accent" />
                  <span>Dedicated vendor operations dashboard and dispatch tracking</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-line/60 mt-8 flex flex-col gap-3">
            <ButtonLink
              href="/vendor/apply"
              size="lg"
              variant="secondary"
              className="w-full justify-center"
            >
              <span>Become a Manufacturing Partner</span>
              <ArrowRight className="size-4" />
            </ButtonLink>
            <Link
              href="/mart"
              className="text-center text-xs text-muted hover:text-fg transition-colors"
            >
              Explore DripLnk Mart manufacturing →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
