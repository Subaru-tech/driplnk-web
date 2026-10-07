"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/driplnk-web-backend/db/client";
import type { Provider, VendorProfile } from "@/lib/types";

export type PrinterFleetEntry = {
  printerType: string;   // e.g. "FDM", "SLA"
  model?: string;
  count: number;
  buildVolumeX?: number; // mm
  buildVolumeY?: number;
  buildVolumeZ?: number;
};

export type ApplyVendorInput = {
  businessName: string;
  location?: string;
  materialsSupported: string[];
  capacityNotes?: string;               // human-readable notes (not JSON blob anymore)
  printerFleet?: PrinterFleetEntry[];   // structured fleet data — stored as jsonb
  gstNumber?: string;                   // GSTIN, required for real payouts
  monthlyCapacityEstimate?: string;     // e.g. "200–500 parts / month"
};

export type VendorActionResult<T = unknown> = {
  success: boolean;
  error?: string;
  data?: T;
};

/**
 * Registers an application for a vendor print farm.
 * Creates providers (type='vendor', status='pending') + vendor_profiles
 * in a single atomic database transaction via RPC `apply_vendor_profile`.
 */
export async function applyVendor(
  input: ApplyVendorInput
): Promise<VendorActionResult<{ providerId: string }>> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "You must be signed in to apply as a print vendor." };
  }

  const serviceSupabase = getSupabaseServiceClient();
  if (!serviceSupabase) {
    return { success: false, error: "Database backend is not connected." };
  }

  const cleanName = input.businessName?.trim();
  if (!cleanName || cleanName.length < 2 || cleanName.length > 120) {
    return { success: false, error: "Please enter a valid business or hub name (2-120 characters)." };
  }

  const cleanLocation = input.location?.trim().slice(0, 200) || null;
  const cleanCapacity = input.capacityNotes?.trim().slice(0, 10000) || null;
  const cleanMaterials = Array.isArray(input.materialsSupported)
    ? input.materialsSupported.map((m) => String(m).trim().toLowerCase().slice(0, 40)).filter(Boolean).slice(0, 20)
    : [];

  if (cleanMaterials.length === 0) {
    return { success: false, error: "Please select at least one supported material." };
  }

  const cleanFleet = Array.isArray(input.printerFleet) ? input.printerFleet.slice(0, 20) : [];
  // ponytail: GST number is stored as-is (uppercased, max 15 chars) with no format validation.
  // A valid Indian GSTIN is 15 chars matching /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.
  // Add that regex check before real payout disbursement when the finance team needs verified GST
  // for TDS compliance. Not validating it now since (a) applicants can be unregistered, and
  // (b) payout flows don't exist yet. Flag as "unvalidated" in admin UI if you surface it.
  const cleanGst = input.gstNumber?.trim().toUpperCase().slice(0, 15) || null;
  const cleanMonthlyCapacity = input.monthlyCapacityEstimate?.trim().slice(0, 100) || null;

  let { data, error } = await serviceSupabase.rpc("apply_vendor_profile", {
    p_user_id: user.id,
    p_business_name: cleanName,
    p_location: cleanLocation,
    p_materials_supported: cleanMaterials,
    p_capacity_notes: cleanCapacity,
    p_printer_fleet: cleanFleet,
    p_gst_number: cleanGst,
    p_monthly_capacity_estimate: cleanMonthlyCapacity,
  });

  // Backward compatibility: if migration 20260928000000 has not been run on remote DB yet,
  // fall back to 5-param signature so applications never crash for users.
  if (error && error.code === "PGRST202") {
    const fallback = await serviceSupabase.rpc("apply_vendor_profile", {
      p_user_id: user.id,
      p_business_name: cleanName,
      p_location: cleanLocation,
      p_materials_supported: cleanMaterials,
      p_capacity_notes: cleanCapacity,
    });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error("applyVendor error:", error);
    return { success: false, error: "Failed to submit vendor application. Please try again." };
  }

  revalidatePath("/vendor/apply");
  revalidatePath("/dashboard/vendor");

  return { success: true, data: { providerId: data as string } };
}

/**
 * Fetches the vendor provider and profile for the authenticated user, if one exists.
 */
export async function getMyVendorProvider(): Promise<{
  provider: Provider | null;
  profile: VendorProfile | null;
}> {
  const user = await getUnifiedUser();
  if (!user) return { provider: null, profile: null };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { provider: null, profile: null };

  const { data: provider, error: providerErr } = await supabase
    .from("providers")
    .select("id, user_id, type, status, admin_notes, created_at")
    .eq("user_id", user.id)
    .eq("type", "vendor")
    .maybeSingle();

  if (providerErr || !provider) {
    return { provider: null, profile: null };
  }

  const { data: profile, error: profileErr } = await supabase
    .from("vendor_profiles")
    .select("*")
    .eq("provider_id", provider.id)
    .maybeSingle();

  if (profileErr) {
    return { provider: provider as Provider, profile: null };
  }

  return {
    provider: provider as Provider,
    profile: (profile as VendorProfile) ?? null,
  };
}

/**
 * Vendor or buyer moves a Mart order through its lifecycle.
 * Server-side authorization is strictly enforced by PostgreSQL RPC `respond_to_mart_order`.
 */
export async function respondToMartOrderAction(
  orderId: string,
  action: "accept" | "print" | "ship" | "deliver" | "complete" | "cancel"
): Promise<VendorActionResult<{ orderId: string; action: string }>> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "You must be signed in to perform this action." };
  }

  const serviceSupabase = getSupabaseServiceClient();
  if (!serviceSupabase) {
    return { success: false, error: "Database backend is not connected." };
  }

  const { data, error } = await serviceSupabase.rpc("respond_to_mart_order", {
    p_user_id: user.id,
    p_order_id: orderId,
    p_action: action,
  });

  if (error) {
    return { success: false, error: "Failed to update order status. Please try again." };
  }

  revalidatePath("/dashboard/vendor");
  revalidatePath("/dashboard/mart-orders");
  revalidatePath(`/dashboard/mart-orders/${orderId}`);

  return { success: true, data: data as { orderId: string; action: string } };
}

export type VendorPayoutSummary = {
  configured: boolean;
  payoutMethod?: "bank_transfer" | "upi";
  beneficiaryName?: string;
  maskedAccount?: string;
  ifscCode?: string;
  upiId?: string;
  updatedAt?: string;
};

export type SaveVendorPayoutInput =
  | {
      payoutMethod: "bank_transfer";
      beneficiaryName: string;
      accountNumber: string;
      ifscCode: string;
    }
  | {
      payoutMethod: "upi";
      upiId: string;
    };

/**
 * Retrieves the payout account configured for the authenticated vendor.
 * Masks sensitive account numbers for over-the-shoulder privacy.
 */
export async function getMyVendorPayoutDetails(): Promise<{
  success: boolean;
  data: VendorPayoutSummary;
  error?: string;
}> {
  const user = await getUnifiedUser();
  if (!user) return { success: false, data: { configured: false }, error: "Not authenticated" };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { success: false, data: { configured: false }, error: "Database not connected" };

  const { data: provider } = await supabase
    .from("providers")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("type", "vendor")
    .maybeSingle();

  if (!provider) {
    return { success: true, data: { configured: false } };
  }

  const { data, error } = await supabase
    .from("vendor_payout_details")
    .select("*")
    .eq("provider_id", provider.id)
    .maybeSingle();

  if (error || !data) {
    return { success: true, data: { configured: false } };
  }

  const isBank = data.payout_method === "bank_transfer";
  const rawAcc = data.account_number || "";
  const rawUpi = data.upi_id || "";

  return {
    success: true,
    data: {
      configured: true,
      payoutMethod: data.payout_method,
      beneficiaryName: data.beneficiary_name || undefined,
      maskedAccount: isBank && rawAcc.length >= 4 ? `•••• •••• •••• ${rawAcc.slice(-4)}` : undefined,
      ifscCode: data.ifsc_code || undefined,
      upiId: !isBank && rawUpi.includes("@") ? `${rawUpi.slice(0, 2)}••••@${rawUpi.split("@")[1]}` : rawUpi || undefined,
      updatedAt: data.updated_at,
    },
  };
}

/**
 * Saves or updates payout disbursement details for an APPROVED vendor.
 * Rejects submissions if vendor is not approved, ensuring bank details are only
 * accepted from verified print farm partners.
 */
export async function saveVendorPayoutDetails(
  input: SaveVendorPayoutInput
): Promise<VendorActionResult<{ configured: boolean }>> {
  const user = await getUnifiedUser();
  if (!user) {
    return { success: false, error: "You must be signed in to configure payouts." };
  }

  const serviceSupabase = getSupabaseServiceClient();
  if (!serviceSupabase) {
    return { success: false, error: "Database backend is not connected." };
  }

  // 1. Enforce that provider is approved
  const { data: provider, error: provErr } = await serviceSupabase
    .from("providers")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("type", "vendor")
    .maybeSingle();

  if (provErr || !provider) {
    return { success: false, error: "Vendor profile not found. Please apply first." };
  }

  if (provider.status !== "approved") {
    return {
      success: false,
      error: "Payout details can only be registered after your vendor application has been approved by admin.",
    };
  }

  // 2. Validate input fields
  if (input.payoutMethod === "bank_transfer") {
    const cleanName = input.beneficiaryName?.trim();
    if (!cleanName || cleanName.length < 2 || cleanName.length > 120) {
      return { success: false, error: "Please provide a valid account beneficiary name." };
    }

    const cleanAcc = input.accountNumber?.trim().replace(/\s+/g, "");
    if (!cleanAcc || !/^\d{9,20}$/.test(cleanAcc)) {
      return { success: false, error: "Account number must be between 9 and 20 digits." };
    }

    const cleanIfsc = input.ifscCode?.trim().toUpperCase();
    if (!cleanIfsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      return { success: false, error: "Please enter a valid 11-character Indian IFSC code (e.g., HDFC0001234)." };
    }

    const { error: upsertErr } = await serviceSupabase
      .from("vendor_payout_details")
      .upsert(
        {
          provider_id: provider.id,
          user_id: user.id,
          payout_method: "bank_transfer",
          beneficiary_name: cleanName,
          account_number: cleanAcc,
          ifsc_code: cleanIfsc,
          upi_id: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider_id" }
      );

    if (upsertErr) {
      console.error("saveVendorPayoutDetails error:", upsertErr);
      if (upsertErr.code === "PGRST205" || upsertErr.message?.includes("vendor_payout_details")) {
        return {
          success: false,
          error: "Table vendor_payout_details not found. Please apply database migration 20260928000000 in Supabase.",
        };
      }
      return { success: false, error: "Failed to save bank payout details. Please try again." };
    }
  } else if (input.payoutMethod === "upi") {
    const cleanUpi = input.upiId?.trim().toLowerCase();
    if (!cleanUpi || !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(cleanUpi)) {
      return { success: false, error: "Please enter a valid UPI ID (e.g. business@okaxis)." };
    }

    const { error: upsertErr } = await serviceSupabase
      .from("vendor_payout_details")
      .upsert(
        {
          provider_id: provider.id,
          user_id: user.id,
          payout_method: "upi",
          beneficiary_name: null,
          account_number: null,
          ifsc_code: null,
          upi_id: cleanUpi,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider_id" }
      );

    if (upsertErr) {
      console.error("saveVendorPayoutDetails error:", upsertErr);
      if (upsertErr.code === "PGRST205" || upsertErr.message?.includes("vendor_payout_details")) {
        return {
          success: false,
          error: "Table vendor_payout_details not found. Please apply database migration 20260928000000 in Supabase.",
        };
      }
      return { success: false, error: "Failed to save UPI payout details. Please try again." };
    }
  } else {
    return { success: false, error: "Invalid payout method selected." };
  }

  revalidatePath("/dashboard/vendor");
  return { success: true, data: { configured: true } };
}
