"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileDropzone, UploadProgress, type PickedFile } from "@/components/upload/file-dropzone";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { renderThumbnail, renderThumbnailWithPhash } from "@/lib/model-preview";
import { getSupabaseBrowserClient, SUPABASE_URL } from "@/lib/supabase";
import {
  nameFromFilename,
  rowErrorMessage,
  slugify,
  storagePathFor,
  uploadToStorage,
} from "@/lib/uploads";
import {
  getUploadSession,
  recordUploadedModel,
  updateModelThumbnail,
  checkFileDuplicateByHash,
  recordModelHash,
  recordModelPhash,
} from "@/driplnk-web-backend/actions/upload";

/**
 * Upload existing model files from the browser — no desktop app needed.
 *
 * Files go straight to the private `model-files` bucket, then one `models` row
 * per file. If the row insert fails the uploaded object is removed again,
 * because an orphaned blob nothing points at is invisible storage the user
 * still pays for and can never delete from the UI.
 */

type ProgressEntry = { percent: number; error: string | null };

/**
 * Renders a preview image from the file the browser already has, uploads it to
 * the public `model-art` bucket, and points the row at it.
 *
 * Doing this client-side means no server-side mesh rendering: the machine that
 * has the mesh in memory is the one that draws it. Returns false on any
 * failure — every one of them is cosmetic.
 */
export async function attachThumbnail(
  accessToken: string,
  {
    file,
    userId,
    table,
    id,
  }: { file: File; userId: string; table: "models" | "listings"; id: string },
): Promise<boolean> {
  try {
    const blob = await renderThumbnail(file);
    if (!blob) return false;

    if (accessToken) {
      const path = `${userId}/${table}-${id}.png`;
      const thumbFile = new File([blob], `${table}-${id}.png`, { type: "image/png" });
      await uploadToStorage({
        bucket: "model-art",
        path,
        file: thumbFile,
        accessToken,
      });

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/model-art/${path}`;
      const res = await updateModelThumbnail({ id, thumbnailUrl: publicUrl });
      return res.success;
    }

    // No Supabase JWT (Clerk session): a browser-direct art upload would be
    // rejected, so save the rendered PNG as a data URL instead —
    // updateModelThumbnail accepts image data URLs and is owner-checked.
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    if (!dataUrl || dataUrl.length <= 200) return false;
    const res = await updateModelThumbnail({ id, thumbnailUrl: dataUrl });
    return res.success;
  } catch (err) {
    console.warn("attachThumbnail failed:", err);
    return false;
  }
}

export function UploadModelButton({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  const router = useRouter();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [progress, setProgress] = useState<Record<string, ProgressEntry>>({});
  const [uploading, setUploading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  function reset() {
    setFiles([]);
    setProgress({});
    setUploading(false);
    abortRef.current = null;
  }

  function close() {
    abortRef.current?.abort();
    setOpen(false);
    reset();
  }

  async function startUpload() {
    const session = await getUploadSession();
    if (!session) {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        toast("error", "Uploads aren't available yet — the backend isn't connected.");
      } else {
        toast("error", "Your session expired. Log in again.");
        router.push("/login");
      }
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setUploading(true);
    setProgress(Object.fromEntries(files.map((f) => [f.id, { percent: 0, error: null }])));

    let succeeded = 0;

    /* Sequential, not parallel: several 40 MB files at once starves each
       other's bandwidth and makes every progress bar crawl at the same time,
       which reads as a stall. */
    for (const picked of files) {
      let path = storagePathFor(session.userId, picked.file.name);

      try {
        // Compute SHA-256 hash client-side before upload starts
        const arrayBuffer = await picked.file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
        const sha256 = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // Reject exact duplicate files immediately before consuming network/storage
        const dupCheck = await checkFileDuplicateByHash(sha256);
        if (dupCheck.duplicate) {
          throw new Error("This file is already published on Driplnk by another creator.");
        }

        if (session.mode === "server") {
          // Clerk session — no Supabase JWT exists. POST the file to the
          // authenticated API route, which verifies the session server-side
          // and stores it under the caller's own folder. The route owns the
          // object key, so the DB row uses the path it returns.
          const body = new FormData();
          body.append("file", picked.file);
          const res = await fetch("/api/upload/model", {
            method: "POST",
            body,
            signal: controller.signal,
          });
          const result = (await res.json().catch(() => null)) as { success?: boolean; error?: string; storagePath?: string } | null;
          if (!res.ok || !result?.success || !result.storagePath) {
            throw new Error(result?.error || `Upload failed (${res.status}).`);
          }
          path = result.storagePath;
        } else {
          await uploadToStorage({
            bucket: "model-files",
            path,
            file: picked.file,
            accessToken: session.accessToken,
            signal: controller.signal,
            onProgress: (percent) =>
              setProgress((current) => ({ ...current, [picked.id]: { percent, error: null } })),
          });
        }

        const { data: row, error } = await recordUploadedModel({
          name: nameFromFilename(picked.file.name),
          storagePath: path,
        });

        if (error || !row) {
          if (session.mode === "jwt") {
            // Only the JWT path can clean up from the browser — the anon
            // client holds no identity, so its remove() would be rejected.
            const supabase = getSupabaseBrowserClient();
            if (supabase) {
              await supabase.storage.from("model-files").remove([path]);
            }
          }
          throw new Error(error || "Failed to save model to your library.");
        }

        // Record the SHA-256 on the created model row
        await recordModelHash(row.id, sha256).catch(() => {});

        // Asynchronously render thumbnail & compute perceptual hash in background
        void (async () => {
          try {
            const { blob, phash } = await renderThumbnailWithPhash(picked.file);
            if (blob) {
              const reader = new FileReader();
              reader.onload = async () => {
                const dataUrl = reader.result as string;
                if (dataUrl && dataUrl.length > 200) {
                  await updateModelThumbnail({ id: row.id, thumbnailUrl: dataUrl });
                }
              };
              reader.readAsDataURL(blob);
            }
            if (phash) {
              await recordModelPhash(row.id, phash).catch(() => {});
            }
          } catch {
            // Non-fatal: ModelViewer will backfill on first open
          }
        })();

        succeeded += 1;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setProgress((current) => ({
          ...current,
          [picked.id]: {
            percent: current[picked.id]?.percent ?? 0,
            error: error instanceof Error ? error.message : "Upload failed.",
          },
        }));
      }
    }

    setUploading(false);

    if (succeeded > 0) {
      toast("success", `${succeeded} file${succeeded === 1 ? "" : "s"} uploaded.`);
      router.refresh();
    }

    /* Only close when everything landed — a failed row stays on screen with
       its reason rather than vanishing behind a toast. */
    if (succeeded === files.length) {
      setOpen(false);
      reset();
    }
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Upload className="size-4" aria-hidden="true" />
        Upload model
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="Upload a model"
        description="Drop an STL, 3MF, STEP or G-code file straight from your machine. No desktop app needed."
        className="max-h-[calc(100svh-2rem)] overflow-y-auto"
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              {uploading ? "Cancel" : "Close"}
            </Button>
            <Button onClick={startUpload} loading={uploading} disabled={files.length === 0}>
              Upload {files.length > 0 ? files.length : ""}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FileDropzone files={files} onChange={setFiles} multiple disabled={uploading} />

          {Object.keys(progress).length > 0 ? (
            <div className="flex flex-col gap-3">
              {files.map((picked) => {
                const entry = progress[picked.id];
                if (!entry) return null;
                return (
                  <UploadProgress
                    key={picked.id}
                    name={picked.file.name}
                    percent={entry.percent}
                    error={entry.error}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
