"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileDropzone, UploadProgress, type PickedFile } from "@/components/upload/file-dropzone";
import { attachThumbnail } from "@/components/dashboard/upload-model-button";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import {
  nameFromFilename,
  rowErrorMessage,
  slugify,
  storagePathFor,
  uploadToStorage,
} from "@/lib/uploads";
import { getUploadSession, recordUploadedListing } from "@/driplnk-web-backend/actions/upload";

/**
 * Create a listing from a file in the browser.
 *
 * Saved as a DRAFT, never straight to published: pricing and the storefront
 * copy come after, and a model that went live the instant it finished
 * uploading would be the wrong default for something people pay for.
 */
export function UploadListingButton() {
  const router = useRouter();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [errors, setErrors] = useState<{ title?: string; price?: string; file?: string }>({});
  const [percent, setPercent] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const file = files[0]?.file ?? null;

  function close() {
    abortRef.current?.abort();
    setOpen(false);
    setFiles([]);
    setTitle("");
    setPrice("");
    setErrors({});
    setPercent(0);
    setUploadError(null);
    setUploading(false);
  }

  /* Picking a file fills in the title, because the filename is almost always
     what the seller would have typed. Still editable. */
  function onFilesChange(next: PickedFile[]) {
    setFiles(next);
    if (next[0] && !title.trim()) setTitle(nameFromFilename(next[0].file.name));
  }

  async function submit() {
    const parsedPrice = Number.parseInt(price, 10);
    const nextErrors = {
      title: title.trim().length >= 3 ? undefined : "Give the listing a name (3+ characters).",
      price:
        Number.isFinite(parsedPrice) && parsedPrice >= 0
          ? undefined
          : "Enter a price in whole rupees (0 for free).",
      file: file ? undefined : "Choose a file to sell.",
    };
    setErrors(nextErrors);
    if (nextErrors.title || nextErrors.price || nextErrors.file || !file) return;

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
    setUploadError(null);
    setPercent(0);

    const path = storagePathFor(session.userId, file.name);

    try {
      await uploadToStorage({
        bucket: "model-files",
        path,
        file,
        accessToken: session.accessToken,
        signal: controller.signal,
        onProgress: setPercent,
      });

      const { data: row, error } = await recordUploadedListing({
        title: title.trim(),
        slug: slugify(title) || `listing-${Date.now()}`,
        description: "",
        priceInr: parsedPrice,
        storagePath: path,
        fileBytes: file.size,
      });

      if (error || !row) {
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          await supabase.storage.from("model-files").remove([path]);
        }
        throw new Error(error || "Failed to create listing.");
      }

      if (row.id) {
        void attachThumbnail(session.accessToken, {
          file,
          userId: session.userId,
          table: "listings",
          id: row.id,
        }).then((ok) => ok && router.refresh());
      }

      toast("success", `"${title.trim()}" saved as a draft.`);
      router.refresh();
      close();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
      setUploading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Upload className="size-4" aria-hidden="true" />
        New listing
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="New listing"
        description="Upload the file buyers will get. It saves as a draft — nothing goes live until you publish it."
        className="max-h-[calc(100svh-2rem)] overflow-y-auto"
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              {uploading ? "Cancel" : "Close"}
            </Button>
            <Button onClick={submit} loading={uploading}>
              Save draft
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <FileDropzone files={files} onChange={onFilesChange} disabled={uploading} />
            {errors.file ? (
              <p role="alert" className="text-xs text-danger">
                {errors.file}
              </p>
            ) : null}
          </div>

          <Field label="Listing title" error={errors.title}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={uploading}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <Field label="Price (₹)" error={errors.price} hint="Whole rupees. 0 makes it free.">
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                disabled={uploading}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          {uploading || uploadError ? (
            <UploadProgress
              name={file?.name ?? "file"}
              percent={percent}
              error={uploadError}
            />
          ) : null}
        </div>
      </Modal>
    </>
  );
}
