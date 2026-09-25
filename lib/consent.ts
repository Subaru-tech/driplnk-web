import "server-only";

/**
 * Server-side consent gate.
 *
 * Invariant (Phase 8): non-essential (analytics/marketing) cookies and scripts
 * must be BLOCKED until the user explicitly accepts via the banner. Today no
 * analytics/marketing provider is integrated, so this always returns false —
 * which is exactly the safe default. When a provider is added, wire its
 * loader to consult the consent record (client: hasConsent() from
 * components/marketing/cookie-consent.tsx; server: this file + the
 * consent_records table) before injecting anything.
 */

export type ConsentCategory = "analytics" | "marketing";

export function isNonEssentialCookieAllowed(_category: ConsentCategory): boolean {
  return false;
}

/** Names of any cookies this site is allowed to set today (essential only). */
export const ESSENTIAL_COOKIE_NAMES = [
  "__session", // Clerk session
  "__client_uat", // Clerk auth state
  "sb-*", // Supabase auth cookies (cookieless fallback mode)
  "driplnk-theme", // theme preference (functional)
] as const;
