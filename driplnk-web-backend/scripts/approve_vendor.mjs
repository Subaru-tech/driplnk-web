#!/usr/bin/env node

/**
 * Manual Vendor Approval & Pricing Seed Script
 * ============================================
 * Usage:
 *   node driplnk-web-backend/scripts/approve_vendor.mjs <provider_id_or_business_name>
 *   node driplnk-web-backend/scripts/approve_vendor.mjs --seed-second
 *
 * This script is used by the founder to manually review and approve pending vendor
 * applications and establish their pricing rules in Supabase.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ANON_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const DEFAULT_PRICING_RULES = [
  { material: "pla", price_per_gram: 2.4, min_order_price: 200, active: true },
  { material: "petg", price_per_gram: 2.9, min_order_price: 250, active: true },
  { material: "abs", price_per_gram: 3.4, min_order_price: 300, active: true },
  { material: "resin", price_per_gram: 6.8, min_order_price: 450, active: true },
  { material: "nylon-cf", price_per_gram: 9.5, min_order_price: 700, active: true },
];

async function approveVendor(providerIdOrName, customRules = DEFAULT_PRICING_RULES) {
  console.log(`Approving vendor provider for identifier "${providerIdOrName}" and setting ${customRules.length} pricing rules...`);

  const { data, error } = await supabase.rpc("admin_approve_vendor_and_set_pricing", {
    p_identifier: providerIdOrName,
    p_pricing_rules: customRules,
  });

  if (error) {
    console.error("Approval error:", error);
    process.exit(1);
  }

  console.log("Vendor approval successful!");
  console.log("Result:", data);
}


async function seedSecondVendor() {
  console.log("Seeding a second distinct approved vendor for multi-vendor comparison...");
  // User 3345ed81-f953-4bff-b1f5-f32aca16fbff (Aman Gupta)
  const secondaryUserId = "3345ed81-f953-4bff-b1f5-f32aca16fbff";

  const { data: providerId, error: applyErr } = await supabase.rpc("apply_vendor_profile", {
    p_user_id: secondaryUserId,
    p_business_name: "Zenith Prototyping Hub",
    p_location: "Pune, MH",
    p_materials_supported: ["pla", "petg", "abs", "resin"],
    p_capacity_notes: "Fleet of 6x Prusa MK4, 2x Bambu Lab X1C, Formlabs Form 4. 24h rapid dispatch.",
  });

  if (applyErr) {
    console.error("Failed to create secondary vendor application:", applyErr);
    process.exit(1);
  }

  const secondaryRules = [
    { material: "pla", price_per_gram: 2.65, min_order_price: 180, active: true },
    { material: "petg", price_per_gram: 3.1, min_order_price: 220, active: true },
    { material: "abs", price_per_gram: 3.5, min_order_price: 280, active: true },
    { material: "resin", price_per_gram: 7.2, min_order_price: 400, active: true },
  ];

  await approveVendor(providerId, secondaryRules);
  console.log(`Secondary vendor "Zenith Prototyping Hub" created and approved with ID: ${providerId}`);
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.log("Usage: node approve_vendor.mjs <provider_id | business_name>");
    console.log("       node approve_vendor.mjs --seed-second");
    process.exit(0);
  }

  if (arg === "--seed-second") {
    await seedSecondVendor();
  } else {
    await approveVendor(arg);
  }
}

main().catch(console.error);
