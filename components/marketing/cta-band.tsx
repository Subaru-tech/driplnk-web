import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";

/**
 * Shared CTA band — spec §3.1.6, reused at the bottom of every product page
 * (§3.2.5).
 *
 * Previously used WaitlistForm (pre-launch email capture). Signups are now
 * live via Clerk, so the homepage instance drives to /sign-up instead.
 */
export function CtaBand({
  title = "Start building today",
  description = "DripLnk is live. Create an account and go from idea to printed part — no CAD experience needed.",
  /** Drop the panel background so a glow behind it can show through. */
  bare = false,
}: {
  title?: string;
  description?: string;
  bare?: boolean;
}) {
  return (
    <section className={bare ? "border-t border-line" : "border-y border-line bg-surface"}>
      <Reveal className="mx-auto flex max-w-content flex-col items-center gap-6 px-6 py-16 text-center md:py-24 lg:px-12">
        <h2 className="font-display text-xl font-semibold text-balance text-fg">{title}</h2>
        <p className="max-w-xl text-base text-muted">{description}</p>
        <ButtonLink href="/sign-up" size="lg">
          Sign Up — it&apos;s free
        </ButtonLink>
      </Reveal>
    </section>
  );
}
