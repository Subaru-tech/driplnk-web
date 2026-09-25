import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BackendNotice } from "@/components/dashboard/backend-notice";
import { ListingEditor } from "@/components/seller/listing-editor";
import { getSellerListing } from "@/driplnk-web-backend/db/queries";

export const metadata: Metadata = { title: "Listing" };

export default async function ListingEditorPage({ params }: PageProps<"/seller/listings/[id]">) {
  const { id } = await params;
  const { data: listing, backendReady } = await getSellerListing(id);

  if (!listing) {
    if (!backendReady) {
      return <BackendNotice />;
    }
    notFound();
  }

  return <ListingEditor listing={listing} />;
}
