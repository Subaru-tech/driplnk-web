"use client";

import { Check, Download, LogIn, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase";

import { claimFreeListing } from "@/driplnk-web-backend/actions/library";

/**
 * The one thing a visitor does on a model page.
 *
 * Four states, because there are genuinely four situations:
 *   signed out  → send them to log in, don't pretend the button works
 *   owned       → open the library, not a second copy
 *   free        → add it, one click, no checkout
 *   paid        → say plainly that payments aren't live
 *
 * The free path writes a `library_items` row via claimFreeListing server action.
 */
export function AcquirePanel({
  listingId,
  priceInr,
  signedIn,
  owned,
}: {
  listingId: string;
  priceInr: number;
  signedIn: boolean;
  owned: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState(owned);

  const free = priceInr === 0;

  async function claim() {
    if (!signedIn) {
      router.push("/login");
      return;
    }

    setPending(true);
    const res = await claimFreeListing(listingId);
    setPending(false);

    if (!res.success) {
      toast("error", res.error || "Couldn't add that to your library.");
      return;
    }

    setAdded(true);
    toast("success", "Added to your library.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <p className="font-mono text-3xl font-medium text-fg">
        {free ? "Free" : formatCurrency(priceInr)}
      </p>

      <div className="flex flex-col gap-2">
        {added ? (
          <>
            <ButtonLink href="/dashboard/library" size="lg" className="w-full">
              <Check className="size-4" aria-hidden="true" />
              In your library
            </ButtonLink>
            <p className="text-xs text-muted">Open it, download it, or send it to print.</p>
          </>
        ) : !signedIn ? (
          <>
            <ButtonLink href="/login" size="lg" className="w-full">
              <LogIn className="size-4" aria-hidden="true" />
              Log in to get this
            </ButtonLink>
            <p className="text-xs text-muted">
              Models live in your DripLnk library, not in a one-time download link.
            </p>
          </>
        ) : free ? (
          <>
            <Button size="lg" loading={pending} onClick={claim} className="w-full">
              <Download className="size-4" aria-hidden="true" />
              Add to library
            </Button>
            <p className="text-xs text-muted">Free. No payment, no checkout.</p>
          </>
        ) : (
          <>
            <Button size="lg" disabled className="w-full">
              <Download className="size-4" aria-hidden="true" />
              Buy model
            </Button>
            <p className="text-xs text-muted">
              Paid models unlock when checkout goes live. Free models work today.
            </p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <ButtonLink href="/mart" variant="secondary" size="lg" className="w-full">
          <Printer className="size-4" aria-hidden="true" />
          Print with Mart
        </ButtonLink>
        <p className="text-xs text-muted">
          Don&apos;t want the file? Have it printed and shipped instead.
        </p>
      </div>
    </div>
  );
}
