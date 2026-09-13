"use client";

import { useState } from "react";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export function GoogleIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export function AuthDivider({ text = "or" }: { text?: string }) {
  return (
    <div className="relative my-2 flex items-center justify-center">
      <div className="w-full border-t border-line" />
      <span className="absolute bg-surface px-3 text-xs font-medium uppercase tracking-wider text-muted">
        {text}
      </span>
    </div>
  );
}

interface GoogleButtonProps {
  onError: (msg: string) => void;
  text?: string;
  disabled?: boolean;
}

function ClerkGoogleButton({
  onError,
  text = "Continue with Google",
  disabled = false,
}: GoogleButtonProps) {
  const clerk = useClerk();
  const { signInStatus } = useSignIn() as { signInStatus?: string };
  const { signUpStatus } = useSignUp() as { signUpStatus?: string };
  const [submitting, setSubmitting] = useState(false);

  async function handleGoogleAuth() {
    setSubmitting(true);
    const isSignUp = text.toLowerCase().includes("sign up");

    const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const redirectParam = searchParams?.get("redirect");
    const redirectUrl = redirectParam && redirectParam.startsWith("/") ? redirectParam : "/dashboard";

    try {
      const client = clerk.client;
      if (isSignUp && client?.signUp) {
        await (client.signUp as unknown as {
          authenticateWithRedirect: (params: {
            strategy: string;
            redirectUrl: string;
            redirectUrlComplete: string;
          }) => Promise<void>;
        }).authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl: "/sso-callback",
          redirectUrlComplete: redirectUrl,
        });
      } else if (client?.signIn) {
        await (client.signIn as unknown as {
          authenticateWithRedirect: (params: {
            strategy: string;
            redirectUrl: string;
            redirectUrlComplete: string;
          }) => Promise<void>;
        }).authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl: "/sso-callback",
          redirectUrlComplete: redirectUrl,
        });
      } else {
        throw new Error("Authentication client is not ready.");
      }
    } catch (err: unknown) {
      setSubmitting(false);
      onError(err instanceof Error ? err.message : "Failed to connect to Google authentication.");
    }
  }

  const isPending = submitting || signInStatus === "fetching" || signUpStatus === "fetching";

  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      loading={isPending}
      disabled={disabled || isPending}
      onClick={handleGoogleAuth}
      className="w-full border-line-control hover:bg-raised"
    >
      <GoogleIcon className="size-4 shrink-0" />
      <span>{text}</span>
    </Button>
  );
}

function SupabaseGoogleButton({
  onError,
  text = "Continue with Google",
  disabled = false,
}: GoogleButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleSupabaseGoogleSignIn() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      onError("Sign-in isn't available yet — the backend isn't connected.");
      return;
    }

    // Carry the ?redirect= param through the OAuth round-trip so the callback
    // can land the user where they were headed (the callback validates it is
    // a same-origin path before honoring it).
    const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const redirectParam = searchParams?.get("redirect");
    const safeRedirect = redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//") ? redirectParam : null;
    const callbackUrl = safeRedirect
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeRedirect)}`
      : `${window.location.origin}/auth/callback`;

    setPending(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      setPending(false);
      onError(error.message || "Failed to initiate Google sign-in.");
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      loading={pending}
      disabled={disabled || pending}
      onClick={handleSupabaseGoogleSignIn}
      className="w-full border-line-control hover:bg-raised"
    >
      <GoogleIcon className="size-4 shrink-0" />
      <span>{text}</span>
    </Button>
  );
}

const isClerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export function GoogleButton(props: GoogleButtonProps) {
  if (isClerkEnabled) {
    return <ClerkGoogleButton {...props} />;
  }
  return <SupabaseGoogleButton {...props} />;
}
