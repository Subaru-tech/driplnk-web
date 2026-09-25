"use client";

import { Box, Heart, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { MODEL_LICENSES, type ModelLicenseType } from "@/lib/marketplace";
import type { MarketplaceModel } from "@/lib/types";
import { toggleModelFavoriteAction } from "@/driplnk-web-backend/actions/library";

export function MarketplaceModelCard({ model }: { model: MarketplaceModel }) {
  const [favorited, setFavorited] = useState(false);

  const license = MODEL_LICENSES[model.license_type as ModelLicenseType] ?? {
    label: model.license_type,
    badge: model.license_type || "Standard",
  };

  const previewImage =
    model.preview_image_paths && model.preview_image_paths.length > 0
      ? model.preview_image_paths[0]
      : null;

  const isFree = model.price === 0;
  const sellerName = model.seller_name || model.seller?.full_name || "DripLnk Creator";
  const displayFormats =
    model.formats && model.formats.length > 0
      ? model.formats
      : ["STL", "STEP", "3MF"];

  async function handleToggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !favorited;
    setFavorited(next);
    try {
      const res = await toggleModelFavoriteAction(model.id);
      if (res.success && typeof res.favorited === "boolean") {
        setFavorited(res.favorited);
      }
    } catch {
      setFavorited(!next);
    }
  }

  return (
    <div
      id={`model-card-${model.id}`}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface transition-all duration-200 hover:-translate-y-1 hover:border-line-strong hover:shadow-xl hover:shadow-black/30"
    >
      {/* 1. WHAT IS THIS: Visual Viewport */}
      <div className="relative aspect-4/3 w-full overflow-hidden bg-raised">
        <Link href={`/models/${model.id}`} className="block size-full" tabIndex={-1}>
          {previewImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewImage}
              alt={model.title}
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid size-full place-items-center bg-gradient-to-br from-raised via-canvas to-surface">
              <Box className="size-12 text-faint group-hover:text-accent/60 transition-colors duration-300" strokeWidth={1.5} aria-hidden="true" />
            </div>
          )}
        </Link>

        {/* Category & License Badges Overlay */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5">
          {model.category && (
            <span className="rounded-md bg-canvas/90 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-accent backdrop-blur-md border border-line/60 shadow-xs">
              {model.category}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-md bg-canvas/90 px-2 py-0.5 text-[10px] font-medium text-fg/90 backdrop-blur-md border border-line/50 shadow-xs">
            <ShieldCheck className="size-3 text-accent" aria-hidden="true" />
            <span>{license.badge}</span>
          </span>
        </div>

        {/* Wishlist / Favorite Button */}
        <button
          type="button"
          onClick={handleToggleFavorite}
          aria-label={favorited ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute top-2.5 right-2.5 flex size-8 items-center justify-center rounded-full bg-canvas/90 text-muted backdrop-blur-md border border-line/70 shadow-xs transition-colors hover:text-rose-400 hover:bg-canvas cursor-pointer"
        >
          <Heart
            className={`size-3.5 transition-transform active:scale-125 ${
              favorited ? "fill-rose-500 text-rose-500" : ""
            }`}
          />
        </button>

        {/* WHAT DO I GET: Formats Floating Tag */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1">
          {displayFormats.slice(0, 3).map((fmt) => (
            <span
              key={fmt}
              className="rounded bg-canvas/90 px-1.5 py-0.5 font-mono text-[9px] font-bold text-fg/80 backdrop-blur-md border border-line/60 shadow-xs"
            >
              {fmt}
            </span>
          ))}
          {displayFormats.length > 3 && (
            <span className="rounded bg-canvas/90 px-1 py-0.5 font-mono text-[9px] text-muted backdrop-blur-md border border-line/60">
              +{displayFormats.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* 2. DETAILS & HIERARCHY */}
      <div className="flex flex-1 flex-col justify-between p-4.5">
        <div className="flex flex-col gap-2">
          {/* Title: What is this? */}
          <Link
            href={`/models/${model.id}`}
            className="line-clamp-1 font-display text-base font-bold text-fg hover:text-accent transition-colors"
            title={model.title}
          >
            {model.title}
          </Link>

          {/* Creator: Who made it? */}
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="grid size-4 shrink-0 place-items-center rounded-full bg-raised font-mono text-[9px] font-bold text-muted border border-line">
              {sellerName.charAt(0).toUpperCase()}
            </span>
            <span className="truncate">by <strong className="font-medium text-fg/90">{sellerName}</strong></span>
          </div>
        </div>

        {/* 4. HOW MUCH & ACTION */}
        <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono font-medium tracking-wider text-muted">
              {isFree ? "Standard Access" : "Purchase Price"}
            </span>
            <span className="font-mono text-lg font-extrabold text-fg">
              {isFree ? (
                <span className="text-emerald-400 font-bold">Free</span>
              ) : (
                formatCurrency(model.price)
              )}
            </span>
          </div>

          <Link
            href={`/models/${model.id}`}
            className="inline-flex min-h-[36px] items-center justify-center rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 text-xs font-semibold text-fg shadow-xs transition-all duration-150 hover:border-accent hover:bg-accent hover:text-accent-contrast group-hover:border-line-strong"
          >
            Inspect Part →
          </Link>
        </div>
      </div>
    </div>
  );
}
