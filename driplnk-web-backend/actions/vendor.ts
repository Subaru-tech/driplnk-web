"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/driplnk-web-backend/db/client";
import type { Provider, VendorProfile } from "@/lib/types";

export type ApplyVendorInput = {
  businessName: string;
  location?: string;
  materialsSupported: string[];
  capacityNotes?: string;
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

  const { data, error } = await serviceSupabase.rpc("apply_vendor_profile", {
    p_user_id: user.id,
    p_business_name: cleanName,
    p_location: cleanLocation,
    p_materials_supported: cleanMaterials,
    p_capacity_notes: cleanCapacity,
  });

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
    .select("provider_id, business_name, location, materials_supported, capacity_notes, updated_at")
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
