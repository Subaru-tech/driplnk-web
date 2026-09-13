import "server-only";

import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { getSupabaseServiceClient } from "@/driplnk-web-backend/db/client";

/**
 * Server-side admin gate for admin-only server actions.
 *
 * Reads the caller's role from `profiles` inside the server action, then hands
 * back the service-role client for privileged writes. The role check and the
 * privileged client are inseparable — there is no way to get one without the
 * other, so no caller can reach the service client unverified.
 */
export async function ensureAdmin(): Promise<
  { ok: true; client: NonNullable<ReturnType<typeof getSupabaseServiceClient>>; userId: string } | { ok: false; error: string }
> {
  const user = await getUnifiedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to perform this action." };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, error: "Database backend is not connected." };
  }

  const { data: profile, error } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Admin role check failed:", error);
    return { ok: false, error: "Could not verify your permissions. Try again." };
  }

  if (profile?.role !== "admin") {
    return { ok: false, error: "Unauthorized: Admin privileges required." };
  }

  return { ok: true, client, userId: user.id };
}
