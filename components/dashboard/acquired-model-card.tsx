"use client";

import { Box, Cpu, Download, ExternalLink, Eye, Printer, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ModelViewer } from "@/components/viewer/model-viewer";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { MODEL_LICENSES, type ModelLicenseType } from "@/lib/marketplace";
import { canPreview } from "@/lib/model-preview";
import type { AcquiredModel } from "@/lib/types";
import { getModelDownloadUrl } from "@/driplnk-web-backend/actions/library";

export function AcquiredModelCard({ model }: { model: AcquiredModel }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);

  const license = MODEL_LICENSES[model.license_type as ModelLicenseType] ?? {
    label: model.license_type,
    badge: model.license_type,
  };

  const previewImage =
    model.preview_image_paths && model.preview_image_paths.length > 0
      ? model.preview_image_paths[0]
      : null;

  const extFromPath = model.file_path?.split(".").pop()?.toUpperCase();
  const formats =
    model.formats && model.formats.length > 0
      ? model.formats
      : extFromPath
      ? [extFromPath]
      : ["STL"];

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await getModelDownloadUrl(model.model_id);
      setDownloading(false);

      if (!res.success || !res.downloadUrl) {
        toast("error", res.error || "Failed to generate download link.");
        return;
      }

      // Open download in a new window/trigger download
      const link = document.createElement("a");
      link.href = res.downloadUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.download = "";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast("success", "Download link resolved. Starting download...");
    } catch {
      setDownloading(false);
      toast("error", "Error connecting to storage server.");
    }
  }

  /* Same-origin streaming proxy — a presigned B2 URL would fail CORS here,
     and would also hand the private file URL to the browser. */
  async function openPreview() {
    setPreviewUrl("pending");
    setPreviewError(null);
    try {
      const res = await fetch(`/api/models/${model.model_id}/preview-url`);
      if (!res.ok) {
        setPreviewError("This file can't be previewed in 3D.");
        return;
      }
      const json = await res.json();
      if (!json?.url) {
        setPreviewError("This file can't be previewed in 3D.");
        return;
      }
      setPreviewFilename(json.filename ?? "");
      setPreviewUrl(json.url);
    } catch {
      setPreviewError("Failed to load 3D preview.");
    }
  }

  const isViewable = canPreview(model.file_path || "model.stl");

  return (
    <>
      <div
        id={`acquired-model-${model.model_id}`}
        className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-md"
      >
        <div className="relative aspect-4/3 overflow-hidden bg-raised">
          {previewImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewImage}
              alt={model.title}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="grid size-full place-items-center">
              <Box className="size-10 text-faint" strokeWidth={1.5} aria-hidden="true" />
            </div>
          )}

          {/* Hover overlay for quick 3D preview */}
          {isViewable && (
            <div className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 lg:flex">
              <button
                type="button"
                onClick={openPreview}
                className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-canvas shadow-lg transition-transform hover:scale-105 cursor-pointer"
              >
                <Eye className="size-3.5" />
                <span>Preview 3D</span>
              </button>
            </div>
          )}

          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-md bg-canvas/80 px-2 py-0.5 text-[11px] font-medium text-fg backdrop-blur-sm border border-line/50">
            <ShieldCheck className="size-3 text-accent" aria-hidden="true" />
            <span>{license.badge}</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between gap-4 p-4">
          <div className="flex flex-col gap-2">
            <div>
              <Link
                href={`/models/${model.model_id}`}
                className="line-clamp-1 text-sm font-semibold text-fg hover:text-accent transition-colors"
                title={model.title}
              >
                {model.title}
              </Link>
              <p className="line-clamp-1 text-xs text-muted mt-0.5">
                by {model.seller_name}
                {model.category ? ` · ${model.category}` : ""}
              </p>
            </div>

            {/* Formats Badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {formats.map((fmt) => (
                <span
                  key={fmt}
                  className="rounded bg-raised border border-line/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-fg"
                >
                  {fmt}
                </span>
              ))}
            </div>

            <p className="text-[11px] text-faint">
              Acquired {formatDate(model.acquired_at)}
            </p>
          </div>

          {/* Engineering Marketplace Action Suite */}
          <div className="flex flex-col gap-2 pt-2 border-t border-line/60">
            <div className="grid grid-cols-2 gap-2">
              <Button
                id={`download-btn-${model.model_id}`}
                size="sm"
                loading={downloading}
                onClick={handleDownload}
                className="justify-center gap-1.5 font-semibold"
              >
                <Download className="size-3.5" aria-hidden="true" />
                Download
              </Button>

              {isViewable ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={openPreview}
                  className="justify-center gap-1.5 text-xs font-semibold cursor-pointer"
                >
                  <Eye className="size-3.5 text-accent" aria-hidden="true" />
                  3D View
                </Button>
              ) : (
                <ButtonLink
                  href={`/mart?model_id=${model.model_id}`}
                  variant="secondary"
                  size="sm"
                  className="justify-center gap-1 text-xs font-medium"
                >
                  <Printer className="size-3.5 text-accent" aria-hidden="true" />
                  <span>Send to Mart</span>
                </ButtonLink>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a
                href={`leaffos://open?model=${model.model_id}`}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-[var(--radius-control)] border border-line bg-surface px-2 text-xs font-medium text-muted transition-colors hover:bg-raised hover:text-accent hover:border-accent/40"
                title="Open geometry in LeaFF OS"
              >
                <Cpu className="size-3.5" aria-hidden="true" />
                <span>Open in LeaFF</span>
              </a>

              {isViewable && (
                <ButtonLink
                  href={`/mart?model_id=${model.model_id}`}
                  variant="ghost"
                  size="sm"
                  className="justify-center gap-1 text-xs font-medium text-muted hover:text-fg"
                  title="Order physical parts via DripLnk Mart"
                >
                  <Printer className="size-3.5 text-accent" aria-hidden="true" />
                  <span>Send to Mart</span>
                </ButtonLink>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3D Inspection Modal */}
      <Modal
        open={previewUrl !== null}
        onClose={() => {
          setPreviewUrl(null);
          setPreviewError(null);
        }}
        title={model.title}
        description={previewError ?? "Interactive 3D view · drag to orbit, scroll to zoom"}
        className="max-w-[800px]"
      >
        {previewError ? (
          <div className="grid aspect-4/3 w-full place-items-center rounded-[var(--radius-card)] border border-line bg-raised text-sm text-danger p-6 text-center">
            {previewError}
          </div>
        ) : previewUrl && previewUrl !== "pending" ? (
          <ModelViewer
            url={previewUrl}
            filename={previewFilename || (model.file_path ?? "model.stl")}
            modelId={model.model_id}
            hasThumbnail={Boolean(previewImage)}
            className="aspect-4/3 w-full"
          />
        ) : (
          <div className="grid aspect-4/3 w-full place-items-center rounded-[var(--radius-card)] border border-line bg-raised">
            <span className="text-sm text-muted">Preparing 3D preview…</span>
          </div>
        )}
      </Modal>
    </>
  );
}
