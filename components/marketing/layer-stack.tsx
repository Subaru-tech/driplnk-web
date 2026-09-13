import { ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

export type Layer = {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  badge?: string;
  /** Short mono caption under the index, e.g. "DESKTOP". */
  kicker: string;
};

/**
 * Cards that physically stack as you scroll — each one sticks, and the next
 * slides up and comes to rest just below it, leaving the previous card's top
 * edge showing like a seam line.
 *
 * The mechanic is pure `position: sticky` at a per-card offset. No scroll
 * listener, no library, and it degrades to a plain vertical list wherever
 * sticky doesn't apply (which is exactly what we want on a narrow screen, so
 * it's switched off below `lg` rather than fought with).
 *
 * Why this and not a flat grid: the parts of DripLnk genuinely stack — the
 * desktop app, the print network on top of it, the phone app on top of that —
 * and a print is built the same way, one layer bonded to the last. The
 * numbering says LAYER for that reason, not as decoration.
 */
export function LayerStack({ layers }: { layers: Layer[] }) {
  return (
    <div className="flex flex-col gap-6 lg:block lg:gap-0">
      {layers.map((layer, index) => (
        <div
          key={layer.title}
          className="lg:sticky lg:pb-6"
          style={{
            /* Each card rests 2rem lower than the one before, so the stack
               reads as depth instead of a single replaced panel. */
            top: `calc(6rem + ${index * 2}rem)`,
          }}
        >
          <article className="cad-brackets relative flex flex-col gap-8 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-6 md:p-8 lg:min-h-72 lg:flex-row lg:items-center lg:gap-12 lg:shadow-2xl lg:shadow-black/30">
            {/* Index block — big mono numeral, CAD drawing-callout style. */}
            <div className="flex shrink-0 items-baseline gap-4 lg:w-40 lg:flex-col lg:items-start lg:gap-2">
              <span className="font-mono text-3xl leading-none font-medium text-accent tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="font-mono text-xs tracking-widest text-faint uppercase">
                Layer / {layer.kicker}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent-muted text-accent">
                  <layer.icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="font-display text-xl font-semibold text-fg">{layer.title}</h3>
                {layer.badge ? (
                  <span className="rounded-full bg-raised px-2.5 py-1 text-xs font-medium text-muted">
                    {layer.badge}
                  </span>
                ) : null}
              </div>

              <p className="max-w-xl text-base text-pretty text-muted">{layer.description}</p>

              <Link
                href={layer.href}
                className="group inline-flex w-fit items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
              >
                Learn more
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </article>
        </div>
      ))}
    </div>
  );
}
