"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/driplnk-web-backend/db/client";
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
  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: "Please enter a valid display name (at least 2 characters)." };
  }

  if (input.rateType !== "hourly" && input.rateType !== "fixed") {
    return { success: false, error: "Rate type must be 'hourly' or 'fixed'." };
  }

  if (typeof input.baseRate !== "number" || isNaN(input.baseRate) || input.baseRate < 0) {
    return { success: false, error: "Please provide a valid non-negative base rate." };
  }

  const cleanSkills = Array.isArray(input.skills)
    ? input.skills.map((s) => s.trim()).filter(Boolean)
    : [];

  const cleanPortfolio = Array.isArray(input.portfolioUrls)
    ? input.portfolioUrls.map((u) => u.trim()).filter(Boolean)
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

  try {
    const { data: rpcRes, error: rpcErr } = await serviceSupabase.rpc("create_freelance_request", {
      p_buyer_user_id: user.id,
      p_freelancer_provider_id: freelancerProviderId,
      p_brief: cleanBrief,
      p_reference_file_paths: referenceFilePaths,
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

  if (action === "accept" && (!agreedPrice || agreedPrice <= 0)) {
    return { success: false, error: "A positive agreed price is required to accept this request." };
  }

  if (action === "deliver" && !finalFilePath?.trim()) {
    return { success: false, error: "A deliverable file is required to mark delivered." };
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

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return { success: false, error: "Database backend is not connected." };
  }

  try {
    // 1. Check access: user is buyer or assigned freelancer
    const { data: req, error: reqErr } = await supabase
      .from("freelance_requests")
      .select("id, buyer_user_id, freelancer_provider_id")
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
