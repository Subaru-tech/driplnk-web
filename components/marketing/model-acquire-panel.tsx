"use client";

import { Check, Cpu, Download, Lock, LogIn, Printer, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import { claimFreeModel, getModelDownloadUrl } from "@/driplnk-web-backend/actions/library";

export function ModelAcquirePanel({
  modelId,
  price,
  signedIn,
  owned,
}: {
  modelId: string;
  price: number;
  signedIn: boolean;
  owned: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [acquired, setAcquired] = useState(owned);

  const isFree = price === 0;

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await getModelDownloadUrl(modelId);
      setDownloading(false);

      if (!res.success || !res.downloadUrl) {
        toast("error", res.error || "Failed to generate download link.");
        return;
      }

      const link = document.createElement("a");
      link.href = res.downloadUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.download = "";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast("success", "Download link resolved. Starting download...");
    } catch {
      setDownloading(false);
      toast("error", "Error connecting to storage server.");
    }
  }

  async function handleClaim() {
    if (!signedIn) {
      router.push(`/login?redirect=/models/${modelId}`);
      return;
    }

    setPending(true);
    try {
      const res = await claimFreeModel(modelId);
      setPending(false);

      if (!res.success) {
        toast("error", res.error || "Failed to claim model.");
        return;
      }

      setAcquired(true);
      toast("success", res.message || "Model added to your library!");
      router.refresh();
    } catch {
      setPending(false);
      toast("error", "An unexpected error occurred while claiming.");
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-sm">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Price</span>
          <p className="font-mono text-3xl font-semibold text-fg">
            {isFree ? (
              <span className="text-accent">Free</span>
            ) : (
              formatCurrency(price)
            )}
          </p>
        </div>
        {isFree ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2.5 py-1 text-xs font-medium text-accent">
            <Sparkles className="size-3" aria-hidden="true" />
            Claimable
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-raised px-2.5 py-1 text-xs font-medium text-muted border border-line">
            <Lock className="size-3" aria-hidden="true" />
            Paid Model
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {/* State 1: Paid model -> show price, disabled 'Buy — coming soon' button */}
        {!isFree ? (
          <>
            <Button
              id="buy-coming-soon-btn"
              size="lg"
              disabled
              className="w-full justify-center cursor-not-allowed opacity-60"
            >
              <Lock className="size-4" aria-hidden="true" />
              Buy — coming soon
            </Button>
            <p className="text-center text-xs text-muted">
              Paid purchases will unlock when the Razorpay payment gateway goes live.
            </p>
          </>
        ) : acquired ? (
          /* State 2: Free model, already acquired -> Direct Download, LeaFF OS, Mart, Library */
          <>
            <Button
              id="direct-download-btn"
              size="lg"
              loading={downloading}
              onClick={handleDownload}
              className="w-full justify-center gap-2 bg-accent text-accent-contrast font-bold hover:bg-accent-hover"
            >
              <Download className="size-4" aria-hidden="true" />
              Download Model
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <a
                href={`leaffos://open?model=${modelId}`}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-xs font-medium text-fg hover:border-accent hover:text-accent transition-colors"
                title="Open geometry in LeaFF OS"
              >
                <Cpu className="size-3.5" aria-hidden="true" />
                <span>Open in LeaFF</span>
              </a>

              <ButtonLink
                href={`/mart?model_id=${modelId}`}
                variant="secondary"
                size="sm"
                className="justify-center gap-1.5 text-xs font-medium"
                title="Send geometry to DripLnk Mart for fabrication"
              >
                <Printer className="size-3.5 text-accent" aria-hidden="true" />
                <span>Send to Mart</span>
              </ButtonLink>
            </div>

            <ButtonLink
              href="/dashboard/library"
              id="in-library-btn"
              variant="secondary"
              size="sm"
              className="w-full justify-center gap-1.5 text-xs text-muted"
            >
              <Check className="size-3.5 text-accent" aria-hidden="true" />
              Saved in My Library
            </ButtonLink>
            <p className="text-center text-xs text-muted">
              You own this model. Download verified geometry or manufacture directly.
            </p>
          </>
        ) : !signedIn ? (
          /* State 3: Free model, not logged in -> 'Log in to claim' */
          <>
            <ButtonLink
              href={`/login?redirect=/models/${modelId}`}
              id="login-to-claim-btn"
              size="lg"
              className="w-full justify-center"
            >
              <LogIn className="size-4" aria-hidden="true" />
              Log in to claim
            </ButtonLink>
            <p className="text-center text-xs text-muted">
              Free models are saved permanently to your personal library account.
            </p>
          </>
        ) : (
          /* State 4: Free model, logged in, not acquired -> working 'Claim' button */
          <>
            <Button
              id="claim-model-btn"
              size="lg"
              loading={pending}
              onClick={handleClaim}
              className="w-full justify-center"
            >
              <Download className="size-4" aria-hidden="true" />
              Claim Model
            </Button>
            <p className="text-center text-xs text-muted">
              Free claim · Instant library access · Zero checkout required
            </p>
          </>
        )}
      </div>

      <div className="border-t border-line/60 pt-4">
        <Link
          href="/mart"
          className="flex items-center justify-between text-xs text-muted hover:text-fg transition-colors"
        >
          <span>Need a physical print shipped instead?</span>
          <span className="font-medium text-accent hover:underline">Get a Mart quote →</span>
        </Link>
      </div>
    </div>
  );
}
