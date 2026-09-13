import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { BackendNotice } from "@/components/dashboard/backend-notice";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { formatCurrency, formatDate } from "@/lib/format";
import { getPayouts, getSellerProfile } from "@/lib/queries";
import type { PayoutState } from "@/lib/types";

export const metadata: Metadata = { title: "Payouts" };

const tones: Record<PayoutState, StatusTone> = {
  scheduled: "neutral",
  processing: "info",
  paid: "accent",
  failed: "danger",
};

export default async function PayoutsPage() {
  const [{ data: seller }, { data: payouts, backendReady }] = await Promise.all([
    getSellerProfile(),
    getPayouts(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {backendReady ? null : <BackendNotice />}

      <Card className="flex flex-col gap-2">
        <CardTitle>Payout account</CardTitle>
        <CardDescription>
          {seller
            ? `Status: ${seller.payout_status}. Bank details are held by the payment provider — DripLnk never stores them.`
            : "Bank details are held by the payment provider — DripLnk never stores them."}
        </CardDescription>
      </Card>

      <Card>
        {payouts.length === 0 ? (
          <EmptyState icon={Wallet} size="lg" message="No payouts yet." />
        ) : (
          <div className="flex flex-col">
            {payouts.map((payout) => (
              <div
                key={payout.id}
                className="flex flex-wrap items-center gap-4 border-b border-line py-3 last:border-b-0"
              >
                <span className="min-w-0 flex-1 text-sm text-muted">
                  {formatDate(payout.created_at)}
                </span>
                <StatusPill tone={tones[payout.state]}>{payout.state}</StatusPill>
                <span className="font-mono text-sm text-fg">
                  {formatCurrency(payout.amount_inr)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
