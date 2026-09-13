"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { getSupabaseServiceClient } from "@/driplnk-web-backend/db/client";

export type BecomeSellerResult = {
  success: boolean;
  error?: string;
  slug?: string;
};

/**
 * Opens a storefront for the signed-in account.
 *
 * `become_seller` is a SECURITY DEFINER RPC (the role column is immutable from
 * a client session, and the `seller_profiles` policies require you to already
 * be a seller). It was previously called from the browser with the anon key,
 * which stopped working when the RPC lockdown revoked `authenticated` EXECUTE.
 * The call now happens here, on the server, through the service-role client —
 * the same trust boundary every other privileged write already uses.
 */
export async function becomeSeller(studioName: string): Promise<BecomeSellerResult> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "You must be signed in to open a storefront." };
  }

  const serviceSupabase = getSupabaseServiceClient();
  if (!serviceSupabase) {
    return { success: false, error: "Database backend is not connected." };
  }

  const studio = studioName?.trim();
  if (!studio || studio.length < 2) {
    return { success: false, error: "Enter the name buyers will see." };
  }

  const { data, error } = await serviceSupabase.rpc("become_seller", {
    studio,
  });

  if (error) {
    console.error("become_seller error:", error);
    return {
      success: false,
      error:
        error.message ||
        "Couldn't open your storefront. If the backend was just deployed, try again shortly.",
    };
  }

  revalidatePath("/seller");
  revalidatePath("/dashboard");

  const slug =
    typeof data === "object" && data !== null && "slug" in data
      ? String((data as { slug: unknown }).slug)
      : undefined;

  return { success: true, slug };
}
