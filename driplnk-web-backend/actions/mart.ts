"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { ensureAdmin } from "@/lib/admin-guard";
import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/driplnk-web-backend/db/client";
import { calculateStlVolume, calculatePartWeight } from "@/driplnk-web-backend/utils/mesh-calc";
import { checkWeaponTerms } from "@/lib/weapon-blocklist";
import type { VendorQuoteItem } from "@/lib/types";

export type CalculateQuotesResult = {
  success: boolean;
  error?: string;
  data?: {
    quoteRequestId: string | null;
    filePath: string;
    fileName: string;
    volumeCm3: number;
    weightG: number;
    material: string;
    quotes: VendorQuoteItem[];
    isWeaponFlagged?: boolean;
    weaponMatches?: string[];
  };
};

/** Quoting accepts these materials only — anything else falls through to a
 * default density downstream, which would misquote the print. */
const QUOTE_MATERIALS = new Set(["pla", "petg", "abs", "resin", "nylon-cf"]);

/** 50 MB — matches MAX_MODEL_FILE_BYTES on the upload route. A quote upload
 * has to be parsed into memory for volume math, so an unbounded size is a
 * memory-exhaustion lever, not just a storage cost. */
const MAX_QUOTE_FILE_BYTES = 50 * 1024 * 1024;

/** Quote upload paths are always of this shape (see the storagePath below).
 * Validating the shape stops a crafted order from pointing a quote request at
 * arbitrary storage keys outside the mart-quotes namespace. */
function isSafeQuotePath(path: string): boolean {
  return /^mart-quotes\/[A-Za-z0-9_-]+\/\d+-[A-Za-z0-9._-]+$/.test(path);
}

/**
 * Server action that takes an uploaded STL/mesh file and desired material:
 * 1. Computes exact volume and physical weight server-side.
 * 2. Uploads model file to the model-files storage bucket.
 * 3. Records quote_requests row if user is signed in.
 * 4. Calls get_mart_vendor_quotes RPC to fetch quotes without leaking pricing formulas.
 */
export async function calculateMeshQuotes(
  formData: FormData
): Promise<CalculateQuotesResult> {
  const file = formData.get("file") as File | null;
  const material = ((formData.get("material") as string) || "pla").toLowerCase();

  if (!file || file.size === 0) {
    return { success: false, error: "Please provide a valid 3D model file." };
  }

  if (file.size > MAX_QUOTE_FILE_BYTES) {
    return { success: false, error: "File exceeds the 50 MB quote upload limit." };
  }

  if (!QUOTE_MATERIALS.has(material)) {
    return { success: false, error: "Unsupported material. Choose PLA, PETG, ABS, Resin or Nylon-CF." };
  }

  if (file.name.length > 200) {
    return { success: false, error: "File name is too long." };
  }

  // Volume math parses the entire upload into memory, and each accepted file
  // is persisted to storage. Requiring sign-in keeps this expensive endpoint
  // from being an anonymous CPU/storage drain.
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "Please sign in to get a print quote." };
  }

  const supabase = await getSupabaseServerClient();
  const serviceSupabase = getSupabaseServiceClient() ?? supabase;

  if (!supabase || !serviceSupabase) {
    return { success: false, error: "Database backend is not connected." };
  }

  // 1. Read buffer and calculate volume & weight
  let volumeCm3 = 0;
  let weightG = 0;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const volumeRes = calculateStlVolume(buffer);
    volumeCm3 = Math.round(volumeRes.volumeCm3 * 100) / 100;
    weightG = calculatePartWeight(volumeRes.volumeCm3, material);
  } catch (err: unknown) {
    console.error("Volume calculation error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not compute mesh volume. Please check that your STL is closed/manifold.",
    };
  }

  // 2. Upload model file to model-files bucket — always inside the caller's
  // own folder now that sign-in is mandatory.
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `mart-quotes/${user.id}/${Date.now()}-${cleanName}`;

  try {
    const { error: uploadErr } = await serviceSupabase.storage
      .from("model-files")
      .upload(storagePath, file, { contentType: "application/octet-stream" });

    if (uploadErr) {
      console.warn("Could not save copy to model-files storage, proceeding with quote:", uploadErr.message);
    }
  } catch {
    // Non-blocking for quoting
  }

  // 3. Record quote_requests row (service-role client; caller is authenticated)
  let quoteRequestId: string | null = null;
  {
    const { data: qrId, error: qrErr } = await serviceSupabase.rpc("create_quote_request", {
      p_user_id: user.id,
      p_file_path: storagePath,
      p_material: material,
      p_weight_g: weightG,
    });

    if (!qrErr && qrId) {
      quoteRequestId = qrId as string;
    }
  }

  // 4. Fetch vendor quotes
  const { data: quotes, error: quotesErr } = await supabase.rpc("get_mart_vendor_quotes", {
    p_weight_g: weightG,
    p_material: material,
  });

  if (quotesErr) {
    console.error("Failed to fetch vendor quotes:", quotesErr);
    return { success: false, error: quotesErr.message || "Failed to calculate quotes." };
  }

  const cleanQuotes: VendorQuoteItem[] = (quotes || []).map((q: Record<string, unknown>) => ({
    provider_id: String(q.provider_id),
    business_name: String(q.business_name),
    location: (q.location as string | null) ?? null,
    price: Number(q.price),
    material: String(q.material),
  }));

  // Direct-print weapon check on uploaded CAD filename
  const sanitizedFileName = file.name.replace(/[/._-]/g, " ");
  const weaponCheck = checkWeaponTerms(sanitizedFileName);

  return {
    success: true,
    data: {
      quoteRequestId,
      filePath: storagePath,
      fileName: file.name,
      volumeCm3,
      weightG,
      material,
      quotes: cleanQuotes,
      isWeaponFlagged: weaponCheck.flagged,
      weaponMatches: weaponCheck.matches,
    },
  };
}

export type CreateOrderInput = {
  quoteRequestId?: string | null;
  filePath: string;
  fileName?: string;
  description?: string;
  notes?: string;
  providerId: string;
  material: string;
  price: number;
  weightG: number;
};

/**
 * Creates a mart_orders row from the buyer's selected vendor quote.
 */
export async function createMartOrderAction(
  input: CreateOrderInput
): Promise<{ success: boolean; error?: string; orderId?: string; heldForReview?: boolean }> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "You must be signed in to place an order." };
  }

  const serviceSupabase = getSupabaseServiceClient();
  if (!serviceSupabase) {
    return { success: false, error: "Database backend is not connected." };
  }

  if (!isSafeQuotePath(input.filePath)) {
    return { success: false, error: "Invalid file reference." };
  }

  if (!Number.isFinite(input.weightG) || input.weightG < 0 || input.weightG > 1_000_000) {
    return { success: false, error: "Invalid part weight." };
  }

  if (!QUOTE_MATERIALS.has(input.material.toLowerCase())) {
    return { success: false, error: "Unsupported material." };
  }

  let finalQuoteRequestId = input.quoteRequestId;

  // If quoteRequestId was not created (e.g. quoted while logged out), create it now
  if (!finalQuoteRequestId) {
    const { data: qrId, error: qrErr } = await serviceSupabase.rpc("create_quote_request", {
      p_user_id: user.id,
      p_file_path: input.filePath,
      p_material: input.material.toLowerCase(),
      p_weight_g: input.weightG,
    });

    if (qrErr || !qrId) {
      console.error("create_quote_request error:", qrErr);
      return { success: false, error: qrErr?.message || "Failed to initialize quote request." };
    }
    finalQuoteRequestId = qrId as string;
  } else if (typeof finalQuoteRequestId !== "string" || !/^[0-9a-f-]{36}$/i.test(finalQuoteRequestId)) {
    return { success: false, error: "Invalid quote reference." };
  }

  // 1. Direct-print safety moderation gate:
  // Scans file name extracted from storage path, explicit fileName, and any order notes.
  const rawFileName = input.fileName || input.filePath.split("/").pop()?.replace(/^\d+-/, "") || "";
  const textToScan = `${rawFileName} ${input.description || ""} ${input.notes || ""}`.replace(/[/._-]/g, " ");
  const weaponCheck = checkWeaponTerms(textToScan);

  const moderationStatus = weaponCheck.flagged ? "weapon_review" : null;
  const moderationFlags = weaponCheck.flagged
    ? {
        weapon_match: true,
        matched_terms: weaponCheck.matches,
        scanned_text: textToScan.trim(),
        flagged_at: new Date().toISOString(),
        details: `Direct-print order held for safety compliance review due to prohibited weapon terms: ${weaponCheck.matches.join(", ")}`,
      }
    : {};

  // Atomic order creation via privileged RPC. The price the client sent is
  // deliberately NOT forwarded: create_mart_order recomputes what the chosen
  // vendor's published pricing rules actually charge, so a tampered client
  // cannot buy a ₹5,000 print for ₹50.
  const { data: orderId, error: orderErr } = await serviceSupabase.rpc("create_mart_order", {
    p_buyer_user_id: user.id,
    p_quote_request_id: finalQuoteRequestId,
    p_provider_id: input.providerId,
    p_material: input.material.toLowerCase(),
    p_moderation_status: moderationStatus,
    p_moderation_flags: moderationFlags,
  });

  if (orderErr) {
    console.error("create_mart_order error:", orderErr);
    return { success: false, error: orderErr.message || "Failed to create order." };
  }

  revalidatePath("/dashboard/mart-orders");
  revalidatePath("/dashboard/vendor");
  revalidatePath("/admin/mart-orders");

  return {
    success: true,
    orderId: orderId as string,
    heldForReview: weaponCheck.flagged,
  };
}

/**
 * Server action for administrative clearance or rejection of held Mart direct-print orders.
 */
export async function adminModerateMartOrderAction(
  orderId: string,
  action: "clear" | "reject",
  notes?: string
): Promise<{ success: boolean; error?: string; status?: string }> {
  const guard = await ensureAdmin();
  if (!guard.ok) {
    return { success: false, error: guard.error };
  }

  const serviceSupabase = getSupabaseServiceClient();
  if (!serviceSupabase) {
    return { success: false, error: "Database backend is not connected." };
  }

  const { data, error } = await serviceSupabase.rpc("admin_moderate_mart_order", {
    p_order_id: orderId,
    p_action: action,
    p_notes: notes || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/mart-orders");
  revalidatePath("/admin/listings");
  revalidatePath("/dashboard/mart-orders");
  revalidatePath("/dashboard/vendor");

  return { success: true, status: (data as { status?: string })?.status };
}

