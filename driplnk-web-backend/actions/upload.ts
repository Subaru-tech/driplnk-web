"use server";

import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/driplnk-web-backend/db/client";
import { deleteB2Object } from "@/lib/b2-client";
import { checkWeaponTerms } from "@/lib/weapon-blocklist";

/**
 * Server action to check model title/description/tags against safety policy.
 * Executes strictly server-side so blocklist words are never shipped to the client bundle.
 */
export async function checkModelMetadataSafetyAction(
  title: string,
  description: string = "",
  tags: string[] = []
): Promise<{ flagged: boolean; message?: string }> {
  const result = checkWeaponTerms(title, description, tags);
  return {
    flagged: result.flagged,
    message: result.flagged
      ? "Your model details match criteria subject to mandatory administrative review under platform terms."
      : undefined,
  };
}

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
    return { error: "Failed to record the uploaded model. Please try again." };
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
  fileSha256?: string;
  previewPhash?: number[];
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

  // Weapon and firearm terms check
  const weaponCheck = checkWeaponTerms(cleanTitle, cleanDescription, input.tags || []);
  const isWeaponFlagged = weaponCheck.flagged;
  const fileSha256 = input.fileSha256 ? input.fileSha256.toLowerCase().trim() : null;

  // Check if updating existing draft
  if (input.id) {
    const { data: existing } = await supabase
      .from("models")
      .select("id, owner_id")
      .eq("id", input.id)
      .maybeSingle();

    if (existing && existing.owner_id === user.id) {
      const updatePayload: Record<string, unknown> = {
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
      };

      if (fileSha256) {
        updatePayload.file_sha256 = fileSha256;
      }
      if (isWeaponFlagged) {
        updatePayload.moderation_status = "weapon_review";
        updatePayload.moderation_flags = {
          weapon_match: true,
          matched_terms: weaponCheck.matches,
          flagged_at: new Date().toISOString(),
        };
      }

      const { error: updateErr } = await supabase
        .from("models")
        .update(updatePayload)
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
  const insertPayload: Record<string, unknown> = {
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
  };

  if (fileSha256) {
    insertPayload.file_sha256 = fileSha256;
  }
  if (isWeaponFlagged) {
    insertPayload.moderation_status = "weapon_review";
    insertPayload.moderation_flags = {
      weapon_match: true,
      matched_terms: weaponCheck.matches,
      flagged_at: new Date().toISOString(),
    };
  }

  // 4. Perceptual image hash duplicate detection (visual similarity >= 85%)
  if (Array.isArray(input.previewPhash) && input.previewPhash.length === 64) {
    insertPayload.preview_phash = input.previewPhash;
    try {
      const { data: matches, error: matchErr } = await supabase.rpc("match_model_phash", {
        query_phash: input.previewPhash,
        match_threshold: 0.85,
        match_count: 5,
      });

      if (!matchErr && Array.isArray(matches) && matches.length > 0) {
        // Exclude the model itself if updating an existing record
        const duplicateMatch = matches.find((m: { id: string; similarity: number }) => m.id !== (input.id ?? ""));
        if (duplicateMatch) {
          insertPayload.moderation_status = "duplicate_review";
          insertPayload.status = "pending_review";
          insertPayload.moderation_flags = {
            ...(insertPayload.moderation_flags || {}),
            duplicate_detected: true,
            matched_model_id: duplicateMatch.id,
            similarity: duplicateMatch.similarity,
            flagged_at: new Date().toISOString(),
          };
        }
      }
    } catch (phashErr) {
      console.error("Perceptual hash match check error:", phashErr);
    }
  }

  const { data, error } = await supabase
    .from("models")
    .insert(insertPayload)
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
    return { success: false, error: "Failed to update the thumbnail. Please try again." };
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
    return { error: "Failed to create the listing. Please try again." };
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
    return { success: false, error: "Failed to delete the model. Please try again." };
  }

  return { success: true };
}

/**
 * Checks if a file with the identical SHA-256 hash has already been registered on Driplnk.
 */
export async function checkFileDuplicateByHash(
  sha256: string
): Promise<{ duplicate: boolean; existingModelId?: string; message?: string; isOwnReuse?: boolean }> {
  if (!sha256 || typeof sha256 !== "string") {
    return { duplicate: false };
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { duplicate: false };
  }

  const user = await getUnifiedUser();

  const normalizedHash = sha256.toLowerCase().trim();
  const { data, error } = await supabase
    .from("models")
    .select("id, title, owner_id")
    .eq("file_sha256", normalizedHash)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("checkFileDuplicateByHash error:", error);
    return { duplicate: false };
  }

  // If the same creator is reusing their own file in another listing or kit, permit it!
  if (data) {
    if (user && data.owner_id === user.id) {
      return { duplicate: false, existingModelId: data.id, isOwnReuse: true };
    }
    return {
      duplicate: true,
      existingModelId: data.id,
      message: "This file is already published on Driplnk by another creator.",
    };
  }

  return { duplicate: false };
}

/**
 * Records the primary CAD file SHA-256 hash on a model record.
 */
export async function recordModelHash(
  modelId: string,
  sha256: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { success: false, error: "Database client unavailable" };
  }

  const normalizedHash = sha256.toLowerCase().trim();
  const { error } = await supabase
    .from("models")
    .update({
      file_sha256: normalizedHash,
      updated_at: new Date().toISOString(),
    })
    .eq("id", modelId)
    .eq("owner_id", user.id);

  if (error) {
    console.error("recordModelHash error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Stores a 64-dimensional perceptual hash vector for the rendered model thumbnail,
 * enabling visual similarity searches.
 */
export async function recordModelPhash(
  modelId: string,
  phash: number[]
): Promise<{ success: boolean; error?: string }> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  if (!Array.isArray(phash) || phash.length !== 64) {
    return { success: false, error: "Invalid perceptual hash: expected 64 values." };
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { success: false, error: "Database client unavailable" };
  }

  // Format vector literal for PostgreSQL pgvector: "[v1,v2,...,v64]"
  const vectorStr = `[${phash.map((v) => Number(v.toFixed(6))).join(",")}]`;

  const { error } = await supabase
    .from("models")
    .update({
      preview_phash: vectorStr,
      updated_at: new Date().toISOString(),
    })
    .eq("id", modelId)
    .eq("owner_id", user.id);

  if (error) {
    console.error("recordModelPhash error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

