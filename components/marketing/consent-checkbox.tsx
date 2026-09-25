"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/input";

/**
 * Explicit-consent checkbox (Phase 8).
 *
 * Rules enforced:
 *  - never pre-checked (no defaultChecked anywhere);
 *  - links to the real /privacy and /terms pages;
 *  - required before submit — the server actions independently re-verify
 *    formData.get("consent") === "on", so a crafted request without the
 *    checkbox is rejected server-side too.
 */
export function ConsentCheckbox({
  checked,
  onChange,
  required = true,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
  className?: string;
}) {
  return (
    <Checkbox
      name="consent"
      checked={checked}
      required={required}
      onChange={(e) => onChange(e.target.checked)}
      label={
        <>
          I agree to the{" "}
          <Link href="/privacy" className="text-accent hover:text-accent-hover hover:underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="text-accent hover:text-accent-hover hover:underline">
            Terms
          </Link>
          .{required ? " *" : ""}
        </>
      }
      className={className}
    />
  );
}
