"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { ensureAdmin } from "@/lib/admin-guard";
import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { getSupabaseServiceClient } from "@/driplnk-web-backend/db/client";

export type AdminActionResult = {
  success: boolean;
  error?: string;
};

/**
 * Updates a listing's status to 'published' or 'rejected'.
 *
 * Writes go through the service-role client: RLS on `listings` doesn't grant
 * admins a client-posable update path, so the privilege lives here — behind a
 * server-verified role check, never behind data the browser sent.
 */
export async function updateListingStatusAdmin({
  listingId,
  status,
}: {
  listingId: string;
  status: "published" | "rejected";
}): Promise<AdminActionResult> {
  const guard = await ensureAdmin();
  if (!guard.ok) {
    return { success: false, error: guard.error };
  }

  const { data: current, error: fetchErr } = await guard.client
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .maybeSingle();

  if (fetchErr || !current) {
    return { success: false, error: "Listing not found." };
  }

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "published") {
    updates.published_at = new Date().toISOString();
  }

  const { error } = await guard.client
    .from("listings")
    .update(updates)
    .eq("id", listingId);

  if (error) {
    console.error("Failed to update listing status:", error);
    return { success: false, error: error.message || "Failed to update listing." };
  }

  revalidatePath("/admin/listings");
  revalidatePath("/admin");
  revalidatePath("/models");
  return { success: true };
}

/**
 * Reviews a 3D model listing (status 'published' or 'rejected') with review notes.
 * Calls public.admin_review_model PostgreSQL RPC through ensureAdmin().
 */
export async function updateModelStatusAdmin({
  modelId,
  status,
  reviewNotes,
}: {
  modelId: string;
  status: "published" | "rejected";
  reviewNotes?: string;
}): Promise<AdminActionResult> {
  const guard = await ensureAdmin();
  if (!guard.ok) {
    return { success: false, error: guard.error };
  }

  // review_notes lands on the model's admin panel; cap it so a single call
  // cannot stuff megabytes into the row.
  const cleanNotes = reviewNotes?.slice(0, 2000) || null;

  const { error: rpcErr } = await guard.client.rpc("admin_review_model", {
    p_model_id: modelId,
    p_status: status,
    p_notes: cleanNotes,
  });

  if (rpcErr) {
    console.error("Failed to review model via RPC:", rpcErr);
    // Fallback direct update
    const { error: updateErr } = await guard.client
      .from("models")
      .update({
        status,
        published_at: status === "published" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", modelId);

    if (updateErr) {
      return { success: false, error: updateErr.message || "Failed to update model status." };
    }
  }

  revalidatePath("/admin/models");
  revalidatePath("/admin/listings");
  revalidatePath("/admin");
  revalidatePath("/models");
  revalidatePath(`/models/${modelId}`);
  revalidatePath("/dashboard/models");
  return { success: true };
}

/**
 * Updates mart order fulfillment fields: assigned_vendor, vendor_notes, and status.
 */
export async function updateMartOrderAdmin({
  orderId,
  assignedVendor,
  vendorNotes,
  status,
}: {
  orderId: string;
  assignedVendor?: string | null;
  vendorNotes?: string | null;
  status?: string;
}): Promise<AdminActionResult> {
  const guard = await ensureAdmin();
  if (!guard.ok) {
    return { success: false, error: guard.error };
  }

  const { data: current, error: fetchErr } = await guard.client
    .from("mart_orders")
    .select("id")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchErr || !current) {
    return { success: false, error: "Order not found." };
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (assignedVendor !== undefined) {
    updates.assigned_vendor = assignedVendor?.trim() || null;
  }
  if (vendorNotes !== undefined) {
    updates.vendor_notes = vendorNotes?.trim() || null;
  }
  if (status !== undefined) {
    // The database stores lowercase statuses; the UI sends Title Case.
    // Validate against the mart_orders status constraint — an unchecked
    // .toLowerCase() would still 500 on garbage, and 'expired_no_vendor_response'
    // etc. must be assignable only through this allowlist.
    const allowedStatuses = new Set([
      "pending_vendor_response",
      "placed",
      "accepted",
      "printing",
      "shipped",
      "delivered",
      "completed",
      "cancelled",
      "expired_no_vendor_response",
    ]);
    const normalized = status.toLowerCase().trim().replace(/\s+/g, "_");
    if (!allowedStatuses.has(normalized)) {
      return { success: false, error: `Invalid order status: ${status}` };
    }
    updates.status = normalized;
  }

  const { error } = await guard.client
    .from("mart_orders")
    .update(updates)
    .eq("id", orderId);

  if (error) {
    console.error("Failed to update mart order fulfillment:", error);
    return { success: false, error: error.message || "Failed to update order." };
  }

  revalidatePath("/admin/mart-orders");
  revalidatePath("/admin");
  revalidatePath("/dashboard/mart-orders");
  revalidatePath(`/dashboard/mart-orders/${orderId}`);
  return { success: true };
}

/**
 * Approves or rejects a vendor or freelancer provider application.
 * Calls public.admin_review_provider PostgreSQL RPC through ensureAdmin().
 */
export async function updateProviderStatusAdmin({
  providerId,
  status,
  notes,
}: {
  providerId: string;
  status: "approved" | "rejected" | "pending" | "changes_requested";
  notes?: string;
}): Promise<AdminActionResult> {
  const guard = await ensureAdmin();
  if (!guard.ok) {
    return { success: false, error: guard.error };
  }

  const { error: rpcErr } = await guard.client.rpc("admin_review_provider", {
    p_provider_id: providerId,
    p_status: status,
    p_notes: notes || null,
  });

  if (rpcErr) {
    console.error("Failed to review provider via RPC:", rpcErr);
    return { success: false, error: rpcErr.message || "Failed to update provider status." };
  }

  revalidatePath("/admin/listings");
  revalidatePath("/admin");
  revalidatePath("/freelance");
  revalidatePath("/vendor/apply");
  revalidatePath("/dashboard/vendor");
  revalidatePath("/dashboard/freelancer");
  return { success: true };
}

export type SubmitReportInput = {
  modelId: string;
  reporterContact: string;
  reason: "stolen_design" | "weapon_content" | "counterfeit" | "other";
  evidenceUrl?: string;
  details?: string;
};

/**
 * Submits an intellectual property or prohibited content report on a public 3D model.
 * Available to any authenticated user.
 */
export async function submitModelReport(
  input: SubmitReportInput
): Promise<AdminActionResult> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "You must be signed in to report a model." };
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { success: false, error: "Database service client unavailable." };
  }

  const cleanContact = (input.reporterContact || user.email || "").trim().slice(0, 200);
  if (!cleanContact) {
    return { success: false, error: "Please provide your contact email or handle." };
  }

  const allowedReasons = ["stolen_design", "weapon_content", "counterfeit", "other"];
  if (!allowedReasons.includes(input.reason)) {
    return { success: false, error: "Invalid report reason selected." };
  }

  const { error: insertErr } = await supabase.from("model_reports").insert({
    model_id: input.modelId,
    reporter_user_id: user.id,
    reporter_contact: cleanContact,
    reason: input.reason,
    evidence_url: input.evidenceUrl ? input.evidenceUrl.trim().slice(0, 500) : null,
    details: input.details ? input.details.trim().slice(0, 2000) : null,
    status: "pending",
  });

  if (insertErr) {
    console.error("submitModelReport error:", insertErr);
    return { success: false, error: "Failed to submit report. Please try again." };
  }

  // Set model moderation_status to 'report_review' if it doesn't already have one
  await supabase
    .from("models")
    .update({
      moderation_status: "report_review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.modelId)
    .is("moderation_status", null);

  revalidatePath("/admin/listings");
  revalidatePath("/admin");
  revalidatePath(`/models/${input.modelId}`);

  return { success: true };
}

/**
 * Resolves a model report from the admin queue, optionally unpublishing the model.
 */
export async function resolveModelReport({
  reportId,
  resolution,
  unpublish = false,
}: {
  reportId: string;
  resolution: string;
  unpublish?: boolean;
}): Promise<AdminActionResult> {
  const guard = await ensureAdmin();
  if (!guard.ok) {
    return { success: false, error: guard.error };
  }

  const { data: report, error: fetchErr } = await guard.client
    .from("model_reports")
    .select("id, model_id")
    .eq("id", reportId)
    .maybeSingle();

  if (fetchErr || !report) {
    return { success: false, error: "Report not found." };
  }

  const now = new Date().toISOString();

  const { error: updateErr } = await guard.client
    .from("model_reports")
    .update({
      status: "resolved",
      resolution: resolution.slice(0, 1000),
      resolved_at: now,
      resolved_by: guard.userId,
      updated_at: now,
    })
    .eq("id", reportId);

  if (updateErr) {
    console.error("resolveModelReport error:", updateErr);
    return { success: false, error: "Failed to resolve report." };
  }

  if (unpublish) {
    await guard.client
      .from("models")
      .update({
        status: "archived",
        moderation_status: "report_review",
        admin_review_notes: `Unpublished via admin report resolution: ${resolution.slice(0, 300)}`,
        updated_at: now,
      })
      .eq("id", report.model_id);
  }

  revalidatePath("/admin/listings");
  revalidatePath("/admin");
  revalidatePath("/models");
  revalidatePath(`/models/${report.model_id}`);

  return { success: true };
}

/**
 * Clears moderation flags on a model and dismisses open reports.
 */
export async function clearModerationFlag(modelId: string): Promise<AdminActionResult> {
  const guard = await ensureAdmin();
  if (!guard.ok) {
    return { success: false, error: guard.error };
  }

  const now = new Date().toISOString();

  const { error } = await guard.client
    .from("models")
    .update({
      moderation_status: "cleared",
      updated_at: now,
    })
    .eq("id", modelId);

  if (error) {
    console.error("clearModerationFlag error:", error);
    return { success: false, error: "Failed to clear moderation flag." };
  }

  await guard.client
    .from("model_reports")
    .update({
      status: "dismissed",
      resolution: "Cleared by admin during moderation review",
      resolved_at: now,
      resolved_by: guard.userId,
      updated_at: now,
    })
    .eq("model_id", modelId)
    .eq("status", "pending");

  revalidatePath("/admin/listings");
  revalidatePath("/admin");
  revalidatePath("/models");
  revalidatePath(`/models/${modelId}`);

  return { success: true };
}

export type AdminModerationItem = {
  id: string;
  title: string;
  slug: string;
  thumbnail_url: string | null;
  status: string;
  moderation_status: string;
  moderation_flags: {
    weapon_match?: boolean;
    matched_terms?: string[];
    flagged_at?: string;
    [key: string]: unknown;
  } | null;
  created_at: string;
  seller_name: string;
  reports: Array<{
    id: string;
    reason: string;
    reporter_contact: string;
    evidence_url?: string | null;
    details?: string | null;
    created_at: string;
    status: string;
  }>;
};

/**
 * Fetches all flagged models and unresolved reports for the admin moderation queue.
 */
export async function getAdminModerationQueue(): Promise<AdminModerationItem[]> {
  const guard = await ensureAdmin();
  if (!guard.ok) return [];

  const { data: models, error: modelsErr } = await guard.client
    .from("models")
    .select(`
      id,
      title,
      name,
      slug,
      thumbnail_url,
      status,
      moderation_status,
      moderation_flags,
      created_at,
      seller:profiles!models_seller_user_id_fkey(full_name)
    `)
    .not("moderation_status", "is", null)
    .neq("moderation_status", "cleared")
    .order("created_at", { ascending: false });

  if (modelsErr) {
    console.error("getAdminModerationQueue models error:", modelsErr);
    return [];
  }

  const { data: reports, error: repErr } = await guard.client
    .from("model_reports")
    .select("id, model_id, reason, reporter_contact, evidence_url, details, created_at, status")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (repErr) {
    console.error("getAdminModerationQueue reports error:", repErr);
  }

  const reportsByModel = new Map<string, Array<{
    id: string;
    reason: string;
    reporter_contact: string;
    evidence_url?: string | null;
    details?: string | null;
    created_at: string;
    status: string;
  }>>();

  (reports || []).forEach((r) => {
    const list = reportsByModel.get(r.model_id) || [];
    list.push(r);
    reportsByModel.set(r.model_id, list);
  });

  const modelMap = new Map<string, AdminModerationItem>();

  (models || []).forEach((m) => {
    const rawSeller = m.seller as unknown;
    const seller = Array.isArray(rawSeller)
      ? (rawSeller[0] as { full_name?: string | null } | undefined)
      : (rawSeller as { full_name?: string | null } | null);
    const sellerName = seller?.full_name || "Creator";
    const modelReports = reportsByModel.get(m.id) || [];
    modelMap.set(m.id, {
      id: m.id,
      title: m.title || m.name || "Untitled Model",
      slug: m.slug || m.id,
      thumbnail_url: m.thumbnail_url ?? null,
      status: m.status || "pending_review",
      moderation_status: m.moderation_status || "report_review",
      moderation_flags: (m.moderation_flags as AdminModerationItem["moderation_flags"]) ?? null,
      created_at: m.created_at,
      seller_name: sellerName,
      reports: modelReports,
    });
  });

  const missingModelIds = Array.from(reportsByModel.keys()).filter((id) => !modelMap.has(id));
  if (missingModelIds.length > 0) {
    const { data: extraModels } = await guard.client
      .from("models")
      .select(`
        id,
        title,
        name,
        slug,
        thumbnail_url,
        status,
        moderation_status,
        moderation_flags,
        created_at,
        seller:profiles!models_seller_user_id_fkey(full_name)
      `)
      .in("id", missingModelIds);

    (extraModels || []).forEach((m) => {
      const rawSeller = m.seller as unknown;
      const seller = Array.isArray(rawSeller)
        ? (rawSeller[0] as { full_name?: string | null } | undefined)
        : (rawSeller as { full_name?: string | null } | null);
      const sellerName = seller?.full_name || "Creator";
      const modelReports = reportsByModel.get(m.id) || [];
      modelMap.set(m.id, {
        id: m.id,
        title: m.title || m.name || "Untitled Model",
        slug: m.slug || m.id,
        thumbnail_url: m.thumbnail_url ?? null,
        status: m.status || "published",
        moderation_status: m.moderation_status || "report_review",
        moderation_flags: (m.moderation_flags as AdminModerationItem["moderation_flags"]) ?? null,
        created_at: m.created_at,
        seller_name: sellerName,
        reports: modelReports,
      });
    });
  }

  return Array.from(modelMap.values());
}

