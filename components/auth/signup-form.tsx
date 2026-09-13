"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useSignUp } from "@clerk/nextjs";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import {
  PasswordRequirements,
  passwordIsValid,
} from "@/components/auth/password-requirements";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, PasswordInput } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isClerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function ClerkSignupForm() {
  const { signUp, fetchStatus } = useSignUp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; code?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = acceptedTerms && !pending;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const nextErrors = {
      name: name.trim() ? undefined : "Enter your name.",
      email: EMAIL_RE.test(email) ? undefined : "Enter a valid email address.",
      password: passwordIsValid(password) ? undefined : "Password doesn't meet the requirements.",
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.email || nextErrors.password) return;

    if (!signUp) {
      setFormError("Authentication service is initializing. Please try again.");
      return;
    }

    setPending(true);
    try {
      const { error } = await signUp.password({
        emailAddress: email,
        password: password,
        firstName: name.trim(),
      });

      if (error) {
        setPending(false);
        setFormError(error.message || "Failed to create account.");
        return;
      }

      if (signUp.status === "missing_requirements") {
        await signUp.verifications.sendEmailCode();
        setVerifying(true);
        setPending(false);
        return;
      }

      await signUp.finalize({
        navigate: async ({ decorateUrl }) => {
          const target = decorateUrl ? decorateUrl("/dashboard") : "/dashboard";
          window.location.href = target;
        },
      });
    } catch (err: unknown) {
      setPending(false);
      setFormError(err instanceof Error ? err.message : "Failed to create account.");
    }
  }

  async function onVerifyCode(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!verificationCode.trim()) {
      setErrors((e) => ({ ...e, code: "Enter the code sent to your email." }));
      return;
    }

    if (!signUp) return;
    setPending(true);
    try {
      const { error } = await signUp.verifications.verifyEmailCode({
        code: verificationCode.trim(),
      });

      if (error) {
        setPending(false);
        setFormError(error.message || "Invalid verification code.");
        return;
      }

      await signUp.finalize({
        navigate: async ({ decorateUrl }) => {
          const target = decorateUrl ? decorateUrl("/dashboard") : "/dashboard";
          window.location.href = target;
        },
      });
    } catch (err: unknown) {
      setPending(false);
      setFormError(err instanceof Error ? err.message : "Verification failed.");
    }
  }

  const isSubmitting = pending || fetchStatus === "fetching";

  if (verifying) {
    return (
      <AuthCard
        title="Verify your email"
        subtitle={`We sent a verification code to ${email}. Enter it below to complete registration.`}
        error={formError}
        footer={{ prompt: "Wrong email?", href: "/signup", label: "Start over" }}
      >
        <form onSubmit={onVerifyCode} noValidate className="flex flex-col gap-5">
          <Field label="Verification Code" error={errors.code}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="code"
                type="text"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
            Complete Registration
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start building with DripLnk."
      error={formError}
      footer={{ prompt: "Already have an account?", href: "/login", label: "Log in" }}
    >
      <div className="flex flex-col gap-4">
        <GoogleButton
          onError={(err) => setFormError(err)}
          text="Sign up with Google"
          disabled={isSubmitting}
        />
        <AuthDivider text="or with email" />

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <Field label="Name" error={errors.name}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() =>
                  setErrors((s) => ({ ...s, name: name.trim() ? undefined : "Enter your name." }))
                }
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <Field label="Email" error={errors.email}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() =>
                  setErrors((s) => ({
                    ...s,
                    email: EMAIL_RE.test(email) ? undefined : "Enter a valid email address.",
                  }))
                }
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <div className="flex flex-col gap-3">
            <Field label="Password" error={errors.password}>
              {({ id, describedBy, invalid }) => (
                <PasswordInput
                  id={id}
                  name="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() =>
                    setErrors((s) => ({
                      ...s,
                      password: passwordIsValid(password)
                        ? undefined
                        : "Password doesn't meet the requirements.",
                    }))
                  }
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>
            <PasswordRequirements value={password} />
          </div>

          <Checkbox
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            label={
              <>
                I agree to the{" "}
                <Link href="/terms" className="text-accent hover:text-accent-hover">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-accent hover:text-accent-hover">
                  Privacy Policy
                </Link>
                .
              </>
            }
          />

          <Button type="submit" size="lg" loading={isSubmitting} disabled={!canSubmit} className="w-full">
            Create account
          </Button>
        </form>
      </div>
    </AuthCard>
  );
}

function SupabaseSignupForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [pending, setPending] = useState(false);

  const canSubmit = acceptedTerms && !pending;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const nextErrors = {
      name: name.trim() ? undefined : "Enter your name.",
      email: EMAIL_RE.test(email) ? undefined : "Enter a valid email address.",
      password: passwordIsValid(password) ? undefined : "Password doesn't meet the requirements.",
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.email || nextErrors.password) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFormError("Sign-up isn't available yet — the backend isn't connected.");
      return;
    }

    setPending(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setPending(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    if (!data.session) {
      setConfirmSent(true);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (confirmSent) {
    return (
      <AuthCard
        title="Check your email"
        subtitle={`We sent a confirmation link to ${email}. Open it to finish setting up your account.`}
        footer={{ prompt: "Wrong address?", href: "/signup", label: "Start over" }}
      >
        <p className="text-sm text-muted">
          The link expires in 24 hours. If it doesn&apos;t arrive, check your spam folder.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start building with DripLnk."
      error={formError}
      footer={{ prompt: "Already have an account?", href: "/login", label: "Log in" }}
    >
      <div className="flex flex-col gap-4">
        <GoogleButton
          onError={(err) => setFormError(err)}
          text="Sign up with Google"
          disabled={pending}
        />
        <AuthDivider text="or with email" />

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <Field label="Name" error={errors.name}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() =>
                  setErrors((s) => ({ ...s, name: name.trim() ? undefined : "Enter your name." }))
                }
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <Field label="Email" error={errors.email}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() =>
                  setErrors((s) => ({
                    ...s,
                    email: EMAIL_RE.test(email) ? undefined : "Enter a valid email address.",
                  }))
                }
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <div className="flex flex-col gap-3">
            <Field label="Password" error={errors.password}>
              {({ id, describedBy, invalid }) => (
                <PasswordInput
                  id={id}
                  name="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() =>
                    setErrors((s) => ({
                      ...s,
                      password: passwordIsValid(password)
                        ? undefined
                        : "Password doesn't meet the requirements.",
                    }))
                  }
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>
            <PasswordRequirements value={password} />
          </div>

          <Checkbox
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            label={
              <>
                I agree to the{" "}
                <Link href="/terms" className="text-accent hover:text-accent-hover">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-accent hover:text-accent-hover">
                  Privacy Policy
                </Link>
                .
              </>
            }
          />

          <Button type="submit" size="lg" loading={pending} disabled={!canSubmit} className="w-full">
            Create account
          </Button>
        </form>
      </div>
    </AuthCard>
  );
}

export function SignupForm() {
  if (isClerkEnabled) {
    return <ClerkSignupForm />;
  }
  return <SupabaseSignupForm />;
}
