"use client";

import { Box, Download, ExternalLink, Eye, MoreVertical, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ModelViewer } from "@/components/viewer/model-viewer";
import { useToast } from "@/components/ui/toast";
import { formatCredits, formatDate } from "@/lib/format";
import { canPreview } from "@/lib/model-preview";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Model } from "@/lib/types";
import { cn } from "@/lib/cn";

import { deleteUploadedModel } from "@/driplnk-web-backend/actions/upload";

/* Spec §6.2 — thumbnail, name (truncated), created date, credits spent.
   Hover reveals Open in App / Download / Delete. On touch/mobile the same
   three land in a 3-dot menu instead. */

export function ModelCard({ model }: { model: Model }) {
  const router = useRouter();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  async function deleteModel() {
    setDeleting(true);
    const res = await deleteUploadedModel(model.id);
    setDeleting(false);
    setConfirmOpen(false);

    if (!res.success) {
      toast("error", res.error || "Couldn't delete that model. Try again.");
      return;
    }

    toast("success", `"${model.name}" deleted.`);
    router.refresh();
  }

  /* The file lives in a PRIVATE bucket, so the viewer can't be handed a plain
     URL — it gets a short-lived signed one, minted per preview. */
  const viewable = Boolean(model.storage_path && canPreview(model.storage_path));

  async function openPreview() {
    const path = model.storage_path;
    if (!path) return;

    setPreviewError(null);
    setPreviewUrl("pending");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setPreviewError("Preview isn't available — the backend isn't connected.");
      return;
    }

    const { data, error } = await supabase.storage
      .from("model-files")
      .createSignedUrl(path, 300);

    if (error || !data) {
      setPreviewError("Couldn't open that file. It may have been removed.");
      return;
    }
    setPreviewUrl(data.signedUrl);
  }

  const actions = [
    { icon: ExternalLink, label: "Open in App", href: `leaffos://open?model=${model.id}` },
    { icon: Download, label: "Download", href: `leaffos://download?model=${model.id}` },
  ];

  return (
    <>
      <div className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface transition-colors hover:border-line-strong">
        {/* Thumbnail. Falls back to an icon when no render exists yet —
            never a broken image (spec §6.2). */}
        <div className="relative aspect-4/3 overflow-hidden bg-raised">
          {model.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- thumbnails live in Supabase storage at a runtime-configured origin
            <img
              src={model.thumbnail_url}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="grid size-full place-items-center">
              <Box className="size-8 text-faint" strokeWidth={1.5} aria-hidden="true" />
            </div>
          )}

          {/* Hover overlay — pointer devices only. */}
          <div className="pointer-events-none absolute inset-0 hidden items-center justify-center gap-2 bg-black/70 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 lg:flex">
            {viewable ? (
              <button
                type="button"
                onClick={openPreview}
                title="Preview in 3D"
                aria-label={`Preview ${model.name} in 3D`}
                className="grid size-9 place-items-center rounded-[var(--radius-control)] bg-surface text-fg transition-colors hover:bg-raised"
              >
                <Eye className="size-4" aria-hidden="true" />
              </button>
            ) : null}
            {actions.map((action) => (
              <a
                key={action.label}
                href={action.href}
                title={action.label}
                aria-label={`${action.label}: ${model.name}`}
                className="grid size-9 place-items-center rounded-[var(--radius-control)] bg-surface text-fg transition-colors hover:bg-raised"
              >
                <action.icon className="size-4" aria-hidden="true" />
              </a>
            ))}
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              title="Delete"
              aria-label={`Delete ${model.name}`}
              className="grid size-9 place-items-center rounded-[var(--radius-control)] bg-surface text-danger transition-colors hover:bg-danger hover:text-white"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex items-start justify-between gap-2 p-4">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-sm font-medium text-fg" title={model.name}>
              {model.name}
            </p>
            <p className="text-xs text-faint">{formatDate(model.created_at)}</p>
            <p className="font-mono text-xs text-muted">
              {formatCredits(model.credits_spent)} credits
            </p>
          </div>

          {/* 3-dot menu — the touch equivalent of the hover overlay. */}
          <div ref={menuRef} className="relative shrink-0 lg:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`Actions for ${model.name}`}
              className="grid size-8 place-items-center rounded-[var(--radius-control)] text-muted transition-colors hover:bg-raised hover:text-fg"
            >
              <MoreVertical className="size-4" aria-hidden="true" />
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-30 mt-1 w-44 animate-fade-in overflow-hidden rounded-[var(--radius-control)] border border-line bg-surface shadow-xl shadow-black/30"
              >
                {viewable ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      void openPreview();
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-muted transition-colors hover:bg-raised hover:text-fg"
                  >
                    <Eye className="size-4" aria-hidden="true" />
                    Preview in 3D
                  </button>
                ) : null}
                {actions.map((action) => (
                  <a
                    key={action.label}
                    href={action.href}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted transition-colors hover:bg-raised hover:text-fg"
                  >
                    <action.icon className="size-4" aria-hidden="true" />
                    {action.label}
                  </a>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmOpen(true);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-danger transition-colors hover:bg-raised"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Modal
        open={previewUrl !== null}
        onClose={() => {
          setPreviewUrl(null);
          setPreviewError(null);
        }}
        title={model.name}
        description={previewError ?? "Interactive 3D view · drag to orbit, scroll to zoom"}
        className="max-w-[800px]"
      >
        {previewError ? null : previewUrl && previewUrl !== "pending" ? (
          <ModelViewer
            url={previewUrl}
            filename={model.storage_path ?? model.name}
            modelId={model.id}
            hasThumbnail={Boolean(model.thumbnail_url)}
            className="aspect-4/3 w-full"
          />
        ) : (
          <div className="grid aspect-4/3 w-full place-items-center rounded-[var(--radius-card)] border border-line bg-raised">
            <span className="text-sm text-muted">Preparing preview…</span>
          </div>
        )}
      </Modal>

      {/* Spec §6.2 — confirm modal, danger button, and the copy says plainly
          that there is no undo. */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete this model?"
        description={
          <>
            <span className="font-medium text-fg">{model.name}</span> will be permanently deleted,
            along with its files. This cannot be undone.
          </>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={deleteModel}>
              Delete model
            </Button>
          </>
        }
      />
    </>
  );
}

/** Skeleton matching the card's shape — spec §6.2 loading state. */
export function ModelCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface",
        className,
      )}
    >
      <div className="aspect-4/3 animate-skeleton bg-raised" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-4 w-3/4 animate-skeleton rounded bg-raised" />
        <div className="h-3 w-1/2 animate-skeleton rounded bg-raised" />
        <div className="h-3 w-1/3 animate-skeleton rounded bg-raised" />
      </div>
    </div>
  );
}
