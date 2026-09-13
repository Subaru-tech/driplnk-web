import {
  ArrowLeft,
  Box,
  Calendar,
  Cpu,
  Download,
  FileCode2,
  Layers,
  Printer,
  ShieldCheck,
  Star,
  User,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeaffOsBridgeButton } from "@/components/marketing/leaff-os-bridge-button";
import { MarketplaceModelCard } from "@/components/marketing/marketplace-model-card";
import { ModelAcquirePanel } from "@/components/marketing/model-acquire-panel";
import { ModelDetailViewer } from "@/components/marketing/model-detail-viewer";
import { Section } from "@/components/marketing/section";
import { Card, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import {
  MODEL_LICENSES,
  type ModelLicenseType,
} from "@/lib/marketplace";
import {
  getMarketplaceModelById,
  getMarketplaceModels,
  getPublicListing,
  getUnifiedUser,
  isModelAcquired,
} from "@/driplnk-web-backend";

import { ModelFavoriteButton } from "@/components/marketing/model-favorite-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { data: model } = await getMarketplaceModelById(id);

  if (model) {
    return {
      title: `${model.title} — 3D Model | DripLnk`,
      description:
        model.description?.slice(0, 160) ??
        `3D Model by ${model.seller_name || "DripLnk Creator"} on DripLnk. Discover, acquire, and open directly in LeaFF OS.`,
    };
  }

  const { data: listing } = await getPublicListing(id);
  if (listing) {
    return {
      title: `${listing.title} — 3D Model | DripLnk`,
      description: listing.description?.slice(0, 160) ?? "3D Model on DripLnk.",
    };
  }

  return { title: "Model Not Found — DripLnk" };
}

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 1. Fetch model from models table
  const { data: model } = await getMarketplaceModelById(id);

  // 2. Fallback for legacy listings if accessed by slug/id
  if (!model) {
    const { data: listing } = await getPublicListing(id);
    if (!listing) notFound();
    return renderListingFallback(listing);
  }

  const [user, owned, relatedResult] = await Promise.all([
    getUnifiedUser(),
    isModelAcquired(model.id),
    getMarketplaceModels({
      category: model.category ?? undefined,
      pageSize: 4,
    }),
  ]);

  const license = MODEL_LICENSES[model.license_type as ModelLicenseType] ?? {
    label: model.license_type,
    badge: model.license_type,
    summary: "Standard 3D printing license.",
  };

  const isFree = model.price === 0;
  const sellerName = model.seller_name || model.seller?.full_name || "DripLnk Creator";
  const previewImages = model.preview_image_paths || [];

  // Filter out current model from related items
  const relatedModels = relatedResult.data.models.filter((m) => m.id !== model.id).slice(0, 3);

  return (
    <Section>
      <div className="flex flex-col gap-10">
        {/* Navigation Breadcrumb & Favorite Button */}
        <div className="flex items-center justify-between gap-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted min-w-0">
            <Link
              href="/models"
              className="inline-flex items-center gap-1 hover:text-fg transition-colors shrink-0"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Models</span>
            </Link>
            <span>/</span>
            {model.category ? (
              <>
                <Link
                  href={`/models?category=${encodeURIComponent(model.category)}`}
                  className="hover:text-fg transition-colors shrink-0"
                >
                  {model.category}
                </Link>
                <span>/</span>
              </>
            ) : null}
            <span className="text-fg font-medium truncate">{model.title}</span>
          </nav>

          <ModelFavoriteButton modelId={model.id} />
        </div>

        {/* Primary Stage: 3D Viewer on Left, Model Info & Ecosystem Buy Box on Right */}
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] items-start">
          {/* 3D Model Viewer & Viewport */}
          <div className="flex flex-col gap-4">
            <ModelDetailViewer title={model.title} previewImages={previewImages} />
          </div>

          {/* Model Meta & Actions Box */}
          <div className="flex flex-col gap-6">
            {/* Header info */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                {model.category && (
                  <span className="rounded-full bg-raised px-2.5 py-0.5 text-xs font-medium text-fg border border-line">
                    {model.category}
                  </span>
                )}
                <span className="rounded-full bg-accent-muted px-2.5 py-0.5 text-xs font-semibold text-accent border border-accent/20">
                  {license.badge}
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-fg text-balance">
                {model.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                <span className="flex items-center gap-1.5 font-medium text-fg">
                  <User className="size-3.5 text-faint" />
                  <span>by {sellerName}</span>
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3.5 text-faint" />
                  <span>Added {formatDate(model.created_at)}</span>
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1 rounded bg-raised px-2 py-0.5 font-mono text-[11px] text-fg border border-line">
                  Verified CAD Kit ✓
                </span>
              </div>

              {/* Supported CAD Formats */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted">CAD Formats:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(model.formats && model.formats.length > 0 ? model.formats : ["STL", "STEP", "3MF"]).map((fmt) => (
                    <span
                      key={fmt}
                      className="rounded bg-surface px-2.5 py-0.5 font-mono text-[11px] font-semibold text-fg border border-line"
                    >
                      {fmt} ✓
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Acquisition Box */}
            <ModelAcquirePanel
              modelId={model.id}
              price={model.price}
              signedIn={Boolean(user)}
              owned={owned}
            />

            {/* Strategic LeaFF OS Ecosystem Bridge */}
            <div className="flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Cpu className="size-5 text-accent" />
                  <span className="font-display text-sm font-semibold text-fg">
                    LeaFF OS Workflow
                  </span>
                </div>
                <span className="rounded-full bg-accent-muted px-2 py-0.5 text-[10px] font-bold text-accent">
                  Ecosystem
                </span>
              </div>

              <p className="text-xs text-muted leading-relaxed">
                Open this model directly inside LeaFF OS to customize parametric geometry, adjust tolerances, or slice directly for 3D printing.
              </p>

              <LeaffOsBridgeButton modelId={model.id} modelTitle={model.title} />
            </div>

            {/* Licensing Assurance */}
            <div className="flex gap-3 rounded-xl border border-line bg-surface p-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold text-fg">{license.label}</p>
                <p className="text-xs text-muted leading-relaxed">{license.summary}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Tabs & Specifications Grid */}
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Left Column: Description & Specifications */}
          <div className="flex flex-col gap-6">
            <Card className="flex flex-col gap-4">
              <CardTitle>About this model</CardTitle>
              <div className="text-sm leading-relaxed whitespace-pre-line text-muted">
                {model.description ||
                  "Precision-engineered 3D CAD model designed with tight mechanical tolerances. Ready for slicing, functional prototyping, or direct manufacturing."}
              </div>
            </Card>

            {/* Print & Technical Specifications */}
            <Card className="flex flex-col gap-4">
              <CardTitle>Recommended Print & Fabrication Settings</CardTitle>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 pt-2 text-xs">
                <div className="flex flex-col gap-1 rounded-lg border border-line bg-raised/40 p-3">
                  <span className="text-faint font-medium">Recommended Material</span>
                  <span className="font-semibold text-fg">PLA / PETG / ABS</span>
                </div>
                <div className="flex flex-col gap-1 rounded-lg border border-line bg-raised/40 p-3">
                  <span className="text-faint font-medium">Layer Height</span>
                  <span className="font-semibold text-fg">0.16mm - 0.20mm</span>
                </div>
                <div className="flex flex-col gap-1 rounded-lg border border-line bg-raised/40 p-3">
                  <span className="text-faint font-medium">Infill Density</span>
                  <span className="font-semibold text-fg">25% Gyroid / Grid</span>
                </div>
                <div className="flex flex-col gap-1 rounded-lg border border-line bg-raised/40 p-3">
                  <span className="text-faint font-medium">Supports Required</span>
                  <span className="font-semibold text-fg">Minimal / Tree</span>
                </div>
                <div className="flex flex-col gap-1 rounded-lg border border-line bg-raised/40 p-3">
                  <span className="text-faint font-medium">Wall Perimeters</span>
                  <span className="font-semibold text-fg">3 - 4 Perimeters</span>
                </div>
                <div className="flex flex-col gap-1 rounded-lg border border-line bg-raised/40 p-3">
                  <span className="text-faint font-medium">CAD Kernel Compatibility</span>
                  <span className="font-semibold text-fg">LeaFF OS / STEP B-Rep</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Files Checklist & Mart Bridge */}
          <div className="flex flex-col gap-6">
            <Card className="flex flex-col gap-4">
              <CardTitle>Files Included in Package ({model.files?.length || 3})</CardTitle>
              <ul className="flex flex-col gap-3 text-xs">
                {model.files && model.files.length > 0 ? (
                  model.files.map((f) => (
                    <li key={f.id} className="flex items-center justify-between rounded-lg border border-line bg-raised/40 p-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCode2 className="size-4 text-accent shrink-0" />
                        <div className="min-w-0">
                          <span className="font-semibold text-fg truncate block">{f.filename}</span>
                          <p className="text-[11px] text-faint">
                            {f.format} CAD {f.file_size ? `· ${(f.file_size / (1024 * 1024)).toFixed(1)} MB` : ""}
                          </p>
                        </div>
                      </div>
                      <span className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent font-bold shrink-0">
                        {f.is_primary ? "Primary" : "Included"}
                      </span>
                    </li>
                  ))
                ) : (
                  <>
                    <li className="flex items-center justify-between rounded-lg border border-line bg-raised/40 p-2.5">
                      <div className="flex items-center gap-2">
                        <FileCode2 className="size-4 text-accent" />
                        <div>
                          <span className="font-semibold text-fg">High-Poly Mesh (.STL)</span>
                          <p className="text-[11px] text-faint">Standard manufacturing slicer format</p>
                        </div>
                      </div>
                      <span className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent font-bold">
                        Included
                      </span>
                    </li>

                    <li className="flex items-center justify-between rounded-lg border border-line bg-raised/40 p-2.5">
                      <div className="flex items-center gap-2">
                        <Box className="size-4 text-accent" />
                        <div>
                          <span className="font-semibold text-fg">Parametric Solid (.STEP)</span>
                          <p className="text-[11px] text-faint">Editable B-Rep geometry for LeaFF OS</p>
                        </div>
                      </div>
                      <span className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent font-bold">
                        Included
                      </span>
                    </li>

                    <li className="flex items-center justify-between rounded-lg border border-line bg-raised/40 p-2.5">
                      <div className="flex items-center gap-2">
                        <Layers className="size-4 text-accent" />
                        <div>
                          <span className="font-semibold text-fg">Slicer Project (.3MF)</span>
                          <p className="text-[11px] text-faint">Pre-configured print orientation & supports</p>
                        </div>
                      </div>
                      <span className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent font-bold">
                        Included
                      </span>
                    </li>
                  </>
                )}
              </ul>
            </Card>

            {/* Mart Manufacturing Quote Bridge */}
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
              <div className="flex items-center gap-2 text-fg font-semibold text-sm">
                <Printer className="size-4 text-accent" />
                <span>Want this model manufactured for you?</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Send this CAD model directly to DripLnk Mart for instant vendor quoting across SLA, FDM, SLS, or CNC machining with doorstep shipping across India.
              </p>
              <Link
                href={`/mart?modelId=${model.id}`}
                className="inline-flex items-center justify-center rounded-lg bg-accent py-2 text-xs font-semibold text-accent-contrast hover:bg-accent/90 transition-colors"
              >
                Configure Print in Mart →
              </Link>
            </div>
          </div>
        </div>

        {/* Related Models Section */}
        {relatedModels.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-line/60 pt-8">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-fg">
                Related {model.category || "3D"} Models
              </h2>
              <Link
                href={model.category ? `/models?category=${encodeURIComponent(model.category)}` : "/models"}
                className="text-xs text-accent hover:underline font-medium"
              >
                Browse category →
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedModels.map((m) => (
                <MarketplaceModelCard key={m.id} model={m} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

// Fallback renderer for legacy listings if visited
function renderListingFallback(listing: {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  price_inr: number;
  thumbnail_url: string | null;
  license: string;
  seller: { studio_name: string } | null;
}) {
  return (
    <Section>
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-3xl font-semibold text-fg">{listing.title}</h1>
        <p className="text-muted">{listing.description}</p>
        <div className="pt-4">
          <Link href="/models" className="text-accent hover:underline text-sm">
            ← Back to Models Marketplace
          </Link>
        </div>
      </div>
    </Section>
  );
}
