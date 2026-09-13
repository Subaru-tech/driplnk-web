"use server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

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

  if (!EMAIL_RE.test(email)) {
    return { status: "error", message: "Enter a valid email address." };
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

  return { status: "success", message: "You're on the list. We'll be in touch." };
}

export async function submitContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name) return { status: "error", message: "Please tell us your name." };
  if (!EMAIL_RE.test(email)) return { status: "error", message: "Enter a valid email address." };
  if (message.length < 10) {
    return { status: "error", message: "Please add a little more detail to your message." };
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

  return { status: "success", message: "Thanks — we'll get back to you shortly." };
}
