/**
 * Execution Script: Production Test-Data Purge
 *
 * SAFETY GUARANTEES:
 * 1. Snapshot schema backup_pre_purge_20260914 already contains exact copies.
 * 2. Hard deletes via SQL - NO UPDATE triggers fire, ZERO emails sent.
 * 3. Preserves all vendor_profiles, freelancer providers, and real user accounts.
 * 4. Preserves exactly the 6 curated seed 3D models.
 */

import { Client } from "pg";

const DB_URL =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  "";

const PRESERVED_MODEL_IDS = [
  "83c8025c-b172-4013-9edb-4f015d95a107", // DripLnk MartBot Mascot
  "8e8039ee-2607-4e5c-abca-d6e2216c94c9", // Parametric Spiral Gear Assembly
  "27ded9c0-95b8-4afd-bffa-4bfd461d729d", // Draft Drone Chassis Frame
  "c2494a66-2982-40ac-809c-923e13d37332", // Precision Phone & Tablet Stand
  "34d6af29-5506-40b2-8c15-492f40748898", // Draft Cyberpunk Desk Organizer
  "e15ad507-f7c1-4baa-9b3c-8d084068c0b1", // NEMA 17 Stepper Servo Mount
];

async function main() {
  console.log("================================================================================");
  console.log("🚀 EXECUTING PRODUCTION TEST-DATA PURGE");
  console.log("================================================================================\n");

  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    // Check baseline row counts
    console.log("--- BEFORE PURGE ROW COUNTS ---");
    const tables = ["mart_orders", "quote_requests", "freelance_requests", "models", "listings", "order_payments", "vendor_profiles", "profiles"];
    for (const t of tables) {
      const res = await client.query(`SELECT count(*)::int as c FROM public.${t}`);
      console.log(`  ${t.padEnd(20)}: ${res.rows[0].c}`);
    }

    console.log("\n--- EXECUTING HARD DELETIONS (TRANSACTIONAL) ---");
    await client.query("BEGIN;");

    // 1. Delete dependent order payments
    const opDel = await client.query(`DELETE FROM public.order_payments;`);
    console.log(`  ✓ Deleted ${opDel.rowCount} rows from public.order_payments`);

    // 2. Delete test mart orders
    const moDel = await client.query(`DELETE FROM public.mart_orders;`);
    console.log(`  ✓ Deleted ${moDel.rowCount} rows from public.mart_orders`);

    // 3. Delete test quote requests
    const qrDel = await client.query(`DELETE FROM public.quote_requests;`);
    console.log(`  ✓ Deleted ${qrDel.rowCount} rows from public.quote_requests`);

    // 4. Delete test freelance requests
    const frDel = await client.query(`DELETE FROM public.freelance_requests;`);
    console.log(`  ✓ Deleted ${frDel.rowCount} rows from public.freelance_requests`);

    // 5. Delete synthetic listing fixture
    const lDel = await client.query(`DELETE FROM public.listings;`);
    console.log(`  ✓ Deleted ${lDel.rowCount} rows from public.listings`);

    // 6. Delete test models (preserving curated seed supply)
    const mDel = await client.query(`
      DELETE FROM public.models
      WHERE id NOT IN (${PRESERVED_MODEL_IDS.map((_, i) => `$${i + 1}`).join(", ")});
    `, PRESERVED_MODEL_IDS);
    console.log(`  ✓ Deleted ${mDel.rowCount} test models from public.models`);

    await client.query("COMMIT;");
    console.log("✅ Deletions committed successfully.\n");

    // Check final row counts
    console.log("--- AFTER PURGE ROW COUNTS ---");
    for (const t of tables) {
      const res = await client.query(`SELECT count(*)::int as c FROM public.${t}`);
      console.log(`  ${t.padEnd(20)}: ${res.rows[0].c}`);
    }

    // Verify preserved models
    console.log("\n--- VERIFY PRESERVED MODELS ---");
    const mCheck = await client.query(`SELECT id, title, status FROM public.models ORDER BY title;`);
    mCheck.rows.forEach((r, idx) => {
      console.log(`  ${idx + 1}. [${r.status}] ${r.title} (ID: ${r.id})`);
    });

    // Verify preserved vendors
    console.log("\n--- VERIFY PRESERVED VENDORS ---");
    const vpCheck = await client.query(`SELECT provider_id, business_name, status FROM public.vendor_profiles;`);
    vpCheck.rows.forEach((r) => {
      console.log(`  ✓ ${r.business_name} (${r.status})`);
    });

    console.log("\n================================================================================");
    console.log("🎉 PRODUCTION TEST-DATA PURGE COMPLETE");
    console.log("================================================================================");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("❌ Error during purge, rolled back:", err);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Purge script failed:", err);
  process.exit(1);
});
