"use client";

import { useActionState, useState } from "react";
import { submitContact, type FormState } from "@/app/actions";
import { ConsentCheckbox } from "@/components/marketing/consent-checkbox";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/cn";

const initial: FormState = { status: "idle", message: "" };

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContact, initial);
  const [consented, setConsented] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-6">
      <Field label="Name">
        {({ id, describedBy }) => (
          <Input id={id} name="name" autoComplete="name" required aria-describedby={describedBy} />
        )}
      </Field>

      <Field label="Email">
        {({ id, describedBy }) => (
          <Input
            id={id}
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-describedby={describedBy}
          />
        )}
      </Field>

      <Field label="Message">
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            name="message"
            required
            minLength={10}
            aria-describedby={describedBy}
            placeholder="What can we help with?"
          />
        )}
      </Field>

      <ConsentCheckbox checked={consented} onChange={setConsented} />

      <div className="flex flex-col gap-3">
        <Button type="submit" loading={pending} className="self-start">
          Send message
        </Button>

        {state.status !== "idle" ? (
          <p
            role={state.status === "error" ? "alert" : "status"}
            aria-live="polite"
            className={cn(
              "text-sm",
              state.status === "error" ? "text-danger" : "text-accent",
            )}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
