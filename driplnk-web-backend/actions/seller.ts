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

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 58) || "studio"
  );
}

/**
 * Opens a storefront for the signed-in account.
 *
 * Written as service-client inserts instead of the `become_seller(text)` RPC:
 * that RPC derives the caller from `auth.uid()`, which is NULL on the service
 * client Clerk users go through — every call failed with "You must be signed
 * in". The server-verified user id (from the Clerk session) replaces it, and
 * the role change is safe here precisely because it is server-side and
 * self-scoped: a client can only ever promote itself to `seller`, the same
 * outcome the RPC enforced via SECURITY DEFINER.
 *
 * Idempotent: re-submitting an existing storefront is a no-op returning the
 * current slug (the RPC had the same behavior).
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

  // 1. Already a seller? Return the existing storefront (idempotent re-submit).
  const { data: existing } = await serviceSupabase
    .from("seller_profiles")
    .select("id, slug")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    return { success: true, slug: existing.slug };
  }

  // 2. Unique studio slug: base from the name, disambiguated with a short
  // random suffix on collision (matches the slug shape the RPC produced).
  const base = slugify(studio);
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: taken } = await serviceSupabase
      .from("seller_profiles")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!taken) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // 3. Insert the storefront (id mirrors profiles.id — 1:1 PK/FK) and promote
  // the profile role. Best-effort ordering: a failure leaves a clean state for
  // retry (no profile row without a role change would half-enable selling).
  const { error: insertErr } = await serviceSupabase
    .from("seller_profiles")
    .insert({ id: user.id, studio_name: studio, slug });

  if (insertErr) {
    console.error("seller_profiles insert failed:", insertErr);
    return { success: false, error: "Couldn't open your storefront. Please try again." };
  }

  const { error: roleErr } = await serviceSupabase
    .from("profiles")
    .update({ role: "seller" })
    .eq("id", user.id)
    .eq("role", "creator"); // never demote an admin

  if (roleErr) {
    console.error("profile role promotion failed:", roleErr);
    // Storefront exists; roll it back so state stays consistent for retry.
    await serviceSupabase.from("seller_profiles").delete().eq("id", user.id);
    return { success: false, error: "Couldn't open your storefront. Please try again." };
  }

  revalidatePath("/seller");
  revalidatePath("/dashboard");

  return { success: true, slug };
}
