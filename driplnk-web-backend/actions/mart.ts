"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/driplnk-web-backend/db/client";
import { calculateStlVolume, calculatePartWeight } from "@/driplnk-web-backend/utils/mesh-calc";
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
  };
};

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

  const user = await getUnifiedUser();
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

  // 2. Upload model file to model-files bucket
  const userFolder = user ? user.id : "guest";
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `mart-quotes/${userFolder}/${Date.now()}-${cleanName}`;

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

  // 3. Record quote_requests row if authenticated (service-role client)
  let quoteRequestId: string | null = null;
  if (user) {
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
    },
  };
}

export type CreateOrderInput = {
  quoteRequestId?: string | null;
  filePath: string;
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
): Promise<{ success: boolean; error?: string; orderId?: string }> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "You must be signed in to place an order." };
  }

  const serviceSupabase = getSupabaseServiceClient();
  if (!serviceSupabase) {
    return { success: false, error: "Database backend is not connected." };
  }

  let finalQuoteRequestId = input.quoteRequestId;

  // If quoteRequestId was not created (e.g. quoted while logged out), create it now
  if (!finalQuoteRequestId) {
    const { data: qrId, error: qrErr } = await serviceSupabase.rpc("create_quote_request", {
      p_user_id: user.id,
      p_file_path: input.filePath,
      p_material: input.material,
      p_weight_g: input.weightG,
    });

    if (qrErr || !qrId) {
      console.error("create_quote_request error:", qrErr);
      return { success: false, error: qrErr?.message || "Failed to initialize quote request." };
    }
    finalQuoteRequestId = qrId as string;
  }

  // Atomic order creation via privileged RPC
  const { data: orderId, error: orderErr } = await serviceSupabase.rpc("create_mart_order", {
    p_buyer_user_id: user.id,
    p_quote_request_id: finalQuoteRequestId,
    p_provider_id: input.providerId,
    p_material: input.material,
    p_price: input.price,
  });

  if (orderErr) {
    console.error("create_mart_order error:", orderErr);
    return { success: false, error: orderErr.message || "Failed to create order." };
  }

  revalidatePath("/dashboard/mart-orders");
  revalidatePath("/dashboard/vendor");

  return { success: true, orderId: orderId as string };
}
