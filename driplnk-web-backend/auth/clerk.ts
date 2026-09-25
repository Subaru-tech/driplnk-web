import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { getSupabaseServerClient, getSupabaseServiceClient, getCurrentUser as getSupabaseUser } from "@/driplnk-web-backend/db/client";
import type { Profile } from "@/lib/types";

export const isClerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

export type UnifiedUser = {
  id: string; // Internal profiles.id (UUID)
  authId: string; // Clerk user_xxx or Supabase auth.users UUID
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  source: "clerk" | "supabase";
};

/**
 * Ensures a Clerk user has a corresponding row in Supabase's `public.profiles`.
 * Returns the Supabase profile row (with its internal UUID and role).
 */
export async function syncClerkProfile(): Promise<Profile | null> {
  if (!isClerkConfigured) return null;

  try {
    const { userId } = await auth();
    if (!userId) return null;

    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    const serviceSupabase = getSupabaseServiceClient();
    const supabase = await getSupabaseServerClient();
    const client = serviceSupabase ?? supabase;
    if (!client) return null;

    const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? null;
    const fullName =
      clerkUser.fullName ||
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      email?.split("@")[0] ||
      "Creator";
    const avatarUrl = clerkUser.imageUrl || null;

    // 1. Try atomic security definer RPC function first with service client
    const { data: rpcProfile, error: rpcError } = await client.rpc("sync_clerk_user_profile", {
      p_clerk_id: userId,
      p_full_name: fullName,
      p_avatar_url: avatarUrl,
      p_email: email,
    });

    if (!rpcError && rpcProfile && rpcProfile.length > 0) {
      return rpcProfile[0] as Profile;
    }

    // 2. Fallback: check if profile already exists for this Clerk ID
    const { data: existing } = await client
      .from("profiles")
      .select("*")
      .eq("clerk_id", userId)
      .maybeSingle();

    if (existing) {
      return existing as Profile;
    }

    // 3. Fallback insert new profile
    const { data: created, error } = await client
      .from("profiles")
      .insert({
        clerk_id: userId,
        full_name: fullName,
        avatar_url: avatarUrl,
        email: email,
        role: "creator",
        credits_balance: 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create Supabase profile for Clerk user:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return null;
    }

    return created as Profile;
  } catch (err) {
    console.error("syncClerkProfile error:", err);
    return null;
  }
}

/**
 * Returns the currently signed-in user across either Clerk or Supabase.
 */
export async function getUnifiedUser(): Promise<UnifiedUser | null> {
  if (isClerkConfigured) {
    try {
      const { userId } = await auth();
      if (userId) {
        const clerkUser = await currentUser();
        if (clerkUser) {
          const profile = await syncClerkProfile();
          return {
            id: profile?.id ?? userId,
            authId: userId,
            email: clerkUser.emailAddresses?.[0]?.emailAddress ?? null,
            name: profile?.full_name ?? clerkUser.fullName ?? null,
            avatarUrl: profile?.avatar_url ?? clerkUser.imageUrl ?? null,
            source: "clerk",
          };
        }
      }
    } catch (err) {
      console.error("Clerk getUnifiedUser error:", err);
    }
  }

  // Fallback to Supabase Auth
  try {
    const sbUser = await getSupabaseUser();
    if (sbUser) {
      return {
        id: sbUser.id,
        authId: sbUser.id,
        email: sbUser.email ?? null,
        name: (sbUser.user_metadata?.full_name as string | undefined) ?? null,
        avatarUrl: (sbUser.user_metadata?.avatar_url as string | undefined) ?? null,
        source: "supabase",
      };
    }
  } catch (err) {
    console.error("Supabase getUnifiedUser error:", err);
  }

  return null;
}
