"use server";

import { getSupabaseServerClient } from "@/driplnk-web-backend/db/client";

/**
 * Server actions for the public forms.
 *
 * These write to real Supabase tables. When the backend isn't connected yet
 * they report that honestly — they never return a fake success. A form that
 * says "you're on the list" while dropping the address on the floor is the
 * same trust problem the spec's no-fabricated-data rule exists to prevent.
 */

export type FormState = { status: "idle" | "success" | "error"; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NOT_CONNECTED =
  "The waitlist isn't connected yet. Email us at hello@driplnk.in and we'll add you by hand.";

export async function joinWaitlist(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const consented = formData.get("consent") === "on";

  if (!EMAIL_RE.test(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }
  if (!consented) {
    return {
      status: "error",
      message: "Please agree to the Privacy Policy and Terms to join the waitlist.",
    };
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { status: "error", message: NOT_CONNECTED };

  const { error } = await supabase.from("waitlist").insert({ email });

  if (error) {
    // 23505 = unique_violation: already signed up, which is a success for them.
    if (error.code === "23505") {
      return { status: "success", message: "You're already on the list." };
    }
    return { status: "error", message: NOT_CONNECTED };
  }

  // Consent evidence — never blocks the waitlist join itself.
  const { logWaitlistConsent } = await import("@/app/consent-actions");
  await logWaitlistConsent(email);

  return { status: "success", message: "You're on the list. We'll be in touch." };
}

export async function submitContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const consented = formData.get("consent") === "on";

  if (!name || name.length > 100) return { status: "error", message: "Please tell us your name." };
  if (!EMAIL_RE.test(email) || email.length > 254) return { status: "error", message: "Enter a valid email address." };
  if (!consented) {
    return {
      status: "error",
      message: "Please agree to the Privacy Policy and Terms so we can reply to you.",
    };
  }
  if (message.length < 10) {
    return { status: "error", message: "Please add a little more detail to your message." };
  }
  if (message.length > 5000) {
    return { status: "error", message: "Message is too long (5000 characters max)." };
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return {
      status: "error",
      message: "The contact form isn't connected yet. Please email hello@driplnk.in directly.",
    };
  }

  const { error } = await supabase.from("contact_messages").insert({ name, email, message });

  if (error) {
    return {
      status: "error",
      message: "Something went wrong sending that. Please email hello@driplnk.in directly.",
    };
  }

  // Consent evidence — never blocks the message itself.
  const { logContactConsent } = await import("@/app/consent-actions");
  await logContactConsent(email);

  return { status: "success", message: "Thanks — we'll get back to you shortly." };
}
