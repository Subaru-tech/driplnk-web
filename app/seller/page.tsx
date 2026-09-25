import { Package, ReceiptIndianRupee } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { BackendNotice } from "@/components/dashboard/backend-notice";
import { StatCard } from "@/components/dashboard/stat-card";
import { ListingRow } from "@/components/seller/listing-row";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getListings,
  getPayouts,
  getPublishedListingCount,
  getSales,
  getSellerEarnings,
  getSellerProfile,
} from "@/driplnk-web-backend/db/queries";

export const metadata: Metadata = { title: "Seller Overview" };

export default async function SellerOverviewPage() {
  const [seller, published, earnings, listings, sales, payouts] = await Promise.all([
    getSellerProfile(),
    getPublishedListingCount(),
    getSellerEarnings(),
    getListings(5),
    getSales(5),
    getPayouts(1),
  ]);

  const pending = payouts.data.find((payout) => payout.state !== "paid");

  return (
    <div className="flex flex-col gap-8">
      {seller.backendReady ? null : <BackendNotice />}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Published Listings"
          value={published.backendReady ? String(published.data) : null}
          action={{ href: "/seller/listings", label: "Manage listings" }}
        />
        <StatCard
          label="Lifetime Earnings"
          value={earnings.backendReady ? formatCurrency(earnings.data) : null}
        />
        <StatCard
          label="Next Payout"
          value={pending ? formatCurrency(pending.amount_inr) : payouts.backendReady ? formatCurrency(0) : null}
          action={{ href: "/seller/payouts", label: "Payout history" }}
        />
      </div>

      {/* Onboarding state: a seller can't be paid until payout details are
          verified with the provider. Said plainly rather than hidden. */}
      {seller.data && seller.data.payout_status !== "verified" ? (
        <Card className="flex flex-col gap-2">
          <CardTitle>Payout details not verified yet</CardTitle>
          <CardDescription>
            Your listings can go live, but nothing can be paid out until your payout account is
            verified. That step opens once the payments backend is connected.
          </CardDescription>
        </Card>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-medium text-fg">Recent Listings</h2>
          {listings.data.length > 0 ? (
            <Link
              href="/seller/listings"
              className="text-sm font-medium text-accent hover:text-accent-hover"
            >
              View all →
            </Link>
          ) : null}
        </div>

        <Card>
          {listings.data.length === 0 ? (
            <EmptyState icon={Package} message="You haven't listed any models yet." />
          ) : (
            <div className="flex flex-col">
              {listings.data.map((listing) => (
                <ListingRow key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-medium text-fg">Recent Sales</h2>

        <Card>
          {sales.data.length === 0 ? (
            <EmptyState icon={ReceiptIndianRupee} message="No sales yet." />
          ) : (
            <div className="flex flex-col">
              {sales.data.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0"
                >
                  <span className="text-sm text-muted">{formatDate(sale.created_at)}</span>
                  <span className="font-mono text-sm text-fg">{formatCurrency(sale.net_inr)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
