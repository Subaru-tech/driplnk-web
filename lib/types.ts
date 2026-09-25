import type { OrderStatus } from "@/components/ui/status-pill";

/**
 * Shapes the dashboard reads from Supabase (Track 2).
 *
 * These describe the contract the UI is written against. Until the tables
 * exist, every query returns an empty result and the UI renders its real empty
 * state — no placeholder rows, ever.
 */

export type Profile = {
  id: string;
  full_name: string | null;
  email?: string | null;
  avatar_url: string | null;
  credits_balance: number;
  role?: "creator" | "seller" | "admin";
};

export type Model = {
  id: string;
  name: string;
  thumbnail_url: string | null;
  /** Path inside the private `model-files` bucket. Null for models made in
      the desktop app before browser upload existed. */
  storage_path: string | null;
  credits_spent: number;
  created_at: string;
};

export type MartOrder = {
  id: string;
  /** Short human-facing reference, e.g. "DL-4821". Rendered in mono. */
  reference: string;
  model_name: string;
  status: OrderStatus;
  total_inr: number;
  created_at: string;
  shipping_address: string | null;
  assigned_vendor?: string | null;
  vendor_notes?: string | null;
  buyer?: { id: string; full_name: string | null } | null;
};

export type LedgerEntryType = "Generation" | "Purchase" | "Refund";

export type LedgerEntry = {
  id: string;
  created_at: string;
  type: LedgerEntryType;
  /** Positive for additions, negative for deductions. */
  amount: number;
  balance_after: number;
};

export type SessionRecord = {
  id: string;
  /** Best-effort device/browser guess, e.g. "Chrome on Linux". */
  device: string;
  last_active_at: string;
  is_current: boolean;
};

/* ------------------------------------------------------------- Seller side */

export type SellerProfile = {
  id: string;
  studio_name: string;
  slug: string;
  bio: string | null;
  /** unverified until payout details are confirmed with the provider. */
  payout_status: "unverified" | "pending" | "verified" | "rejected";
};

export type ListingStatus = "draft" | "in_review" | "published" | "rejected" | "archived" | "pending";

export type Listing = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  tags: string[];
  license: string;
  price_inr: number;
  status: ListingStatus;
  thumbnail_url: string | null;
  file_path: string | null;
  file_bytes: number | null;
  downloads: number;
  purchases: number;
  published_at: string | null;
  created_at: string;
};

/** A published listing as the public marketplace sees it: the listing plus
    the storefront it belongs to. The mesh path is deliberately absent — the
    file is the thing being sold. */
export type PublicListing = Omit<Listing, "file_path" | "file_bytes" | "status"> & {
  seller: { studio_name: string; slug: string } | null;
};

export type Sale = {
  id: string;
  listing_id: string;
  gross_inr: number;
  platform_fee_inr: number;
  net_inr: number;
  created_at: string;
};

export type PayoutState = "scheduled" | "processing" | "paid" | "failed";

export type Payout = {
  id: string;
  amount_inr: number;
  state: PayoutState;
  reference: string | null;
  created_at: string;
  paid_at: string | null;
};

/** A model the user has access to — free claim now, purchase later. */
export type LibraryItem = {
  id: string;
  listing_id: string;
  source: "free" | "purchase" | "gift";
  acquired_at: string;
  listing: {
    id: string;
    title: string;
    slug: string;
    thumbnail_url: string | null;
    file_path: string | null;
    license: string;
    seller: { studio_name: string } | null;
  } | null;
};

export type MarketplaceLicenseType = "standard" | "cc" | "commercial" | "personal" | "custom" | string;
export type MarketplaceModelStatus = "draft" | "pending_review" | "published" | "rejected" | "archived";

export type ModelFileRecord = {
  id: string;
  filename: string;
  format: string;
  file_size: number;
  is_primary: boolean;
  storage_path?: string;
};

export type ModelImageRecord = {
  id: string;
  thumbnail_url: string;
  is_cover: boolean;
  alt_text?: string | null;
};

export type LicenseInfoRecord = {
  name: string;
  description: string;
  allows_commercial: boolean;
  allows_remix: boolean;
};

export type CategoryRecord = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
};

export type LicenseRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  allows_commercial: boolean;
  allows_remix: boolean;
  requires_attribution: boolean;
  is_custom: boolean;
};

export type ModelVersionRecord = {
  id: string;
  model_id: string;
  version_number: string;
  changelog: string | null;
  created_at: string;
  is_current: boolean;
};

export type MarketplaceModel = {
  id: string;
  seller_user_id: string | null;
  title: string;
  slug?: string;
  description: string | null;
  category: string | null;
  license_type: MarketplaceLicenseType;
  price: number;
  preview_image_paths: string[];
  file_path?: string;
  status: MarketplaceModelStatus;
  created_at: string;
  seller_name?: string;
  seller_avatar?: string | null;
  formats?: string[];
  files?: ModelFileRecord[];
  images?: ModelImageRecord[];
  license_info?: LicenseInfoRecord | null;
  seller?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export type AcquiredModel = {
  acquisition_id: string;
  acquired_at: string;
  license_type: MarketplaceLicenseType;
  model_id: string;
  title: string;
  description: string | null;
  category: string | null;
  price: number;
  preview_image_paths: string[];
  file_path: string;
  seller_name: string;
  formats?: string[];
};

/* ----------------------------------------------------------- Freelance side */

export type ProviderType = "vendor" | "seller" | "freelancer";
export type ProviderStatus = "pending" | "approved" | "rejected" | "changes_requested";

export type Provider = {
  id: string;
  user_id: string;
  type: ProviderType;
  status: ProviderStatus;
  admin_notes?: string | null;
  created_at: string;
};

export type RateType = "hourly" | "fixed";

export type FreelancerProfile = {
  provider_id: string;
  user_id?: string;
  display_name: string;
  bio: string | null;
  skills: string[];
  portfolio_urls: string[];
  rate_type: RateType;
  base_rate: number;
  avatar_url?: string | null;
  status?: ProviderStatus;
  admin_notes?: string | null;
  updated_at?: string;
};

export type FreelanceRequestStatus =
  | "requested"
  | "accepted"
  | "in_progress"
  | "delivered"
  | "completed"
  | "cancelled";

export type FreelanceRequest = {
  id: string;
  buyer_user_id: string;
  freelancer_provider_id: string;
  freelancer_user_id?: string;
  brief: string;
  reference_file_paths: string[];
  agreed_price: number | null;
  status: FreelanceRequestStatus;
  final_file_path: string | null;
  created_at: string;
  updated_at: string;
  buyer_name?: string;
  buyer_avatar?: string | null;
  buyer_email?: string | null;
  freelancer_name?: string;
  freelancer_avatar?: string | null;
  freelancer_email?: string | null;
};

/* ------------------------------------------------------------- Vendor side */

export type VendorProfile = {
  provider_id: string;
  business_name: string;
  location: string | null;
  materials_supported: string[];
  capacity_notes: string | null;
  status?: ProviderStatus;
  admin_notes?: string | null;
  updated_at?: string;
};

export type VendorPricingRule = {
  id: string;
  provider_id: string;
  material: string;
  price_per_gram: number;
  min_order_price: number;
  active: boolean;
  created_at?: string;
};

export type QuoteRequest = {
  id: string;
  user_id: string;
  file_path: string;
  material: string | null;
  weight_g: number | null;
  status: "pending" | "weighed" | "failed";
  created_at?: string;
};

export type MartOrderStatus =
  | "placed"
  | "accepted"
  | "printing"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled";

export type VendorQuoteItem = {
  provider_id: string;
  business_name: string;
  location: string | null;
  price: number;
  material: string;
};

export type MartVendorOrder = {
  id: string;
  quote_request_id: string;
  buyer_user_id: string;
  provider_id: string;
  price: number;
  material: string;
  status: MartOrderStatus;
  file_path?: string;
  weight_g?: number;
  created_at: string;
  updated_at: string;
  counterparty_name?: string;
  counterparty_email?: string | null;
  counterparty_location?: string | null;
};



