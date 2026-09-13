"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { getUnifiedUser, isClerkConfigured } from "@/driplnk-web-backend/auth/clerk";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/driplnk-web-backend/db/client";

export type UpdateProfileResult = {
  success: boolean;
  error?: string;
};

/**
 * Updates user full name and avatar across both Supabase profile and identity provider.
 */
export async function updateUserProfile({
  fullName,
  avatarUrl,
}: {
  fullName: string;
  avatarUrl?: string | null;
}): Promise<UpdateProfileResult> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "You must be signed in to update your profile." };
  }

  const serviceSupabase = getSupabaseServiceClient();
  const supabase = await getSupabaseServerClient();
  const client = serviceSupabase ?? supabase;
  if (!client) {
    return { success: false, error: "Database backend is not connected." };
  }

  const trimmedName = fullName.trim();

  if (user.source === "clerk") {
    // 1. Update Supabase profile via the Security Definer RPC with service client
    const { error: rpcErr } = await client.rpc("sync_clerk_user_profile", {
      p_clerk_id: user.authId,
      p_full_name: trimmedName,
      p_avatar_url: avatarUrl ?? user.avatarUrl ?? null,
    });

    if (rpcErr) {
      console.error("Failed to sync updated Clerk profile to Supabase:", rpcErr);
      return { success: false, error: rpcErr.message || "Failed to update profile." };
    }

    // 2. Best-effort update to Clerk user record
    if (isClerkConfigured) {
      try {
        const clerk = await clerkClient();
        const parts = trimmedName.split(" ");
        const firstName = parts[0] || "";
        const lastName = parts.slice(1).join(" ") || "";
        await clerk.users.updateUser(user.authId, {
          firstName,
          lastName,
        });
      } catch (err) {
        console.warn("Clerk updateUser warning (non-fatal):", err);
      }
    }
  } else {
    // Supabase native auth
    const { error } = await client
      .from("profiles")
      .update({
        full_name: trimmedName,
        avatar_url: avatarUrl ?? user.avatarUrl ?? null,
      })
      .eq("id", user.id);

    if (error) {
      console.error("Failed to update Supabase profile:", error);
      return { success: false, error: error.message || "Failed to update profile." };
    }
  }

  revalidatePath("/dashboard/account");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Deletes the account and everything it owns.
 *
 * Runs on the service-role client: RLS would block most of these deletes for
 * a Clerk-authenticated user (no Supabase JWT) and several tables — listings,
 * model_acquisitions, freelance_requests — have no user-facing delete path at
 * all. Every step is best-effort so one orphaned row can't strand the rest;
 * failures are logged, never silent.
 */
export async function deleteUserAccount(): Promise<{ success: boolean; error?: string }> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "You must be signed in to delete your account." };
  }

  const serviceSupabase = getSupabaseServiceClient();
  if (!serviceSupabase) {
    return { success: false, error: "Database backend is not connected." };
  }

  try {
    // 1. Own models (marketplace + uploads) and their storage blobs
    const { data: ownedModels } = await serviceSupabase
      .from("models")
      .select("id, storage_path, file_path, preview_image_paths")
      .or(`owner_id.eq.${user.id},seller_user_id.eq.${user.id}`);

    const modelIds = (ownedModels ?? []).map((m) => m.id);

    const storagePaths = (ownedModels ?? [])
      .flatMap((m) => [m.storage_path, m.file_path, ...(m.preview_image_paths ?? [])])
      .filter((p): p is string => Boolean(p));

    if (storagePaths.length > 0) {
      await serviceSupabase.storage.from("model-files").remove(storagePaths);
    }

    // 2. Acquisitions must go before the models they reference
    const { error: acqErr } = await serviceSupabase
      .from("model_acquisitions")
      .delete()
      .eq("user_id", user.id);
    if (acqErr) console.warn("deleteUserAccount: model_acquisitions:", acqErr.message);

    if (modelIds.length > 0) {
      const { error: modelErr } = await serviceSupabase
        .from("models")
        .delete()
        .in("id", modelIds);
      if (modelErr) console.warn("deleteUserAccount: models:", modelErr.message);
    }

    // 3. Own listings (marketplace drafts) and their files
    const { data: ownListings } = await serviceSupabase
      .from("listings")
      .select("id, file_path")
      .eq("seller_id", user.id);

    const listingPaths = (ownListings ?? [])
      .map((l) => l.file_path)
      .filter((p): p is string => Boolean(p));

    if (listingPaths.length > 0) {
      await serviceSupabase.storage.from("model-files").remove(listingPaths);
      await serviceSupabase.storage
        .from("model-art")
        .remove((ownListings ?? []).map((l) => `${user.id}/listings-${l.id}.png`));
    }

    const { error: listingErr } = await serviceSupabase
      .from("listings")
      .delete()
      .eq("seller_id", user.id);
    if (listingErr) console.warn("deleteUserAccount: listings:", listingErr.message);

    // 4. Freelance footprint: provider row, profile, buyer + freelancer-side
    // requests, and any reference/deliverable files
    const { data: providers } = await serviceSupabase
      .from("providers")
      .select("id, type")
      .eq("user_id", user.id);

    const providerIds = (providers ?? []).map((p) => p.id);

    if (providerIds.length > 0) {
      const { data: deliverables } = await serviceSupabase
        .from("freelance_requests")
        .select("final_file_path")
        .eq("freelancer_provider_id", providerIds[0])
        .not("final_file_path", "is", null);

      const deliverablePaths = (deliverables ?? [])
        .map((d) => d.final_file_path)
        .filter((p): p is string => Boolean(p));
      if (deliverablePaths.length > 0) {
        await serviceSupabase.storage.from("freelance-deliverables").remove(deliverablePaths);
      }

      const { error: fpErr } = await serviceSupabase
        .from("freelancer_profiles")
        .delete()
        .in("provider_id", providerIds);
      if (fpErr) console.warn("deleteUserAccount: freelancer_profiles:", fpErr.message);

      const { error: vpErr } = await serviceSupabase
        .from("vendor_profiles")
        .delete()
        .in("provider_id", providerIds);
      if (vpErr) console.warn("deleteUserAccount: vendor_profiles:", vpErr.message);

      const { error: provErr } = await serviceSupabase
        .from("providers")
        .delete()
        .in("id", providerIds);
      if (provErr) console.warn("deleteUserAccount: providers:", provErr.message);
    }

    const { data: buyerRequests } = await serviceSupabase
      .from("freelance_requests")
      .select("reference_file_paths")
      .eq("buyer_user_id", user.id);

    const referencePaths = (buyerRequests ?? [])
      .flatMap((r) => r.reference_file_paths ?? [])
      .filter((p): p is string => Boolean(p));
    if (referencePaths.length > 0) {
      await serviceSupabase.storage.from("freelance-deliverables").remove(referencePaths);
    }

    const { error: reqErr } = await serviceSupabase
      .from("freelance_requests")
      .delete()
      .eq("buyer_user_id", user.id);
    if (reqErr) console.warn("deleteUserAccount: freelance_requests:", reqErr.message);

    // 5. Mart orders the user placed (quote_requests cascade via FK RESTRICT
    // on orders, so delete orders first, then their quote requests)
    const { data: quoteIds } = await serviceSupabase
      .from("quote_requests")
      .select("id, file_path")
      .eq("user_id", user.id);

    const { error: orderErr } = await serviceSupabase
      .from("mart_orders")
      .delete()
      .eq("buyer_user_id", user.id);
    if (orderErr) console.warn("deleteUserAccount: mart_orders:", orderErr.message);

    if (quoteIds && quoteIds.length > 0) {
      const paths = quoteIds.map((q) => q.file_path).filter((p): p is string => Boolean(p));
      if (paths.length > 0) {
        await serviceSupabase.storage.from("model-files").remove(paths);
      }
      const { error: qrErr } = await serviceSupabase
        .from("quote_requests")
        .delete()
        .in("id", quoteIds.map((q) => q.id));
      if (qrErr) console.warn("deleteUserAccount: quote_requests:", qrErr.message);
    }

    // 6. Legacy library + seller profile
    const { error: libErr } = await serviceSupabase
      .from("library_items")
      .delete()
      .eq("user_id", user.id);
    if (libErr) console.warn("deleteUserAccount: library_items:", libErr.message);

    const { error: spErr } = await serviceSupabase
      .from("seller_profiles")
      .delete()
      .eq("id", user.id);
    if (spErr) console.warn("deleteUserAccount: seller_profiles:", spErr.message);

    // 7. Profile record last — it anchors everything above
    const { error: profileErr } = await serviceSupabase
      .from("profiles")
      .delete()
      .eq("id", user.id);
    if (profileErr) console.warn("deleteUserAccount: profiles:", profileErr.message);

    // 8. Delete the Clerk user if applicable
    if (user.source === "clerk" && isClerkConfigured) {
      try {
        const clerk = await clerkClient();
        await clerk.users.deleteUser(user.authId);
      } catch (err) {
        console.warn("Clerk deleteUser warning:", err);
      }
    }

    return { success: true };
  } catch (err) {
    console.error("deleteUserAccount error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete account.",
    };
  }
}
