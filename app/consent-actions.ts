"use server";

import { getSupabaseServerClient } from "@/driplnk-web-backend/db/client";

/**
 * Consent logging — Phase 8.
 *
 * Every explicit consent (signup terms gate, contact form, waitlist, cookie
 * banner) is recorded with WHAT was consented to, WHICH policy version, and
 * WHEN. Failure to log never blocks the user-facing action; consent evidence
 * is important but the primary UX action must not break if this table is cold.
 */

export type ConsentResult = { logged: boolean };

const POLICY_VERSION = "2026-09-13-draft";

type ConsentType =
  | "signup_terms"
  | "contact_form"
  | "waitlist"
  | "cookie_analytics"
  | "cookie_marketing";

async function logConsent(entries: {
  subjectEmail?: string | null;
  consentType: ConsentType;
  granted: boolean;
  context?: Record<string, unknown>;
}[]): Promise<ConsentResult> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { logged: false };

  const rows = entries.map((entry) => ({
    subject_email: entry.subjectEmail ?? null,
    consent_type: entry.consentType,
    granted: entry.granted,
    policy_version: POLICY_VERSION,
    context: entry.context ?? {},
  }));

  const { error } = await supabase.from("consent_records").insert(rows);
  return { logged: !error };
}

/** Called by the signup forms after a successful account creation. */
export async function logSignupConsent(email: string): Promise<ConsentResult> {
  return logConsent([
    { subjectEmail: email, consentType: "signup_terms", granted: true },
  ]);
}

/** Called by the contact form when a message is submitted. */
export async function logContactConsent(email: string): Promise<ConsentResult> {
  return logConsent([
    { subjectEmail: email, consentType: "contact_form", granted: true },
  ]);
}

/** Called by the waitlist form on join. */
export async function logWaitlistConsent(email: string): Promise<ConsentResult> {
  return logConsent([
    { subjectEmail: email, consentType: "waitlist", granted: true },
 ]);
}

/** Called by the cookie banner on any choice (accept all / essential only / custom). */
export async function setCookieConsentAction(choices: {
  analytics: boolean;
  marketing: boolean;
}): Promise<ConsentResult> {
  const entries = [
    { subjectEmail: null, consentType: "cookie_analytics" as const, granted: choices.analytics },
    { subjectEmail: null, consentType: "cookie_marketing" as const, granted: choices.marketing },
  ];
  return logConsent(entries);
}
