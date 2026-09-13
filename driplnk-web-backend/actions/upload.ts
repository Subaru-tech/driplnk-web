"use server";

import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/driplnk-web-backend/db/client";
import { deleteB2Object } from "@/lib/b2-client";

export type UploadSession = {
  userId: string;
  /** Empty when mode is "server" — the browser holds no credential then. */
  accessToken: string;
  mode: UploadSessionMode;
};

/**
 * Returns upload credentials for the currently signed-in user
 * (whether authenticated via Clerk or Supabase Auth).
 *
 * `mode: "jwt"` — the browser uploads straight to Storage with a real
 * Supabase JWT; RLS enforces the per-user folder. `mode: "server"` — no JWT
 * exists (Clerk session), so the browser must POST the file to
 * /api/upload/model, which verifies the Clerk session server-side. The anon
 * key is deliberately never returned as an "access token": it is a public
 * routing constant, not a credential, and handing it out as one let uploads
 * masquerade as authorized when the only thing gating them was a storage
 * policy helper with no caller-identity check.
 */
export type UploadSessionMode = "jwt" | "server";

export async function getUploadSession(): Promise<UploadSession | null> {
  const user = await getUnifiedUser();
  if (!user) return null;

  const supabase = await getSupabaseServerClient();
  if (supabase) {
    try {
      const { data: authData } = await supabase.auth.getSession();
      if (authData.session?.access_token) {
        return {
          userId: user.id,
          accessToken: authData.session.access_token,
          mode: "jwt",
        };
      }
    } catch {
      // Ignore session lookup errors
    }
  }

  return {
    userId: user.id,
    accessToken: "",
    mode: "server",
  };
}

/**
 * Records an uploaded model in the database linked to the verified user.
 *
 * Writes through the service-role client: Clerk-authenticated users hold no
 * Supabase JWT, so RLS on `models` would reject the insert even though the
 * user has already been verified server-side by getUnifiedUser().
 */
export async function recordUploadedModel({
  name,
  storagePath,
  thumbnailUrl,
}: {
  name: string;
  storagePath: string;
  thumbnailUrl?: string | null;
}): Promise<{ data?: { id: string }; error?: string }> {
  const user = await getUnifiedUser();
  if (!user) {
    return { error: "You must be signed in to upload a model." };
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { error: "Backend database is not connected." };
  }

  // The storage path must stay inside the caller's own folder — storage RLS
  // is keyed on the first path segment being the uploader's user id.
  if (!storagePath.startsWith(`${user.id}/`) || storagePath.includes("..")) {
    return { error: "Invalid storage path." };
  }

  const cleanName = (name ?? "").trim().slice(0, 200) || "Untitled Model";

  const { data, error } = await supabase
    .from("models")
    .insert({
      owner_id: user.id,
      name: cleanName,
      storage_path: storagePath,
      file_path: storagePath,
      storage_provider: "backblaze-b2",
      thumbnail_url: thumbnailUrl || null,
      credits_spent: 0,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to record model row:", error);
    return { error: error.message };
  }

  return { data };
}

export type CreatorModelFileInput = {
  filename: string;
  storagePath: string;
  format: string;
  fileSize?: number;
  isPrimary?: boolean;
};

export type CreatorModelInput = {
  id?: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  tags?: string[];
  price: number;
  licenseType: string;
  dimensions?: { x?: number; y?: number; z?: number };
  materials?: string[];
  printInfo?: {
    layerHeight?: string;
    infill?: string;
    supports?: string;
    printTime?: string;
    assemblyNotes?: string;
  };
  filePath?: string;
  files?: CreatorModelFileInput[];
  previewImagePaths?: string[];
  thumbnailUrl?: string | null;
  status?: "published" | "under_review" | "pending_review" | "draft" | "rejected";
};

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
}

export async function publishCreatorModelListing(
  input: CreatorModelInput
): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "You must be signed in to submit or publish a model." };
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { success: false, error: "Backend database is not connected." };
  }

  // Input validation — these land in public pages and URLs.
  const cleanTitle = (input.title ?? "").trim().slice(0, 120);
  if (!cleanTitle) {
    return { success: false, error: "A model title is required." };
  }
  const cleanDescription = (input.description ?? "").trim().slice(0, 5000);
  const cleanCategory = (input.category ?? "").trim().slice(0, 80);
  const cleanPrice = Number.isFinite(Number(input.price)) ? Math.max(0, Math.min(Number(input.price), 10_000_000)) : 0;
  const cleanPreviewPaths = Array.isArray(input.previewImagePaths)
    ? input.previewImagePaths.filter((p): p is string => typeof p === "string" && p.length > 0 && p.length <= 500).slice(0, 12)
    : [];
  const cleanFiles = Array.isArray(input.files)
    ? input.files
        .filter((f) => f && typeof f.filename === "string" && typeof f.storagePath === "string")
        .map((f) => ({
          ...f,
          filename: f.filename.slice(0, 255),
          storagePath: f.storagePath.slice(0, 500),
          format: String(f.format ?? "stl").slice(0, 10),
          fileSize: Number.isFinite(Number(f.fileSize)) ? Number(f.fileSize) : 0,
        }))
        .slice(0, 25)
    : [];

  // 1. Resolve category_id if possible
  let categoryId: string | null = null;
  if (cleanCategory) {
    const catSlug = slugify(cleanCategory);
    const { data: catData } = await supabase
      .from("categories")
      .select("id")
      .or(`slug.eq.${catSlug},name.ilike.%${cleanCategory}%`)
      .limit(1)
      .maybeSingle();
    if (catData?.id) {
      categoryId = catData.id;
    }
  }

  // 2. Resolve license_id if possible
  let licenseId: string | null = null;
  if (input.licenseType) {
    const licSlug = slugify(input.licenseType);
    const { data: licData } = await supabase
      .from("licenses")
      .select("id")
      .or(`slug.eq.${licSlug},name.ilike.%${input.licenseType}%`)
      .limit(1)
      .maybeSingle();
    if (licData?.id) {
      licenseId = licData.id;
    }
  }

  const baseSlug = slugify(input.title || "untitled-model");
  const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;
  // Mandatory moderation gate: submissions from creators must go through
  // review. 'in_review' was written here historically, but the models status
  // CHECK constraint (migration 20260912000000) only accepts 'draft',
  // 'pending_review', 'published', 'rejected', 'archived' — so every
  // non-draft submission was failing with a constraint violation. Use
  // 'pending_review'; creators can never publish directly.
  const finalStatus = input.status === "draft" ? "draft" : "pending_review";
  const primaryFilePath = input.filePath || cleanFiles[0]?.storagePath || "models/placeholder.stl";

  // Check if updating existing draft
  if (input.id) {
    const { data: existing } = await supabase
      .from("models")
      .select("id, owner_id")
      .eq("id", input.id)
      .maybeSingle();

    if (existing && existing.owner_id === user.id) {
      const { error: updateErr } = await supabase
        .from("models")
        .update({
          name: cleanTitle,
          title: cleanTitle,
          description: cleanDescription,
          category: cleanCategory,
          category_id: categoryId,
          license_type: input.licenseType || "standard",
          license_id: licenseId,
          price: cleanPrice,
          preview_image_paths: cleanPreviewPaths,
          thumbnail_url: input.thumbnailUrl || (cleanPreviewPaths[0] ?? null),
          storage_path: primaryFilePath,
          file_path: primaryFilePath,
          storage_provider: "backblaze-b2",
          status: finalStatus,
          published_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id)
        .eq("owner_id", user.id);


      if (updateErr) {
        console.error("Failed to update model:", updateErr);
        return { success: false, error: updateErr.message };
      }

      await syncModelChildren(supabase, input.id, user.id, { ...input, title: cleanTitle, description: cleanDescription, category: cleanCategory, price: cleanPrice, files: cleanFiles, previewImagePaths: cleanPreviewPaths });
      return { success: true, data: { id: input.id } };
    }
  }

  // Insert new model
  const { data, error } = await supabase
    .from("models")
    .insert({
      owner_id: user.id,
      seller_user_id: user.id,
      name: cleanTitle,
      title: cleanTitle,
      slug: uniqueSlug,
      description: cleanDescription,
      category: cleanCategory,
      category_id: categoryId,
      license_type: input.licenseType || "standard",
      license_id: licenseId,
      price: cleanPrice,
      currency: "INR",
      preview_image_paths: cleanPreviewPaths,
      thumbnail_url: input.thumbnailUrl || (cleanPreviewPaths[0] ?? null),
      storage_path: primaryFilePath,
      file_path: primaryFilePath,
      storage_provider: "backblaze-b2",
      status: finalStatus,
      published_at: null,
      credits_spent: 0,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to insert creator model:", error);
    return { success: false, error: error?.message || "Failed to create model record" };
  }

  await syncModelChildren(supabase, data.id, user.id, { ...input, title: cleanTitle, description: cleanDescription, category: cleanCategory, price: cleanPrice, files: cleanFiles, previewImagePaths: cleanPreviewPaths });
  return { success: true, data: { id: data.id } };
}

/**
 * Saves a partial model upload as a draft.
 * Allows creators to pause their work and resume later.
 */
export async function saveModelDraft(
  input: Partial<CreatorModelInput>
): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  return publishCreatorModelListing({
    title: input.title || "Untitled Draft",
    description: input.description || "",
    category: input.category || "Mechanical",
    subcategory: input.subcategory,
    tags: input.tags,
    price: input.price || 0,
    licenseType: input.licenseType || "standard",
    dimensions: input.dimensions,
    materials: input.materials,
    printInfo: input.printInfo,
    filePath: input.filePath,
    files: input.files,
    previewImagePaths: input.previewImagePaths,
    thumbnailUrl: input.thumbnailUrl,
    status: "draft",
    id: input.id,
  });
}

/**
 * Synchronizes model files, preview images, tags, and initial version for a model.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncModelChildren(supabase: any, modelId: string, userId: string, input: CreatorModelInput) {
  try {
    // 1. Model Files
    if (input.files && input.files.length > 0) {
      // Remove old file records for this model
      await supabase.from("model_files").delete().eq("model_id", modelId);

      const fileRows = input.files.map((f, idx) => ({
        model_id: modelId,
        filename: f.filename,
        storage_path: f.storagePath,
        format: f.format.toUpperCase(),
        file_size: f.fileSize || 0,
        is_primary: f.isPrimary ?? (idx === 0),
        is_downloadable: true,
      }));

      await supabase.from("model_files").insert(fileRows);
    }

    // 2. Model Images
    if (input.previewImagePaths && input.previewImagePaths.length > 0) {
      await supabase.from("model_images").delete().eq("model_id", modelId);

      const imageRows = input.previewImagePaths.map((path, idx) => ({
        model_id: modelId,
        storage_path: path,
        sort_order: idx,
        is_cover: idx === 0,
      }));

      await supabase.from("model_images").insert(imageRows);
    }

    // 3. Normalized Tags
    if (input.tags && input.tags.length > 0) {
      for (const rawTag of input.tags) {
        const tagName = rawTag.trim().toLowerCase();
        if (!tagName) continue;
        const tagSlug = slugify(tagName);

        // Upsert tag
        const { data: tagRecord } = await supabase
          .from("tags")
          .upsert({ name: tagName, slug: tagSlug }, { onConflict: "slug" })
          .select("id")
          .single();

        if (tagRecord?.id) {
          await supabase
            .from("model_tags")
            .upsert({ model_id: modelId, tag_id: tagRecord.id }, { onConflict: "model_id,tag_id" });
        }
      }
    }

    // 4. Initial Model Version if none exists
    const { data: versions } = await supabase
      .from("model_versions")
      .select("id")
      .eq("model_id", modelId)
      .limit(1);

    if (!versions || versions.length === 0) {
      await supabase.from("model_versions").insert({
        model_id: modelId,
        version_number: "1.0.0",
        changelog: "Initial submission",
        created_by: userId,
        is_current: true,
      });
    }

    // 5. Record model event
    let eventType = "draft_saved";
    if (input.status === "published") {
      eventType = "published";
    } else if (input.status === "pending_review" || input.status === "under_review") {
      eventType = "submitted_for_review";
    }

    await supabase.from("model_events").insert({
      model_id: modelId,
      user_id: userId,
      event_type: eventType,
      metadata: {
        title: input.title,
        status: input.status,
        file_count: input.files?.length ?? 1,
      },
    });
  } catch (err) {
    console.error("Failed to sync model children:", err);
  }
}

/**
 * Updates an existing model's thumbnail URL.
 */
export async function updateModelThumbnail({
  id,
  thumbnailUrl,
}: {
  id: string;
  thumbnailUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { success: false, error: "Backend database not connected." };
  }

  // thumbnail_url is rendered as <img src> on public pages. Constrain it to
  // https URLs and same-origin data: PNGs (the wizard uploads base64 data
  // URLs) so stored-XSS via javascript:/data:text/html is impossible.
  const isHttpsUrl = /^https:\/\/[\w.-]+(:\d+)?(\/[^\s]*)?$/i.test(thumbnailUrl);
  const isDataPng = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(thumbnailUrl) && thumbnailUrl.length <= 500_000;
  if (!isHttpsUrl && !isDataPng) {
    return { success: false, error: "Thumbnail must be an https URL or an image data URL." };
  }

  const { error } = await supabase
    .from("models")
    .update({ thumbnail_url: thumbnailUrl })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) {
    console.error("Failed to update thumbnail:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Records an uploaded listing in the marketplace linked to the verified seller.
 */
export async function recordUploadedListing({
  title,
  slug,
  description,
  priceInr,
  storagePath,
  fileBytes,
  thumbnailUrl,
  category,
  tags,
}: {
  title: string;
  slug: string;
  description: string;
  priceInr: number;
  storagePath: string;
  fileBytes: number;
  thumbnailUrl?: string | null;
  category?: string;
  tags?: string[];
}): Promise<{ data?: { id: string; slug: string }; error?: string }> {
  const user = await getUnifiedUser();
  if (!user) {
    return { error: "You must be signed in to create a listing." };
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { error: "Backend database is not connected." };
  }

  const { data, error } = await supabase
    .from("listings")
    .insert({
      seller_id: user.id,
      title,
      slug,
      description,
      price_inr: priceInr,
      file_path: storagePath,
      file_bytes: fileBytes,
      thumbnail_url: thumbnailUrl || null,
      status: "active",
      category: category || "Other",
      tags: tags || [],
    })
    .select("id, slug")
    .single();

  if (error) {
    console.error("Failed to record listing row:", error);
    return { error: error.message };
  }

  return { data };
}

/**
 * Deletes an uploaded model and its storage blob from model-files.
 */
export async function deleteUploadedModel(id: string): Promise<{ success: boolean; error?: string }> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "You must be signed in to delete a model." };
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { success: false, error: "Backend database not connected." };
  }

  // 1. Fetch model to get storage path and verify ownership
  const { data: model } = await supabase
    .from("models")
    .select("id, storage_path")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!model) {
    return { success: false, error: "Model not found or not owned by you." };
  }

  // 2. Remove file from storage (both B2 and legacy Supabase Storage)
  if (model.storage_path) {
    await deleteB2Object(model.storage_path).catch(() => {});
    await supabase.storage.from("model-files").remove([model.storage_path]).catch(() => {});
  }

  // 3. Delete database row
  const { error } = await supabase
    .from("models")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) {
    console.error("Failed to delete model row:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
