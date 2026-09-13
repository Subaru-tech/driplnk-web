import { ArrowRight, Box, Sparkles } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import type { MarketplaceModel } from "@/lib/types";

export function FeaturedModels({ models = [] }: { models?: MarketplaceModel[] }) {
  if (!models || models.length === 0) {
    return null;
  }

  const featured = models.slice(0, 4);

  return (
    <section aria-labelledby="featured-models-heading" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-accent" aria-hidden="true" />
          <h2 id="featured-models-heading" className="font-display text-lg font-semibold text-fg sm:text-xl">
            Featured Models
          </h2>
        </div>
        <a
          href="#all-models"
          className="group flex items-center gap-1 text-xs font-medium text-muted hover:text-fg transition-colors"
        >
          <span>View all</span>
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {featured.map((item) => {
          const isFree = item.price === 0;
          const preview = item.preview_image_paths?.[0] || null;
          const author = item.seller_name || item.seller?.full_name || "DripLnk Creator";
          const formats = item.formats && item.formats.length > 0 ? item.formats : ["STL", "STEP"];

          return (
            <Link
              key={item.id}
              href={`/models/${item.id}`}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface p-3 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-1 hover:border-line-strong hover:shadow-xl hover:shadow-black/25"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-16/10 w-full overflow-hidden rounded-lg bg-raised">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt={item.title}
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="grid size-full place-items-center">
                    <Box className="size-8 text-faint" strokeWidth={1.5} />
                  </div>
                )}

                {/* Category Pill on Image */}
                <div className="absolute top-2 left-2 rounded-md bg-canvas/80 px-2 py-0.5 text-[10px] font-medium text-fg backdrop-blur-sm border border-line/50">
                  {item.category || "Mechanical"}
                </div>

                {/* Formats Strip on Image */}
                <div className="absolute bottom-2 left-2 flex items-center gap-1">
                  {formats.slice(0, 2).map((fmt) => (
                    <span
                      key={fmt}
                      className="rounded bg-canvas/90 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-muted backdrop-blur-sm border border-line/60"
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card Meta */}
              <div className="flex flex-1 flex-col justify-between pt-3">
                <div className="flex flex-col gap-1">
                  <h3 className="line-clamp-1 text-sm font-semibold text-fg group-hover:text-accent transition-colors" title={item.title}>
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-muted line-clamp-1">by {author}</p>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5">
                  <span className="font-mono text-xs font-semibold">
                    {isFree ? (
                      <span className="text-accent font-bold">Free</span>
                    ) : (
                      formatCurrency(item.price)
                    )}
                  </span>
                  <span className="text-[11px] font-medium text-muted group-hover:text-fg">
                    View →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
