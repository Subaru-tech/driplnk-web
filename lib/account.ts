import "server-only";

import { parseRole, type UserRole } from "@/lib/roles";
import { getSupabaseServerClient } from "@/driplnk-web-backend/db/client";

/**
 * The signed-in account's role, read on the server.
 *
 * Order of trust:
 *   1. `profiles.role` — the only authoritative answer.
 *   2. the JWT's `user_metadata.role` — a mirror the backend trigger keeps in
 *      sync, used only while the schema isn't deployed yet.
 *   3. `creator` — the default an account gets when it was provisioned without
 *      a role.
 *
 * `source` says which one answered, so a caller can decide whether a role
 * mismatch is worth acting on. Bouncing a user between two dashboards on the
 * strength of a guess would be worse than letting them through.
 */
export type AccountRole = {
  role: UserRole;
  source: "profile" | "metadata" | "default";
};

export async function getAccountRole(): Promise<AccountRole | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  const fromProfile = parseRole((data as { role?: string } | null)?.role);
  if (fromProfile) return { role: fromProfile, source: "profile" };

  const fromMetadata = parseRole(auth.user.user_metadata?.role);
  if (fromMetadata) return { role: fromMetadata, source: "metadata" };

  return { role: "creator", source: "default" };
}
