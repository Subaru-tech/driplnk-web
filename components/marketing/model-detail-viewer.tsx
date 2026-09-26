"use client";

import { Box, Eye, FileCode2, Image as ImageIcon, Maximize2, Minimize2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { ModelViewer } from "@/components/viewer/model-viewer";
import type { ModelFileRecord } from "@/lib/types";

const RENDERABLE_EXTS = new Set(["stl", "obj", "glb", "gltf", "3mf", "ply", "gcode"]);

function ext(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * The primary interactive viewer on the public model detail page.
 *
 * - Renders live interactive 3D WebGL (Three.js) viewport for STL, G-code, OBJ, GLB, 3MF, etc.
 * - Allows switching between 3D viewport and high-res photo gallery renders.
 * - If multiple 3D files exist (e.g. STL mesh vs G-code toolpath), lets the user switch between them.
 * - Supports fullscreen mode for full-screen CAD inspection.
 */
export function ModelDetailViewer({
  title,
  modelId,
  previewImages = [],
  hasThumbnail = true,
  files = [],
}: {
  title: string;
  modelId?: string;
  previewImages?: string[];
  hasThumbnail?: boolean;
  files?: ModelFileRecord[];
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<"3d" | "photos">("3d");

  // Filter 3D renderable files
  const renderableFiles = files.filter((f) => RENDERABLE_EXTS.has(ext(f.filename || "")));
  const [selectedFileId, setSelectedFileId] = useState<string | null>(
    renderableFiles.find((f) => f.is_primary)?.id || renderableFiles[0]?.id || null
  );

  // 3-D preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string>("");
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "ready" | "none">("idle");

  useEffect(() => {
    // No modelId → derived "none" at render; nothing to setState here.
    if (!modelId) return;

    const endpoint = selectedFileId
      ? `/api/models/${modelId}/preview-url?fileId=${encodeURIComponent(selectedFileId)}`
      : `/api/models/${modelId}/preview-url`;

    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.url) {
          setPreviewUrl(json.url);
          setPreviewFilename(json.filename ?? "model.stl");
          setPreviewState("ready");
          setViewMode("3d");
        } else {
          setPreviewState("none");
          if (previewImages.length > 0) {
            setViewMode("photos");
          }
        }
      })
      .catch(() => {
        setPreviewState("none");
        if (previewImages.length > 0) {
          setViewMode("photos");
        }
      });
  }, [modelId, selectedFileId, previewImages.length]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const currentImage = previewImages.length > 0 ? previewImages[selectedIndex] : null;
  // "idle" = fetch still in flight; without a modelId there is no 3D at all.
  const view3DState = modelId ? previewState : "none";
  const has3D = view3DState === "ready" && previewUrl;
  const is3DActive = has3D && viewMode === "3d";

  return (
    <div className="flex flex-col gap-3">
      {/* Top Mode Switcher Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 rounded-xl border border-line bg-surface p-1 shadow-xs">
          {has3D && (
            <button
              type="button"
              onClick={() => setViewMode("3d")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                viewMode === "3d"
                  ? "bg-accent text-canvas shadow-xs font-bold"
                  : "text-muted hover:text-fg hover:bg-raised"
              )}
            >
              <Sparkles className="size-3.5" />
              <span>Interactive 3D</span>
            </button>
          )}

          {previewImages.length > 0 && (
            <button
              type="button"
              onClick={() => setViewMode("photos")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all cursor-pointer",
                viewMode === "photos" || !has3D
                  ? "bg-accent text-canvas shadow-xs font-bold"
                  : "text-muted hover:text-fg hover:bg-raised"
              )}
            >
              <ImageIcon className="size-3.5" />
              <span>Photos ({previewImages.length})</span>
            </button>
          )}
        </div>

        {/* 3D Multi-file switch (e.g. STL vs G-code) */}
        {has3D && viewMode === "3d" && renderableFiles.length > 1 && (
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface/80 p-0.5 text-xs">
            <FileCode2 className="size-3.5 text-accent ml-1.5 mr-0.5" />
            {renderableFiles.map((file) => {
              const fileExt = ext(file.filename).toUpperCase();
              const isSelected = (selectedFileId || renderableFiles[0].id) === file.id;
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => setSelectedFileId(file.id)}
                  title={file.filename}
                  className={cn(
                    "rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold transition-colors cursor-pointer",
                    isSelected
                      ? "bg-raised text-accent border border-accent/30 shadow-xs"
                      : "text-muted hover:text-fg"
                  )}
                >
                  {fileExt || file.format}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main viewport */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-surface to-raised transition-all",
          isFullscreen
            ? "fixed inset-4 z-50 rounded-2xl border-line-strong shadow-2xl bg-canvas"
            : "aspect-4/3 w-full"
        )}
      >
        {is3DActive ? (
          /* ── Real interactive Three.js viewer ── */
          <div className="relative size-full">
            <ModelViewer
              key={previewUrl}
              url={previewUrl!}
              filename={previewFilename}
              modelId={modelId}
              hasThumbnail={hasThumbnail}
              className="size-full rounded-2xl"
            />
            {/* Fullscreen toggle inside 3D viewport */}
            <button
              type="button"
              onClick={() => setIsFullscreen((v) => !v)}
              title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen 3D Studio"}
              className="absolute bottom-3 right-3 z-20 flex size-8 items-center justify-center rounded-lg bg-black/60 text-white/80 hover:text-white backdrop-blur-md border border-white/10 shadow-lg transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
        ) : (
          /* ── Photo Gallery Viewport ── */
          <div className="relative size-full">
            {/* Ambient backlight */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.06),transparent_70%)]" />

            {currentImage ? (
              <div className="relative size-full flex items-center justify-center p-6 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentImage}
                  alt={title}
                  className="max-h-full max-w-full object-contain select-none drop-shadow-2xl"
                />
              </div>
            ) : view3DState !== "none" ? (
              <div className="grid size-full place-items-center">
                <div className="flex flex-col items-center gap-3">
                  <Box className="size-16 text-faint animate-pulse" strokeWidth={1.2} />
                  <p className="text-xs text-muted font-mono">Loading 3D preview…</p>
                </div>
              </div>
            ) : (
              <div className="grid size-full place-items-center">
                <div className="flex flex-col items-center gap-3">
                  <Box className="size-16 text-faint" strokeWidth={1.2} />
                  <p className="text-xs text-muted font-mono">3D Mesh Viewport</p>
                </div>
              </div>
            )}

            {/* Fullscreen toggle for image-mode */}
            <button
              type="button"
              onClick={() => setIsFullscreen((v) => !v)}
              title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen Gallery"}
              className="absolute bottom-3.5 right-3.5 flex size-8 items-center justify-center rounded-lg bg-canvas/85 text-muted hover:text-fg backdrop-blur-md border border-line/70 shadow-lg transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Angle Thumbnails Carousel (visible in photos mode or when multiple photos exist) */}
      {viewMode === "photos" && previewImages.length > 1 && (
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-1">
          {previewImages.map((imgPath, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className={cn(
                "relative size-18 shrink-0 overflow-hidden rounded-xl border bg-raised transition-all cursor-pointer",
                selectedIndex === idx
                  ? "border-accent ring-2 ring-accent/30 scale-105"
                  : "border-line opacity-70 hover:opacity-100 hover:border-line-strong"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgPath} alt={`Angle ${idx + 1}`} className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Helpful footer meta */}
      <div className="text-xs text-muted/80 flex items-center justify-between">
        <span>
          {is3DActive
            ? "Drag to orbit · Scroll to zoom · Right-click to pan · Space/pause to rotate"
            : "High-resolution renders · Original manufacturing files unlock upon acquisition."}
        </span>
        <span className="font-mono text-[11px] text-faint">3D Studio v2.5</span>
      </div>
    </div>
  );
}
