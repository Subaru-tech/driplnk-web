"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { getSupabaseServiceClient } from "@/driplnk-web-backend/db/client";
import type { RateType } from "@/lib/types";

export type ApplyFreelancerInput = {
  displayName: string;
  bio?: string;
  skills: string[];
  portfolioUrls: string[];
  rateType: RateType;
  baseRate: number;
};

export type FreelanceActionResult<T = unknown> = {
  success: boolean;
  error?: string;
  data?: T;
};

/** 25 MB — reference/deliverable files land in storage; an unbounded size is
 * a storage-cost lever. Extension allowlist matches what buyers/freelancers
 * actually exchange (briefs, renders, meshes). */
const MAX_FREELANCE_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_FREELANCE_EXTENSIONS = new Set([
  ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".txt", ".md", ".csv",
  ".stl", ".step", ".stp", ".3mf", ".obj", ".ply", ".zip", ".gcode",
]);

/**
 * Uploads a reference or deliverable file to the freelance-deliverables
 * bucket — server-side, under the verified caller's own folder.
 *
 * This used to be a browser-direct upload with the anon key: the only thing
 * gating it was a storage policy whose helper had no caller-identity check,
 * so anyone with the public anon key could write into any user's folder.
 * Uploading through the server (after getUnifiedUser()) removes that
 * dependency entirely, and works for Clerk sessions that hold no Supabase
 * JWT at all.
 */
export async function uploadFreelanceFile(
  formData: FormData
): Promise<{ success: boolean; error?: string; filePath?: string }> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  const kindRaw = formData.get("kind");
  const kind = kindRaw === "deliverable" ? "deliverable" : "reference";

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Please choose a file to upload." };
  }
  if (file.size > MAX_FREELANCE_FILE_BYTES) {
    return { success: false, error: "File exceeds the 25 MB limit." };
  }
  if (file.name.length > 200) {
    return { success: false, error: "File name is too long." };
  }

  const dot = file.name.lastIndexOf(".");
  const ext = dot === -1 ? "" : file.name.slice(dot).toLowerCase();
  if (!ALLOWED_FREELANCE_EXTENSIONS.has(ext)) {
    return { success: false, error: "That file type isn't supported here." };
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { success: false, error: "Database backend is not connected." };
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const folder = kind === "deliverable" ? "deliverables" : "references";
  const filePath = `${user.id}/${folder}/${Date.now()}_${cleanName}`;

  const { error } = await supabase.storage.from("freelance-deliverables").upload(filePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    console.error("freelance-deliverables upload error:", error);
    return { success: false, error: "Upload failed. Please try again." };
  }

  return { success: true, filePath };
}

/**
 * Self-registers the currently logged-in user as a freelancer.
 * Calls atomic RPC `register_freelancer_profile` ensuring `providers` (type='freelancer', auto-approved)
 * and `freelancer_profiles` are created in a single database transaction.
 */
export async function applyFreelancer(
  input: ApplyFreelancerInput
): Promise<FreelanceActionResult<{ providerId: string }>> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "You must be signed in to apply as a freelancer." };
  }

  const serviceSupabase = getSupabaseServiceClient();
  if (!serviceSupabase) {
    return { success: false, error: "Database backend is not connected." };
  }

  const cleanName = input.displayName?.trim();
  if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
    return { success: false, error: "Please enter a valid display name (2-80 characters)." };
  }

  if (input.bio && input.bio.length > 2000) {
    return { success: false, error: "Bio must be 2000 characters or fewer." };
  }

  if (input.rateType !== "hourly" && input.rateType !== "fixed") {
    return { success: false, error: "Rate type must be 'hourly' or 'fixed'." };
  }

  if (typeof input.baseRate !== "number" || !Number.isFinite(input.baseRate) || input.baseRate < 0 || input.baseRate > 10_000_000) {
    return { success: false, error: "Please provide a valid non-negative base rate." };
  }

  const cleanSkills = Array.isArray(input.skills)
    ? input.skills.map((s) => String(s).trim().slice(0, 40)).filter(Boolean).slice(0, 20)
    : [];

  const cleanPortfolio = Array.isArray(input.portfolioUrls)
    ? input.portfolioUrls
        .map((u) => String(u).trim())
        .filter((u) => {
          if (u.length === 0 || u.length > 300) return false;
          // Only http(s) URLs. javascript:, data:, and other schemes stored
          // here are rendered as portfolio links on a public profile.
          return /^https?:\/\//i.test(u);
        })
        .slice(0, 10)
    : [];

  try {
    const { data: rpcRes, error: rpcErr } = await serviceSupabase.rpc("register_freelancer_profile", {
      p_user_id: user.id,
      p_display_name: cleanName,
      p_bio: input.bio?.trim() || null,
      p_skills: cleanSkills,
      p_portfolio_urls: cleanPortfolio,
      p_rate_type: input.rateType,
      p_base_rate: input.baseRate,
    });

    if (rpcErr) {
      console.error("register_freelancer_profile RPC error:", rpcErr);
      return { success: false, error: rpcErr.message || "Failed to register profile." };
    }

    const parsed = typeof rpcRes === "string" ? JSON.parse(rpcRes) : rpcRes;
    if (!parsed.success) {
      return { success: false, error: parsed.error || "Failed to register freelancer profile." };
    }

    revalidatePath("/freelance");
    revalidatePath(`/freelance/${parsed.provider_id}`);
    revalidatePath("/dashboard/freelancer");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: { providerId: parsed.provider_id },
    };
  } catch (err) {
    console.error("applyFreelancer exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Creates a new freelance request from a buyer to a freelancer.
 */
export async function submitFreelanceRequest({
  freelancerProviderId,
  brief,
  referenceFilePaths = [],
}: {
  freelancerProviderId: string;
  brief: string;
  referenceFilePaths?: string[];
}): Promise<FreelanceActionResult<{ requestId: string }>> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "You must be signed in to hire a specialist." };
  }

  const serviceSupabase = getSupabaseServiceClient();
  if (!serviceSupabase) {
    return { success: false, error: "Database backend is not connected." };
  }

  const cleanBrief = brief?.trim();
  if (!cleanBrief || cleanBrief.length < 10) {
    return {
      success: false,
      error: "Please provide a detailed project brief (at least 10 characters).",
    };
  }
  if (cleanBrief.length > 5000) {
    return { success: false, error: "Project brief must be 5000 characters or fewer." };
  }
  if (referenceFilePaths.length > 10) {
    return { success: false, error: "At most 10 reference files can be attached." };
  }
  // Paths are minted by the browser as `${userId}/references/...` in the
  // freelance-deliverables bucket. A client could submit a path belonging to
  // someone else's project (or an arbitrary key) — pin every path to the
  // caller's own folder before it is persisted to the request.
  const cleanReferencePaths = referenceFilePaths
    .filter((p): p is string => typeof p === "string" && p.startsWith(`${user.id}/`))
    .slice(0, 10);

  try {
    const { data: rpcRes, error: rpcErr } = await serviceSupabase.rpc("create_freelance_request", {
      p_buyer_user_id: user.id,
      p_freelancer_provider_id: freelancerProviderId,
      p_brief: cleanBrief,
      p_reference_file_paths: cleanReferencePaths,
    });

    if (rpcErr) {
      console.error("create_freelance_request RPC error:", rpcErr);
      return { success: false, error: rpcErr.message || "Failed to submit request." };
    }

    const parsed = typeof rpcRes === "string" ? JSON.parse(rpcRes) : rpcRes;
    if (!parsed.success) {
      return { success: false, error: parsed.error || "Failed to create request." };
    }

    revalidatePath("/dashboard/freelance-requests");
    revalidatePath("/dashboard/freelancer");
    revalidatePath(`/freelance/${freelancerProviderId}`);

    return {
      success: true,
      data: { requestId: parsed.request_id },
    };
  } catch (err) {
    console.error("submitFreelanceRequest exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Responds to a freelance request: accept (with agreed price), start_work, deliver, complete, or cancel.
 */
export async function respondToFreelanceRequest({
  requestId,
  action,
  agreedPrice,
  finalFilePath,
}: {
  requestId: string;
  action: "accept" | "start_work" | "deliver" | "complete" | "cancel";
  agreedPrice?: number;
  finalFilePath?: string;
}): Promise<FreelanceActionResult<{ status: string }>> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  const serviceSupabase = getSupabaseServiceClient();
  if (!serviceSupabase) {
    return { success: false, error: "Database backend is not connected." };
  }

  if (action === "deliver" && (!finalFilePath?.trim() || !finalFilePath.trim().startsWith(`${user.id}/`))) {
    return { success: false, error: "A deliverable file uploaded by you is required to mark delivered." };
  }

  if (action === "accept" && (typeof agreedPrice !== "number" || !Number.isFinite(agreedPrice) || agreedPrice <= 0 || agreedPrice > 100_000_000)) {
    return { success: false, error: "A positive agreed price is required to accept this request." };
  }

  try {
    const { data: rpcRes, error: rpcErr } = await serviceSupabase.rpc("respond_to_freelance_request", {
      p_user_id: user.id,
      p_request_id: requestId,
      p_action: action,
      p_agreed_price: agreedPrice ?? null,
      p_final_file_path: finalFilePath?.trim() ?? null,
    });

    if (rpcErr) {
      console.error("respond_to_freelance_request RPC error:", rpcErr);
      return { success: false, error: rpcErr.message || "Failed to update request." };
    }

    const parsed = typeof rpcRes === "string" ? JSON.parse(rpcRes) : rpcRes;
    if (!parsed.success) {
      return { success: false, error: parsed.error || "Failed to update request status." };
    }

    revalidatePath("/dashboard/freelancer");
    revalidatePath("/dashboard/freelance-requests");

    return {
      success: true,
      data: { status: parsed.status },
    };
  } catch (err) {
    console.error("respondToFreelanceRequest exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Generates a signed, temporary download URL for a file in `freelance-deliverables`
 * (either a reference attachment or a final deliverable).
 * Validates that caller is either the buyer or the assigned freelancer.
 *
 * Uses the service-role client to read the row and sign the URL: Clerk users
 * hold no Supabase JWT, so the anon client would fail RLS on both the SELECT
 * and the signing call even though ownership was just verified explicitly
 * below. The explicit buyer/freelancer/path checks above are the gate.
 */
export async function getFreelanceFileDownloadUrl({
  requestId,
  filePath,
}: {
  requestId: string;
  filePath: string;
}): Promise<FreelanceActionResult<{ downloadUrl: string }>> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { success: false, error: "Database backend is not connected." };
  }

  try {
    // 1. Check access: user is buyer or assigned freelancer
    const { data: req, error: reqErr } = await supabase
      .from("freelance_requests")
      .select("id, buyer_user_id, freelancer_provider_id, final_file_path, reference_file_paths")
      .eq("id", requestId)
      .maybeSingle();

    if (reqErr || !req) {
      return { success: false, error: "Request not found." };
    }

    let isAuthorized = req.buyer_user_id === user.id;

    if (!isAuthorized) {
      const { data: prov } = await supabase
        .from("providers")
        .select("id")
        .eq("id", req.freelancer_provider_id)
        .eq("user_id", user.id)
        .maybeSingle();

      isAuthorized = Boolean(prov);
    }

    if (!isAuthorized) {
      return { success: false, error: "Unauthorized access to file." };
    }

    // 2. The path must belong to THIS request — being buyer or freelancer
    // authorizes you for this project's files, not for every object in the
    // bucket. Without this check a party to any request could mint signed
    // URLs for arbitrary other users' files.
    const referencePaths = (req.reference_file_paths ?? []) as string[];
    const belongsToRequest =
      (req.final_file_path !== null && req.final_file_path === filePath) ||
      referencePaths.includes(filePath);

    if (!belongsToRequest) {
      return { success: false, error: "File is not part of this request." };
    }

    // 2. Generate signed URL (valid for 1 hour)
    const { data: signData, error: signErr } = await supabase.storage
      .from("freelance-deliverables")
      .createSignedUrl(filePath, 3600, {
        download: true,
      });

    if (signErr || !signData?.signedUrl) {
      console.error("Storage signed URL error:", signErr);
      return { success: false, error: "Failed to generate download link." };
    }

    return {
      success: true,
      data: { downloadUrl: signData.signedUrl },
    };
  } catch (err) {
    console.error("getFreelanceFileDownloadUrl exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate download link.",
    };
  }
}
