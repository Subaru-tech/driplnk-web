import { Package } from "lucide-react";
import type { Metadata } from "next";
import { BackendNotice } from "@/components/dashboard/backend-notice";
import { ListingRow } from "@/components/seller/listing-row";
import { UploadListingButton } from "@/components/seller/upload-listing-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getListings } from "@/driplnk-web-backend/db/queries";

export const metadata: Metadata = { title: "My Listings" };

export default async function ListingsPage() {
  const { data: listings, backendReady } = await getListings();

  return (
    <div className="flex flex-col gap-6">
      {backendReady ? null : <BackendNotice />}

      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-semibold text-fg">My Listings</h2>
        <UploadListingButton />
      </div>

      <Card>
        {listings.length === 0 ? (
          <EmptyState
            icon={Package}
            size="lg"
            message="You haven't listed any models yet."
            action={<UploadListingButton />}
          />
        ) : (
          <div className="flex flex-col">
            {listings.map((listing) => (
              <ListingRow key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
