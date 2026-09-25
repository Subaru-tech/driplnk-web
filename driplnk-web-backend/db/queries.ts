import "server-only";

import { getSupabaseServerClient, getSupabaseServiceClient } from "@/driplnk-web-backend/db/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUnifiedUser, isClerkConfigured, syncClerkProfile } from "@/driplnk-web-backend/auth/clerk";
import type {
  AcquiredModel,
  FreelanceRequest,
  FreelancerProfile,
  LedgerEntry,
  Listing,
  MarketplaceLicenseType,
  MarketplaceModel,
  PublicListing,
  MartOrder,
  MartVendorOrder,
  Model,
  Payout,
  Profile,
  Provider,
  ProviderStatus,
  Sale,
  SellerProfile,
} from "@/lib/types";


/**
 * Dashboard data access.
 *
 * Real Supabase calls protected by server-only isolation.
 */

export type QueryResult<T> = {
  data: T;
  /** False when the query could not reach real tables (not yet deployed). */
  backendReady: boolean;
};

/**
 * Any query error (most often Postgres `42P01 undefined_table`, before the
 * schema is deployed) degrades to an empty result plus `backendReady: false`.
 * The page then shows its real empty state instead of throwing.
 */
function empty<T>(fallback: T): QueryResult<T> {
  return { data: fallback, backendReady: false };
}

/**
 * Client for owner-scoped reads. Supabase-auth users pass RLS through the
 * cookie-bound client, but Clerk-authenticated users hold no Supabase JWT, so
 * every RLS-filtered read returns empty for them. The service-role client
 * bypasses RLS — safe here because each caller resolves the user id
 * server-side via getUnifiedUser() before filtering on it.
 */
async function getOwnerQueryClient(): Promise<SupabaseClient | null> {
  return getSupabaseServiceClient() ?? (await getSupabaseServerClient());
}

export async function getProfile(): Promise<QueryResult<Profile | null>> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return empty(null);

  const user = await getUnifiedUser();
  if (user) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, credits_balance, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!error && data) {
      return { data: data as Profile, backendReady: true };
    }
  }

  if (isClerkConfigured) {
    const profile = await syncClerkProfile();
    if (profile) return { data: profile, backendReady: true };
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return empty(null);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, credits_balance, role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error) return empty(null);
  return { data: (data as Profile) ?? null, backendReady: true };
}

/** Sort options offered by the My Models toolbar — spec §6.2. */
export const MODEL_SORTS = {
  newest: { label: "Newest", column: "created_at", ascending: false },
  oldest: { label: "Oldest", column: "created_at", ascending: true },
  name: { label: "Name", column: "name", ascending: true },
} as const;

export type ModelSort = keyof typeof MODEL_SORTS;

export async function getModels(
  limit?: number,
  options: { search?: string; sort?: ModelSort } = {},
): Promise<QueryResult<Model[]>> {
  const supabase = await getOwnerQueryClient();
  if (!supabase) return empty([]);

  const user = await getUnifiedUser();
  if (!user) return empty([]);

  const sort = MODEL_SORTS[options.sort ?? "newest"];

  let query = supabase
    .from("models")
    .select("id, name, thumbnail_url, storage_path, credits_spent, created_at")
    .eq("owner_id", user.id)
    .order(sort.column, { ascending: sort.ascending });

  if (options.search) {
    /* Escape the LIKE wildcards so a literal % or _ in the query doesn't
       silently widen the match. */
    const escaped = options.search.replace(/[%_]/g, (char) => `\\${char}`);
    query = query.ilike("name", `%${escaped}%`);
  }
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) return empty([]);
  return { data: (data as Model[]) ?? [], backendReady: true };
}

export type CreatorStudioModel = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  price: number;
  status: "published" | "under_review" | "draft" | "rejected";
  thumbnail_url: string | null;
  preview_image_paths: string[];
  file_path: string | null;
  created_at: string;
  views: number;
  downloads: number;
  earnings: number;
};

export async function getCreatorStudioModels(
  statusFilter?: string
): Promise<QueryResult<CreatorStudioModel[]>> {
  const serviceSupabase = getSupabaseServiceClient();
  if (!serviceSupabase) return empty([]);

  const user = await getUnifiedUser();
  if (!user) return empty([]);

  let query = serviceSupabase
    .from("models")
    .select("id, name, title, description, category, price, license_type, status, thumbnail_url, preview_image_paths, file_path, storage_path, created_at")
    .or(`owner_id.eq.${user.id},seller_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error || !data) return empty([]);

  const modelIds = data.map((row) => row.id);
  const acquisitionCounts: Record<string, number> = {};
  if (modelIds.length > 0) {
    const { data: acqs } = await serviceSupabase
      .from("model_acquisitions")
      .select("model_id")
      .in("model_id", modelIds);
    if (acqs) {
      for (const a of acqs) {
        acquisitionCounts[a.model_id] = (acquisitionCounts[a.model_id] || 0) + 1;
      }
    }
  }

  const models: CreatorStudioModel[] = data.map((row) => {
    const downloads = acquisitionCounts[row.id] || 0;
    const views = 0;
    const price = Number(row.price || 0);
    const earnings = downloads * price;

    return {
      id: row.id,
      title: row.title || row.name || "Untitled Model",
      description: row.description,
      category: row.category || "Mechanical",
      price,
      status: (row.status as CreatorStudioModel["status"]) || "published",
      thumbnail_url: row.thumbnail_url || (row.preview_image_paths?.[0] ?? null),
      preview_image_paths: row.preview_image_paths ?? [],
      file_path: row.file_path || row.storage_path || null,
      created_at: row.created_at,
      views,
      downloads,
      earnings,
    };
  });

  return { data: models, backendReady: true };
}

export async function getMartOrders(limit?: number): Promise<QueryResult<MartVendorOrder[]>> {
  const serviceSupabase = getSupabaseServiceClient();
  if (!serviceSupabase) return empty([]);

  const user = await getUnifiedUser();
  if (!user) return empty([]);

  const { data, error } = await serviceSupabase.rpc("get_mart_orders_for_user", {
    p_user_id: user.id,
    p_role: "buyer",
  });

  if (error || !data) return empty([]);
  const orders = limit ? (data as MartVendorOrder[]).slice(0, limit) : (data as MartVendorOrder[]);
  return { data: orders, backendReady: true };
}

export async function getVendorOrders(limit?: number): Promise<QueryResult<MartVendorOrder[]>> {
  const serviceSupabase = getSupabaseServiceClient();
  if (!serviceSupabase) return empty([]);

  const user = await getUnifiedUser();
  if (!user) return empty([]);

  const { data, error } = await serviceSupabase.rpc("get_mart_orders_for_user", {
    p_user_id: user.id,
    p_role: "vendor",
  });

  if (error || !data) return empty([]);
  const orders = limit ? (data as MartVendorOrder[]).slice(0, limit) : (data as MartVendorOrder[]);
  return { data: orders, backendReady: true };
}

export async function getMartOrder(id: string): Promise<QueryResult<MartVendorOrder | null>> {
  const serviceSupabase = getSupabaseServiceClient();
  if (!serviceSupabase) return empty(null);

  const user = await getUnifiedUser();
  if (!user) return empty(null);

  // Check buyer orders first
  const { data: buyerOrders } = await serviceSupabase.rpc("get_mart_orders_for_user", {
    p_user_id: user.id,
    p_role: "buyer",
  });

  const foundBuyer = ((buyerOrders as MartVendorOrder[]) || []).find((o) => o.id === id);
  if (foundBuyer) {
    return { data: foundBuyer, backendReady: true };
  }

  // Check vendor orders
  const { data: vendorOrders } = await serviceSupabase.rpc("get_mart_orders_for_user", {
    p_user_id: user.id,
    p_role: "vendor",
  });

  const foundVendor = ((vendorOrders as MartVendorOrder[]) || []).find((o) => o.id === id);
  if (foundVendor) {
    return { data: foundVendor, backendReady: true };
  }

  return empty(null);
}


export type LedgerPage = { entries: LedgerEntry[]; total: number };

/** Paginated credit ledger query, 20 rows per page, newest first. */
export async function getLedgerPage(page: number, pageSize = 20): Promise<QueryResult<LedgerPage>> {
  const supabase = await getOwnerQueryClient();
  if (!supabase) return empty({ entries: [], total: 0 });

  const user = await getUnifiedUser();
  if (!user) return empty({ entries: [], total: 0 });

  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .from("credit_ledger")
    .select("id, created_at, type, amount, balance_after", { count: "exact" })
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) return empty({ entries: [], total: 0 });
  return {
    data: { entries: (data as LedgerEntry[]) ?? [], total: count ?? 0 },
    backendReady: true,
  };
}

export async function getActiveOrderCount(): Promise<QueryResult<number>> {
  const supabase = await getOwnerQueryClient();
  if (!supabase) return empty(0);

  const user = await getUnifiedUser();
  if (!user) return empty(0);

  const { count, error } = await supabase
    .from("mart_orders")
    .select("id", { count: "exact", head: true })
    .eq("buyer_user_id", user.id)
    .in("status", ["placed", "accepted", "printing", "shipped"]);

  if (error) return empty(0);
  return { data: count ?? 0, backendReady: true };
}


export async function getModelCount(): Promise<QueryResult<number>> {
  const supabase = await getOwnerQueryClient();
  if (!supabase) return empty(0);

  const user = await getUnifiedUser();
  if (!user) return empty(0);

  const { count, error } = await supabase
    .from("models")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  if (error) return empty(0);
  return { data: count ?? 0, backendReady: true };
}

/* ------------------------------------------------------------- Seller side */

export async function getSellerProfile(): Promise<QueryResult<SellerProfile | null>> {
  const supabase = await getOwnerQueryClient();
  if (!supabase) return empty(null);

  let userId: string | null = null;
  if (isClerkConfigured) {
    const profile = await syncClerkProfile();
    userId = profile?.id ?? null;
  }
  if (!userId) {
    const { data: auth } = await supabase.auth.getUser();
    userId = auth.user?.id ?? null;
  }
  if (!userId) return empty(null);

  const { data, error } = await supabase
    .from("seller_profiles")
    .select("id, studio_name, slug, bio, payout_status")
    .eq("id", userId)
    .maybeSingle();

  if (error) return empty(null);
  return { data: (data as SellerProfile) ?? null, backendReady: true };
}

/** Every column the seller's own views need. */
const LISTING_COLUMNS =
  "id, title, slug, description, category, tags, license, price_inr, status, " +
  "thumbnail_url, file_path, file_bytes, downloads, purchases, published_at, created_at";

/* No file_path here: the storage path of the mesh is the one thing a public
   page must never hand out. Buyers get a signed URL after a purchase. */
const PUBLIC_LISTING_COLUMNS =
  "id, title, slug, description, category, tags, license, price_inr, " +
  "thumbnail_url, downloads, purchases, published_at, created_at, " +
  "seller:seller_profiles(studio_name, slug)";

export async function getListings(limit?: number): Promise<QueryResult<Listing[]>> {
  const supabase = await getOwnerQueryClient();
  if (!supabase) return empty([]);

  const user = await getUnifiedUser();
  if (!user) return empty([]);

  let query = supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) return empty([]);
  return { data: (data as unknown as Listing[]) ?? [], backendReady: true };
}

export async function getPublishedListingCount(): Promise<QueryResult<number>> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return empty(0);

  const { count, error } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  if (error) return empty(0);
  return { data: count ?? 0, backendReady: true };
}

export async function getSales(limit?: number): Promise<QueryResult<Sale[]>> {
  const supabase = await getOwnerQueryClient();
  if (!supabase) return empty([]);

  const user = await getUnifiedUser();
  if (!user) return empty([]);

  let query = supabase
    .from("sales")
    .select("id, listing_id, gross_inr, platform_fee_inr, net_inr, created_at")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) return empty([]);
  return { data: (data as Sale[]) ?? [], backendReady: true };
}

/** Lifetime net earnings, in rupees. */
export async function getSellerEarnings(): Promise<QueryResult<number>> {
  const supabase = await getOwnerQueryClient();
  if (!supabase) return empty(0);

  const user = await getUnifiedUser();
  if (!user) return empty(0);

  const { data, error } = await supabase
    .from("sales")
    .select("net_inr")
    .eq("seller_id", user.id);
  if (error) return empty(0);

  const total = ((data as { net_inr: number }[]) ?? []).reduce(
    (sum, row) => sum + row.net_inr,
    0,
  );
  return { data: total, backendReady: true };
}

export async function getPayouts(limit?: number): Promise<QueryResult<Payout[]>> {
  const supabase = await getOwnerQueryClient();
  if (!supabase) return empty([]);

  const user = await getUnifiedUser();
  if (!user) return empty([]);

  let query = supabase
    .from("payouts")
    .select("id, amount_inr, state, reference, created_at, paid_at")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) return empty([]);
  return { data: (data as Payout[]) ?? [], backendReady: true };
}

/** One of the seller's own listings, for the editor. */
export async function getSellerListing(id: string): Promise<QueryResult<Listing | null>> {
  const supabase = await getOwnerQueryClient();
  if (!supabase) return empty(null);

  const user = await getUnifiedUser();
  if (!user) return empty(null);

  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .eq("id", id)
    .eq("seller_id", user.id)
    .maybeSingle();

  if (error) return empty(null);
  return { data: (data as unknown as Listing) ?? null, backendReady: true };
}

/* ---------------------------------------------------------- Public browse */

export async function getPublicListing(slug: string): Promise<QueryResult<PublicListing | null>> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return empty(null);

  const { data, error } = await supabase
    .from("listings")
    .select(PUBLIC_LISTING_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) return empty(null);
  return { data: (data as unknown as PublicListing) ?? null, backendReady: true };
}

/* -------------------------------------------------------------- Admin side */

/**
 * Role check for admin-only data reads. The /admin layout also gates these
 * pages, but a query returning every user's pending data on the strength of
 * one layout check is one refactor away from leaking — verify here too.
 * Returns the service client only when the caller is an admin.
 */
async function getAdminQueryClient(): Promise<SupabaseClient | null> {
  const user = await getUnifiedUser();
  if (!user) return null;

  const serviceSupabase = getSupabaseServiceClient();
  if (!serviceSupabase) return null;

  const { data: profile } = await serviceSupabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.role === "admin" ? serviceSupabase : null;
}

export type AdminListing = Listing & {
  seller: { studio_name: string; slug: string } | null;
};

export async function getAdminPendingListings(): Promise<QueryResult<AdminListing[]>> {
  const client = await getAdminQueryClient();
  if (!client) return empty([]);

  const { data: rpcData, error: rpcError } = await client.rpc("admin_get_pending_listings");
  if (!rpcError && rpcData) {
    return { data: rpcData as AdminListing[], backendReady: true };
  }

  const { data, error } = await client
    .from("listings")
    .select(`${LISTING_COLUMNS}, seller:seller_profiles(studio_name, slug)`)
    .in("status", ["pending", "in_review"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAdminPendingListings error:", error);
    return empty([]);
  }
  return { data: (data as unknown as AdminListing[]) ?? [], backendReady: true };
}

export type AdminPendingModel = {
  id: string;
  title: string;
  slug: string;
  category: string;
  price: number;
  status: string;
  created_at: string;
  seller_name: string;
  thumbnail_url: string | null;
  part_count: number;
  license_type?: string | null;
};

export async function getAdminPendingModels(): Promise<QueryResult<AdminPendingModel[]>> {
  const client = await getAdminQueryClient();
  if (!client) return empty([]);

  const { data: rpcData, error: rpcError } = await client.rpc("admin_get_pending_models");
  if (!rpcError && rpcData) {
    const models: AdminPendingModel[] = (rpcData as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      slug: String(row.slug),
      category: String(row.category || "General"),
      price: Number(row.price || 0),
      status: String(row.status || "pending_review"),
      created_at: String(row.created_at),
      seller_name: String(row.seller_name || "Creator"),
      thumbnail_url: (row.thumbnail_url as string) ?? null,
      part_count: Number(row.part_count || 1),
      license_type: (row.license_type as string) || "standard",
    }));
    return { data: models, backendReady: true };
  }

  const { data, error } = await client
    .from("models")
    .select("id, title, name, slug, category, price, status, license_type, created_at, thumbnail_url, seller:profiles!models_seller_user_id_fkey(full_name)")
    .in("status", ["pending_review", "under_review", "draft"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAdminPendingModels error:", error);
    return empty([]);
  }

  const models: AdminPendingModel[] = ((data as unknown as Array<Record<string, unknown>>) ?? []).map((row) => {
    const seller = row.seller as { full_name: string | null } | null;
    return {
      id: String(row.id),
      title: String(row.title || row.name || "Untitled Model"),
      slug: String(row.slug || row.id),
      category: String(row.category || "General"),
      price: Number(row.price || 0),
      status: String(row.status || "pending_review"),
      created_at: String(row.created_at),
      seller_name: seller?.full_name || "Independent Creator",
      thumbnail_url: (row.thumbnail_url as string) ?? null,
      part_count: 1,
      license_type: (row.license_type as string) || "standard",
    };
  });

  return { data: models, backendReady: true };
}

export type AdminPendingProvider = {
  provider_id: string;
  user_id: string;
  type: "vendor" | "freelancer";
  status: ProviderStatus;
  created_at: string;
  applicant_name: string;
  applicant_email: string;
  admin_notes?: string | null;
  details: {
    business_name?: string;
    location?: string;
    materials_supported?: string[];
    capacity_notes?: string;
    display_name?: string;
    bio?: string;
    skills?: string[];
    portfolio_urls?: string[];
    rate_type?: string;
    base_rate?: number;
    profile_status?: string;
    admin_notes?: string | null;
  };
};

export async function getAdminPendingProviders(typeFilter?: string): Promise<QueryResult<AdminPendingProvider[]>> {
  const client = await getAdminQueryClient();
  if (!client) return empty([]);

  const { data, error } = await client.rpc("admin_get_pending_providers", {
    p_type: typeFilter || null,
  });

  if (error) {
    console.error("getAdminPendingProviders error:", error);
    return empty([]);
  }

  const providers: AdminPendingProvider[] = ((data as Array<Record<string, unknown>>) ?? []).map((row) => ({
    provider_id: String(row.provider_id),
    user_id: String(row.user_id),
    type: row.type as "vendor" | "freelancer",
    status: row.status as ProviderStatus,
    created_at: String(row.created_at),
    applicant_name: String(row.applicant_name || "Applicant"),
    applicant_email: String(row.applicant_email || "No email"),
    admin_notes: (row.admin_notes as string | null) || null,
    details: (row.details as AdminPendingProvider["details"]) || {},
  }));

  return { data: providers, backendReady: true };
}


export type AdminMartOrder = MartOrder & {
  assigned_vendor: string | null;
  vendor_notes: string | null;
  buyer: { id: string; full_name: string | null } | null;
};

export async function getAdminMartOrders(statusFilter?: string): Promise<QueryResult<AdminMartOrder[]>> {
  const client = await getAdminQueryClient();
  if (!client) return empty([]);

  let targetStatus = statusFilter && statusFilter.toLowerCase() !== "all" ? statusFilter : null;
  if (targetStatus && targetStatus.toLowerCase() === "pending moderation") {
    targetStatus = "pending_moderation";
  }

  const { data: rpcData, error: rpcError } = await client.rpc("admin_get_mart_orders", {
    p_status: targetStatus,
  });

  if (!rpcError && rpcData) {
    return { data: rpcData as AdminMartOrder[], backendReady: true };
  }

  let query = client
    .from("mart_orders")
    .select(`
      id,
      reference,
      model_name,
      status,
      total_inr,
      created_at,
      shipping_address,
      assigned_vendor,
      vendor_notes,
      buyer:profiles!mart_orders_buyer_id_fkey(id, full_name)
    `)
    .order("created_at", { ascending: false });

  if (targetStatus) {
    query = query.eq("status", targetStatus);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getAdminMartOrders error:", error);
    return empty([]);
  }
  return { data: (data as unknown as AdminMartOrder[]) ?? [], backendReady: true };
}

/* ----------------------------------------------------------- Models Marketplace */

export type MarketplaceQueryResult = {
  models: MarketplaceModel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getMarketplaceModels(options: {
  search?: string;
  category?: string;
  licenseType?: MarketplaceLicenseType | string;
  sort?: "newest" | "price_low" | "price_high";
  page?: number;
  pageSize?: number;
} = {}): Promise<QueryResult<MarketplaceQueryResult>> {
  const supabase = await getSupabaseServerClient();
  const page = Math.max(options.page ?? 1, 1);
  const pageSize = options.pageSize ?? 12;

  const fallbackEmpty: MarketplaceQueryResult = {
    models: [],
    total: 0,
    page,
    pageSize,
    totalPages: 0,
  };

  if (!supabase) return empty(fallbackEmpty);

  try {
    // 1. Try high-performance Postgres RPC
    const { data: rpcRows, error: rpcError } = await supabase.rpc("get_marketplace_models", {
      p_search: options.search?.trim() || null,
      p_category: options.category?.trim() || null,
      p_license_type: options.licenseType?.trim() || null,
      p_sort: options.sort ?? "newest",
      p_page: page,
      p_page_size: pageSize,
    });

    if (!rpcError && rpcRows) {
      const total = Number(rpcRows[0]?.total_count ?? 0);
      const models: MarketplaceModel[] = rpcRows.map((row: {
        id: string;
        seller_user_id: string | null;
        title: string;
        description: string | null;
        category: string | null;
        license_type: MarketplaceLicenseType;
        price: string | number;
        preview_image_paths: string[] | null;
        status: "draft" | "published";
        created_at: string;
        seller_name: string;
        seller_avatar: string | null;
        formats?: string[];
      }) => ({
        id: row.id,
        seller_user_id: row.seller_user_id,
        title: row.title,
        description: row.description,
        category: row.category,
        license_type: row.license_type,
        price: Number(row.price || 0),
        preview_image_paths: row.preview_image_paths ?? [],
        status: row.status,
        created_at: row.created_at,
        seller_name: row.seller_name,
        seller_avatar: row.seller_avatar,
        formats: row.formats ?? ["STL"],
        seller: row.seller_user_id
          ? {
              id: row.seller_user_id,
              full_name: row.seller_name,
              avatar_url: row.seller_avatar,
            }
          : null,
      }));

      return {
        data: {
          models,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
        backendReady: true,
      };
    }

    // 2. Direct query fallback
    let query = supabase
      .from("models")
      .select(
        "id, seller_user_id, title, description, category, license_type, price, preview_image_paths, status, created_at, seller:profiles!models_seller_user_id_fkey(id, full_name, avatar_url)",
        { count: "exact" }
      )
      .eq("status", "published");

    if (options.category) {
      query = query.ilike("category", options.category);
    }
    if (options.licenseType) {
      query = query.eq("license_type", options.licenseType);
    }
    if (options.search) {
      const escaped = options.search.replace(/[%_]/g, (char) => `\\${char}`);
      query = query.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`);
    }

    if (options.sort === "price_low") {
      query = query.order("price", { ascending: true });
    } else if (options.sort === "price_high") {
      query = query.order("price", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, count, error } = await query;
    if (error) {
      console.error("getMarketplaceModels fallback error:", error);
      return empty(fallbackEmpty);
    }

    const total = count ?? 0;
    const models: MarketplaceModel[] = ((data as unknown as Array<Record<string, unknown>>) ?? []).map((row) => {
      const sellerProfile = row.seller as { id: string; full_name: string | null; avatar_url: string | null } | null;
      return {
        id: String(row.id),
        seller_user_id: (row.seller_user_id as string) ?? null,
        title: String(row.title),
        description: (row.description as string) ?? null,
        category: (row.category as string) ?? null,
        license_type: (row.license_type as MarketplaceLicenseType) ?? "standard",
        price: Number(row.price || 0),
        preview_image_paths: (row.preview_image_paths as string[]) ?? [],
        status: (row.status as "draft" | "published") ?? "published",
        created_at: String(row.created_at),
        seller_name: sellerProfile?.full_name ?? "DripLnk Creator",
        seller_avatar: sellerProfile?.avatar_url ?? null,
        seller: sellerProfile,
      };
    });

    return {
      data: {
        models,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      backendReady: true,
    };
  } catch (err) {
    console.error("getMarketplaceModels error:", err);
    return empty(fallbackEmpty);
  }
}

export async function getMarketplaceModelById(
  modelId: string
): Promise<QueryResult<MarketplaceModel | null>> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return empty(null);

  try {
    const { data: rpcRows, error: rpcError } = await supabase.rpc(
      "get_marketplace_model_by_id",
      { p_model_id: modelId }
    );

    if (!rpcError && rpcRows && rpcRows.length > 0) {
      const row = rpcRows[0];
      const model: MarketplaceModel = {
        id: row.id,
        seller_user_id: row.seller_user_id,
        title: row.title,
        slug: row.slug,
        description: row.description,
        category: row.category,
        license_type: row.license_type,
        price: Number(row.price || 0),
        preview_image_paths: row.preview_image_paths ?? [],
        file_path: row.file_path,
        status: row.status,
        created_at: row.created_at,
        seller_name: row.seller_name,
        seller_avatar: row.seller_avatar,
        formats: row.formats ?? ["STL"],
        files: row.files ?? [],
        images: row.images ?? [],
        license_info: row.license_info ?? null,
        seller: row.seller_user_id
          ? {
              id: row.seller_user_id,
              full_name: row.seller_name,
              avatar_url: row.seller_avatar,
            }
          : null,
      };
      return { data: model, backendReady: true };
    }

    const { data, error } = await supabase
      .from("models")
      .select(
        "id, seller_user_id, title, slug, description, category, license_type, price, preview_image_paths, file_path, status, created_at, seller:profiles!models_seller_user_id_fkey(id, full_name, avatar_url)"
      )
      .eq("id", modelId)
      .eq("status", "published")
      .maybeSingle();

    if (error || !data) return empty(null);

    const sellerProfile = (Array.isArray(data.seller) ? data.seller[0] : data.seller) as unknown as {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
    } | null;
    const model: MarketplaceModel = {
      id: data.id,
      seller_user_id: data.seller_user_id,
      title: data.title,
      slug: data.slug,
      description: data.description,
      category: data.category,
      license_type: data.license_type,
      price: Number(data.price || 0),
      preview_image_paths: data.preview_image_paths ?? [],
      file_path: data.file_path,
      status: data.status,
      created_at: data.created_at,
      seller_name: sellerProfile?.full_name ?? "DripLnk Creator",
      seller_avatar: sellerProfile?.avatar_url ?? null,
      formats: ["STL", "STEP", "3MF"],
      seller: sellerProfile,
    };

    return { data: model, backendReady: true };
  } catch (err) {
    console.error("getMarketplaceModelById error:", err);
    return empty(null);
  }
}

export async function isModelAcquired(
  modelId: string,
  userId?: string
): Promise<boolean> {
  const supabase = await getOwnerQueryClient();
  if (!supabase) return false;

  let targetUserId = userId;
  if (!targetUserId) {
    const user = await getUnifiedUser();
    if (!user) return false;
    targetUserId = user.id;
  }

  const { data } = await supabase
    .from("model_acquisitions")
    .select("id")
    .eq("user_id", targetUserId)
    .eq("model_id", modelId)
    .maybeSingle();

  return Boolean(data);
}

export async function getUserAcquiredModels(): Promise<QueryResult<AcquiredModel[]>> {
  const serviceSupabase = getSupabaseServiceClient();
  if (!serviceSupabase) return empty([]);

  // Strictly server-verified session: never trust a client-supplied user id
  const user = await getUnifiedUser();
  if (!user) return empty([]);

  try {
    const { data: rpcRows, error: rpcError } = await serviceSupabase.rpc(
      "get_user_model_acquisitions",
      { p_user_id: user.id }
    );

    if (!rpcError && rpcRows) {
      const models: AcquiredModel[] = rpcRows.map((row: {
        acquisition_id: string;
        acquired_at: string;
        license_type: MarketplaceLicenseType;
        model_id: string;
        title: string;
        description: string | null;
        category: string | null;
        price: string | number;
        preview_image_paths: string[] | null;
        file_path: string;
        seller_name: string;
        formats?: string[];
      }) => ({
        acquisition_id: row.acquisition_id,
        acquired_at: row.acquired_at,
        license_type: row.license_type,
        model_id: row.model_id,
        title: row.title,
        description: row.description,
        category: row.category,
        price: Number(row.price || 0),
        preview_image_paths: row.preview_image_paths ?? [],
        file_path: row.file_path,
        seller_name: row.seller_name,
        formats: row.formats ?? ["STL"],
      }));

      return { data: models, backendReady: true };
    }

    const { data, error } = await serviceSupabase
      .from("model_acquisitions")
      .select(`
        id,
        acquired_at,
        license_type,
        model:models(
          id,
          title,
          description,
          category,
          price,
          preview_image_paths,
          file_path,
          seller:profiles!models_seller_user_id_fkey(full_name)
        )
      `)
      .eq("user_id", user.id)
      .order("acquired_at", { ascending: false });

    if (error || !data) return empty([]);

    const acquired: AcquiredModel[] = (data as unknown as Array<{
      id: string;
      acquired_at: string;
      license_type: MarketplaceLicenseType;
      model: {
        id: string;
        title: string;
        description: string | null;
        category: string | null;
        price: number;
        preview_image_paths: string[];
        file_path: string;
        seller: { full_name: string | null } | null;
      };
    }>).map((item) => ({
      acquisition_id: item.id,
      acquired_at: item.acquired_at,
      license_type: item.license_type,
      model_id: item.model.id,
      title: item.model.title,
      description: item.model.description,
      category: item.model.category,
      price: Number(item.model.price || 0),
      preview_image_paths: item.model.preview_image_paths ?? [],
      file_path: item.model.file_path,
      seller_name: item.model.seller?.full_name ?? "DripLnk Creator",
    }));

    return { data: acquired, backendReady: true };
  } catch (err) {
    console.error("getUserAcquiredModels error:", err);
    return empty([]);
  }
}

export async function getMarketplaceCategoryCounts(): Promise<
  QueryResult<Record<string, number>>
> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return empty({});

  const { data, error } = await supabase
    .from("models")
    .select("category")
    .eq("status", "published");

  if (error || !data) return empty({});

  const counts: Record<string, number> = {};
  for (const row of data as { category: string | null }[]) {
    if (row.category) {
      counts[row.category] = (counts[row.category] ?? 0) + 1;
    }
  }
  return { data: counts, backendReady: true };
}

export type MarketplaceCategoryItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  subcategories: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    sort_order: number;
  }[];
};

export async function getMarketplaceCategoriesHierarchy(): Promise<
  QueryResult<MarketplaceCategoryItem[]>
> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return empty([]);

  const { data, error } = await supabase
    .from("categories")
    .select("id, parent_id, name, slug, description, sort_order")
    .order("sort_order", { ascending: true });

  if (error || !data) return empty([]);

  const parents: MarketplaceCategoryItem[] = [];
  const childrenMap = new Map<string, typeof data>();

  for (const row of data) {
    if (row.parent_id) {
      const arr = childrenMap.get(row.parent_id) ?? [];
      arr.push(row);
      childrenMap.set(row.parent_id, arr);
    } else {
      parents.push({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        sort_order: row.sort_order ?? 999,
        subcategories: [],
      });
    }
  }

  for (const parent of parents) {
    const subs = childrenMap.get(parent.id) ?? [];
    parent.subcategories = subs.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description,
      sort_order: s.sort_order ?? 999,
    }));
  }

  return { data: parents, backendReady: true };
}

/* ----------------------------------------------------------- Freelance queries */

export type FreelanceBrowseResult = {
  profiles: FreelancerProfile[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getFreelanceBrowseProfiles(options: {
  search?: string;
  skill?: string;
  rateType?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<QueryResult<FreelanceBrowseResult>> {
  const supabase = await getSupabaseServerClient();
  const page = Math.max(options.page ?? 1, 1);
  const pageSize = options.pageSize ?? 12;

  const fallback: FreelanceBrowseResult = {
    profiles: [],
    total: 0,
    page,
    pageSize,
    totalPages: 0,
  };

  if (!supabase) return empty(fallback);

  try {
    const { data: rpcRows, error: rpcErr } = await supabase.rpc("get_freelance_browse_profiles", {
      p_search: options.search?.trim() || null,
      p_skill: options.skill?.trim() || null,
      p_rate_type: options.rateType && options.rateType !== "all" ? options.rateType : null,
      p_page: page,
      p_page_size: pageSize,
    });

    if (!rpcErr && rpcRows) {
      const total = Number(rpcRows[0]?.total_count ?? 0);
      const profiles: FreelancerProfile[] = rpcRows.map((r: {
        provider_id: string;
        user_id: string;
        display_name: string;
        bio: string | null;
        skills: string[] | null;
        portfolio_urls: string[] | null;
        rate_type: "hourly" | "fixed";
        base_rate: number | string;
        avatar_url: string | null;
      }) => ({
        provider_id: r.provider_id,
        user_id: r.user_id,
        display_name: r.display_name,
        bio: r.bio,
        skills: r.skills ?? [],
        portfolio_urls: r.portfolio_urls ?? [],
        rate_type: r.rate_type,
        base_rate: Number(r.base_rate),
        avatar_url: r.avatar_url,
      }));

      return {
        data: {
          profiles,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
        backendReady: true,
      };
    }

    // Direct query fallback
    let query = supabase
      .from("freelancer_profiles")
      .select("provider_id, display_name, bio, skills, portfolio_urls, rate_type, base_rate, updated_at, provider:providers!inner(id, user_id, status, profile:profiles(avatar_url))", { count: "exact" })
      .eq("provider.status", "approved");

    if (options.rateType && options.rateType !== "all") {
      query = query.eq("rate_type", options.rateType);
    }
    if (options.search) {
      const escaped = options.search.replace(/[%_]/g, (c) => `\\${c}`);
      query = query.or(`display_name.ilike.%${escaped}%,bio.ilike.%${escaped}%`);
    }

    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, count, error } = await query;
    if (error || !data) {
      return empty(fallback);
    }

    const total = count ?? 0;
    const profiles: FreelancerProfile[] = (data as unknown as Array<Record<string, unknown>>).map((row) => {
      const prov = row.provider as { id: string; user_id: string; status: string; profile?: { avatar_url: string | null } } | null;
      return {
        provider_id: String(row.provider_id),
        user_id: prov?.user_id,
        display_name: String(row.display_name),
        bio: (row.bio as string) ?? null,
        skills: (row.skills as string[]) ?? [],
        portfolio_urls: (row.portfolio_urls as string[]) ?? [],
        rate_type: (row.rate_type as "hourly" | "fixed") ?? "hourly",
        base_rate: Number(row.base_rate || 0),
        avatar_url: prov?.profile?.avatar_url ?? null,
        updated_at: (row.updated_at as string) ?? undefined,
      };
    });

    return {
      data: {
        profiles,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      backendReady: true,
    };
  } catch (err) {
    console.error("getFreelanceBrowseProfiles error:", err);
    return empty(fallback);
  }
}

export async function getFreelancerProfileById(
  providerId: string
): Promise<QueryResult<FreelancerProfile | null>> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return empty(null);

  try {
    const { data: rpcRows, error: rpcErr } = await supabase.rpc(
      "get_freelancer_profile_by_id",
      { p_provider_id: providerId }
    );

    if (!rpcErr && rpcRows && rpcRows.length > 0) {
      const row = rpcRows[0];
      const profile: FreelancerProfile = {
        provider_id: row.provider_id,
        user_id: row.user_id,
        display_name: row.display_name,
        bio: row.bio,
        skills: row.skills ?? [],
        portfolio_urls: row.portfolio_urls ?? [],
        rate_type: row.rate_type,
        base_rate: Number(row.base_rate || 0),
        avatar_url: row.avatar_url,
        updated_at: row.updated_at,
      };
      return { data: profile, backendReady: true };
    }

    const { data, error } = await supabase
      .from("freelancer_profiles")
      .select("provider_id, display_name, bio, skills, portfolio_urls, rate_type, base_rate, updated_at, provider:providers!inner(id, user_id, status)")
      .eq("provider_id", providerId)
      .eq("provider.status", "approved")
      .maybeSingle();

    if (error || !data) return empty(null);

    const row = data as unknown as {
      provider_id: string;
      display_name: string;
      bio: string | null;
      skills: string[] | null;
      portfolio_urls: string[] | null;
      rate_type: "hourly" | "fixed";
      base_rate: number | string;
      updated_at: string;
      provider?: { user_id: string };
    };

    const profile: FreelancerProfile = {
      provider_id: row.provider_id,
      user_id: row.provider?.user_id,
      display_name: row.display_name,
      bio: row.bio,
      skills: row.skills ?? [],
      portfolio_urls: row.portfolio_urls ?? [],
      rate_type: row.rate_type,
      base_rate: Number(row.base_rate || 0),
      avatar_url: null,
      updated_at: row.updated_at,
    };

    return { data: profile, backendReady: true };
  } catch (err) {
    console.error("getFreelancerProfileById error:", err);
    return empty(null);
  }
}

export async function getMyFreelanceProvider(): Promise<QueryResult<Provider | null>> {
  const supabase = await getOwnerQueryClient();
  if (!supabase) return empty(null);

  const user = await getUnifiedUser();
  if (!user) return empty(null);

  try {
    const { data, error } = await supabase
      .from("providers")
      .select("id, user_id, type, status, admin_notes, created_at")
      .eq("user_id", user.id)
      .eq("type", "freelancer")
      .maybeSingle();

    if (error || !data) return empty(null);
    return { data: data as Provider, backendReady: true };
  } catch (err) {
    console.error("getMyFreelanceProvider error:", err);
    return empty(null);
  }
}

export async function getApprovedVendorCount(): Promise<QueryResult<number>> {
  const serviceSupabase = getSupabaseServiceClient();
  const supabase = serviceSupabase ?? (await getSupabaseServerClient());
  if (!supabase) return empty(0);

  try {
    const { count, error } = await supabase
      .from("providers")
      .select("*", { count: "exact", head: true })
      .eq("type", "vendor")
      .eq("status", "approved");

    if (error) {
      console.error("getApprovedVendorCount error:", error);
      return empty(0);
    }
    return { data: count ?? 0, backendReady: true };
  } catch (err) {
    console.error("getApprovedVendorCount error:", err);
    return empty(0);
  }
}

export async function getBuyerFreelanceRequests(): Promise<QueryResult<FreelanceRequest[]>> {
  const serviceSupabase = getSupabaseServiceClient();
  const supabase = await getSupabaseServerClient();
  const client = serviceSupabase ?? supabase;
  if (!client) return empty([]);

  const user = await getUnifiedUser();
  if (!user) return empty([]);

  try {
    const { data: rpcRows, error: rpcErr } = await client.rpc("get_freelance_requests_for_user", {
      p_user_id: user.id,
      p_role: "buyer",
    });

    if (!rpcErr && rpcRows) {
      const requests: FreelanceRequest[] = rpcRows.map((r: {
        request_id: string;
        buyer_user_id: string;
        freelancer_provider_id: string;
        freelancer_user_id: string;
        brief: string;
        reference_file_paths: string[] | null;
        agreed_price: number | string | null;
        status: FreelanceRequest["status"];
        final_file_path: string | null;
        created_at: string;
        updated_at: string;
        buyer_name: string | null;
        buyer_avatar: string | null;
        buyer_email: string | null;
        freelancer_name: string | null;
        freelancer_avatar: string | null;
        freelancer_email: string | null;
      }) => ({
        id: r.request_id,
        buyer_user_id: r.buyer_user_id,
        freelancer_provider_id: r.freelancer_provider_id,
        freelancer_user_id: r.freelancer_user_id,
        brief: r.brief,
        reference_file_paths: r.reference_file_paths ?? [],
        agreed_price: r.agreed_price !== null ? Number(r.agreed_price) : null,
        status: r.status,
        final_file_path: r.final_file_path,
        created_at: r.created_at,
        updated_at: r.updated_at,
        buyer_name: r.buyer_name ?? "Buyer",
        buyer_avatar: r.buyer_avatar,
        buyer_email: r.buyer_email,
        freelancer_name: r.freelancer_name ?? "Freelancer",
        freelancer_avatar: r.freelancer_avatar,
        freelancer_email: r.freelancer_email,
      }));
      return { data: requests, backendReady: true };
    }

    const { data, error } = await client
      .from("freelance_requests")
      .select("id, buyer_user_id, freelancer_provider_id, brief, reference_file_paths, agreed_price, status, final_file_path, created_at, updated_at")
      .eq("buyer_user_id", user.id)
      .order("created_at", { ascending: false });

    if (error || !data) return empty([]);
    return { data: (data as unknown as FreelanceRequest[]), backendReady: true };
  } catch (err) {
    console.error("getBuyerFreelanceRequests error:", err);
    return empty([]);
  }
}

export async function getFreelancerIncomingRequests(): Promise<QueryResult<FreelanceRequest[]>> {
  const serviceSupabase = getSupabaseServiceClient();
  const supabase = await getSupabaseServerClient();
  const client = serviceSupabase ?? supabase;
  if (!client) return empty([]);

  const user = await getUnifiedUser();
  if (!user) return empty([]);

  try {
    const { data: rpcRows, error: rpcErr } = await client.rpc("get_freelance_requests_for_user", {
      p_user_id: user.id,
      p_role: "freelancer",
    });

    if (!rpcErr && rpcRows) {
      const requests: FreelanceRequest[] = rpcRows.map((r: {
        request_id: string;
        buyer_user_id: string;
        freelancer_provider_id: string;
        freelancer_user_id: string;
        brief: string;
        reference_file_paths: string[] | null;
        agreed_price: number | string | null;
        status: FreelanceRequest["status"];
        final_file_path: string | null;
        created_at: string;
        updated_at: string;
        buyer_name: string | null;
        buyer_avatar: string | null;
        buyer_email: string | null;
        freelancer_name: string | null;
        freelancer_avatar: string | null;
        freelancer_email: string | null;
      }) => ({
        id: r.request_id,
        buyer_user_id: r.buyer_user_id,
        freelancer_provider_id: r.freelancer_provider_id,
        freelancer_user_id: r.freelancer_user_id,
        brief: r.brief,
        reference_file_paths: r.reference_file_paths ?? [],
        agreed_price: r.agreed_price !== null ? Number(r.agreed_price) : null,
        status: r.status,
        final_file_path: r.final_file_path,
        created_at: r.created_at,
        updated_at: r.updated_at,
        buyer_name: r.buyer_name ?? "Buyer",
        buyer_avatar: r.buyer_avatar,
        buyer_email: r.buyer_email,
        freelancer_name: r.freelancer_name ?? "Freelancer",
        freelancer_avatar: r.freelancer_avatar,
        freelancer_email: r.freelancer_email,
      }));
      return { data: requests, backendReady: true };
    }

    return empty([]);
  } catch (err) {
    console.error("getFreelancerIncomingRequests error:", err);
    return empty([]);
  }
}

