import type { ListingStatus } from "@/lib/types";

/**
 * The marketplace vocabulary — categories, licences, statuses.
 *
 * Kept in one place because three surfaces render from it: the seller's
 * listing editor, the public browse filters, and the public model page. A
 * category added here shows up in all three, and the database's CHECK
 * constraint mirrors this list (migration 1000).
 */

export const CATEGORIES = {
  mechanical: "Mechanical",
  robotics: "Robotics",
  electronics: "Electronics",
  tools: "Tools & Jigs",
  enclosures: "Enclosures",
  replacement: "Replacement Parts",
  educational: "Educational",
  decorative: "Decorative",
  art: "Art & Decor",
  toys: "Toys & Games",
  cosplay: "Cosplay & Props",
  architecture: "Architecture",
  accessories: "Accessories",
  other: "Other",
} as const;

export type Category = keyof typeof CATEGORIES;

export const CATEGORY_LIST = Object.entries(CATEGORIES).map(([id, label]) => ({
  id: id as Category,
  label,
}));

/**
 * Real subcategories synced with public.categories table hierarchy.
 */
export const SUBCATEGORIES_BY_CATEGORY: Record<string, { id: string; label: string }[]> = {
  mechanical: [
    { id: "mechanical-brackets", label: "Brackets & Mounts" },
    { id: "mechanical-gears", label: "Gears & Pulleys" },
    { id: "mechanical-linear", label: "Linear Motion" },
  ],
  robotics: [
    { id: "robotics-chassis", label: "Chassis & Frames" },
    { id: "robotics-grippers", label: "Arms & Grippers" },
    { id: "robotics-sensors", label: "Sensor Mounts" },
  ],
  electronics: [
    { id: "electronics-dev-boards", label: "Arduino & Pi Cases" },
    { id: "electronics-cable-mgmt", label: "Cable Management" },
  ],
};

export const MODEL_FORMATS = ["STL", "STEP", "3MF", "OBJ"] as const;
export type ModelFormat = typeof MODEL_FORMATS[number];

export const PRINT_MATERIALS = ["PLA", "PETG", "ABS", "TPU"] as const;
export type PrintMaterial = typeof PRINT_MATERIALS[number];

/** Model formats and metadata helpers */
export function getModelStats() {
  const formats: ModelFormat[] = ["STL", "STEP", "3MF"];
  return { formats };
}

export function isCategory(value: string | undefined): value is Category {
  return Boolean(value && value in CATEGORIES);
}

/**
 * Licences. A small fixed set on purpose — free-text terms on a marketplace
 * are unenforceable and leave buyers guessing what they actually bought.
 */
export const LICENSES = {
  personal: {
    label: "Personal use",
    summary: "Print and modify for yourself. No reselling, no commercial use.",
  },
  commercial: {
    label: "Commercial use",
    summary: "Print and sell physical copies. The file itself stays yours to keep, not resell.",
  },
  remix: {
    label: "Remix & share",
    summary: "Modify and republish with credit to the original creator.",
  },
  free: {
    label: "Free",
    summary: "Free to download and use. Credit appreciated, not required.",
  },
} as const;

export type License = keyof typeof LICENSES;

export const LICENSE_LIST = Object.entries(LICENSES).map(([id, value]) => ({
  id: id as License,
  ...value,
}));

export function isLicense(value: string | undefined): value is License {
  return Boolean(value && value in LICENSES);
}

export const MODEL_LICENSES = {
  standard: {
    label: "Standard License",
    badge: "Standard",
    summary: "Personal non-commercial 3D printing and private modification.",
  },
  cc: {
    label: "Creative Commons (CC-BY)",
    badge: "Creative Commons",
    summary: "Free to print, remix, and share with attribution.",
  },
  commercial: {
    label: "Commercial License",
    badge: "Commercial",
    summary: "Permits printing and selling finished physical prints commercially.",
  },
} as const;

export type ModelLicenseType = keyof typeof MODEL_LICENSES;

export const MODEL_LICENSE_LIST = Object.entries(MODEL_LICENSES).map(([id, value]) => ({
  id: id as ModelLicenseType,
  ...value,
}));

export function isModelLicense(value: string | undefined): value is ModelLicenseType {
  return Boolean(value && value in MODEL_LICENSES);
}

/** Sort options on the browse page. */
export const LISTING_SORTS = {
  newest: { label: "Newest", column: "published_at", ascending: false },
  popular: { label: "Most bought", column: "purchases", ascending: false },
  price_low: { label: "Price: low to high", column: "price_inr", ascending: true },
  price_high: { label: "Price: high to low", column: "price_inr", ascending: false },
} as const;

export type ListingSort = keyof typeof LISTING_SORTS;

export function isListingSort(value: string | undefined): value is ListingSort {
  return Boolean(value && value in LISTING_SORTS);
}

/** What's still needed before a draft can go live. Empty means it's ready. */
export function publishBlockers(listing: {
  title: string;
  description: string | null;
  category: string | null;
  file_path: string | null;
}): string[] {
  const blockers: string[] = [];
  if (!listing.file_path) blockers.push("Upload the model file");
  if (!listing.title?.trim()) blockers.push("Add a title");
  if (!listing.description?.trim()) blockers.push("Write a description");
  if (!listing.category) blockers.push("Pick a category");
  return blockers;
}

export const STATUS_LABELS: Record<ListingStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  pending: "Pending",
  published: "Published",
  rejected: "Rejected",
  archived: "Archived",
};
