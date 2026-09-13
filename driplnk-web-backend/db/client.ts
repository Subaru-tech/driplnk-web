import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Server-side Supabase client, bound to the request's cookies so the session
 * survives Server Component renders and Server Actions.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render, where cookies are read-only.
          // `proxy.ts` refreshes the session on every request, so this is safe
          // to ignore.
        }
      },
    },
  });
}

import { createClient } from "@supabase/supabase-js";

let serviceClient: SupabaseClient | null = null;

/**
 * Privileged server-only Supabase client holding the service_role key.
 * Used exclusively by server actions to call locked-down SECURITY DEFINER RPCs
 * after server-side Clerk authentication has already verified the caller.
 */
export function getSupabaseServiceClient(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server.");
    return null;
  }

  serviceClient ??= createClient(SUPABASE_URL, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serviceClient;
}

/**
 * The signed-in user, or null.
 *
 * Uses `getUser()` (which revalidates the JWT with Supabase) rather than
 * `getSession()` — session data read straight off a cookie is not trustworthy
 * for an auth decision.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

