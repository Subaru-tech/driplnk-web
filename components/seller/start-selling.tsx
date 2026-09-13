"use client";

import { Check, Store } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ROLES } from "@/lib/roles";
import { becomeSeller } from "@/driplnk-web-backend/actions/seller";

/**
 * Opening a storefront — the thing that used to be a checkbox at signup.
 *
 * One field, because that's genuinely all the database needs: a studio name,
 * which becomes the storefront slug. Everything else about selling is decided
 * per listing.
 *
 * The write goes through the `becomeSeller` server action rather than a direct
 * browser RPC: the role column is immutable from a client session and the
 * `seller_profiles` policy requires you to already be a seller. The server
 * action verifies the session and completes the privileged call.
 */
export function StartSelling() {
  const [studioName, setStudioName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (studioName.trim().length < 2) {
      setFieldError("Enter the name buyers will see.");
      return;
    }
    setFieldError(undefined);

    setPending(true);
    const res = await becomeSeller(studioName.trim());
    setPending(false);

    if (!res.success) {
      setError(res.error || "Couldn't open your storefront. Try again.");
      return;
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-8">
      <div className="flex flex-col gap-3">
        <span className="grid size-10 place-items-center rounded-[var(--radius-control)] border border-line-control text-accent">
          <Store className="size-5" aria-hidden="true" />
        </span>
        <h2 className="font-display text-2xl font-semibold text-fg">Start selling</h2>
        <p className="text-sm text-muted">
          Open a storefront on the Mart. Your account stays the same — this adds the seller side
          to it, and you keep everything you already have.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {ROLES.seller.capabilities.map((capability) => (
          <li key={capability} className="flex items-start gap-2 text-sm text-muted">
            <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            {capability}
          </li>
        ))}
      </ul>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field
          label="Studio name"
          error={fieldError}
          hint="Shown on every listing you publish. It becomes your storefront address."
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="studio-name"
              autoComplete="organization"
              value={studioName}
              onChange={(event) => setStudioName(event.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
              placeholder="Atharva Designs"
            />
          )}
        </Field>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" loading={pending}>
          Open my storefront
        </Button>
      </form>
    </div>
  );
}
