"use server";

import * as actions from "@/driplnk-web-backend/actions/library";

export type { ClaimResult } from "@/driplnk-web-backend/actions/library";

export async function claimFreeListing(listingId: string) {
  return actions.claimFreeListing(listingId);
}
