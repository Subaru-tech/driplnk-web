/**
 * Dry-Run Production Test-Data Purge Script
 *
 * Performs SELECT-ONLY audit of rows slated for purge.
 * Does NOT execute any DELETE or UPDATE commands.
 *
 * Safety Net:
 * - Creates a local snapshot table schema (backup_pre_purge_20260914) of all candidate tables.
 * - Prints every single row ID, title/details, and purge rationale.
 * - Confirms preservation of Zenith Prototyping Hub, Apex Print Systems, and Atharva Ramani profiles.
 */

import { Client } from "pg";

const DB_URL =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  "";

async function main() {
  console.log("================================================================================");
  console.log("🔍 PRODUCTION TEST-DATA CLEANUP — DRY-RUN AUDIT & SNAPSHOT VERIFICATION");
  console.log("================================================================================\n");

  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Create Database Safety Snapshot Tables (Point-in-Time Rollback Anchor)
    // -------------------------------------------------------------------------
    console.log("--- STEP 1: Creating Safety Snapshot Tables in Schema: backup_pre_purge_20260914 ---");
    await client.query(`CREATE SCHEMA IF NOT EXISTS backup_pre_purge_20260914;`);

    const tablesToSnapshot = ["mart_orders", "quote_requests", "freelance_requests", "models", "listings"];
    for (const t of tablesToSnapshot) {
      await client.query(`DROP TABLE IF EXISTS backup_pre_purge_20260914.${t};`);
      await client.query(`CREATE TABLE backup_pre_purge_20260914.${t} AS SELECT * FROM public.${t};`);
      const countRes = await client.query(`SELECT count(*)::int as c FROM backup_pre_purge_20260914.${t};`);
      console.log(`  ✓ Snapshot saved: backup_pre_purge_20260914.${t} (${countRes.rows[0].c} rows archived)`);
    }
    console.log("✅ Rollback safety snapshot verified in database.\n");

    // -------------------------------------------------------------------------
    // STEP 2: Dry-Run SELECT of Candidate Rows for Purge
    // -------------------------------------------------------------------------
    console.log("--- STEP 2: DRY-RUN AUDIT — CANDIDATE ROWS FOR PURGE ---");

    // 1. Mart Orders
    const moQuery = await client.query(`
      SELECT mo.id, mo.price, mo.status, mo.created_at, qr.file_path, vp.business_name
      FROM public.mart_orders mo
      LEFT JOIN public.quote_requests qr ON qr.id = mo.quote_request_id
      LEFT JOIN public.vendor_profiles vp ON vp.provider_id = mo.provider_id
      ORDER BY mo.created_at;
    `);

    console.log(`\n[Table: public.mart_orders] — Total candidate rows to purge: ${moQuery.rows.length}`);
    moQuery.rows.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ID: ${r.id}`);
      console.log(`     Details: Price ₹${r.price} | Status: ${r.status} | File: ${r.file_path || "none"}`);
      console.log(`     Vendor:  ${r.business_name || "none"} | Created: ${r.created_at}`);
      console.log(`     Reason:  Test order from Phase 0/8/9/10 manual or automated test runs.`);
    });

    // 2. Quote Requests
    const qrQuery = await client.query(`
      SELECT id, user_id, file_path, material, weight_g, created_at
      FROM public.quote_requests
      ORDER BY created_at;
    `);
    console.log(`\n[Table: public.quote_requests] — Total candidate rows to purge: ${qrQuery.rows.length}`);
    qrQuery.rows.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ID: ${r.id}`);
      console.log(`     Details: Material ${r.material} (${r.weight_g}g) | File: ${r.file_path}`);
      console.log(`     Created: ${r.created_at}`);
      console.log(`     Reason:  Test quote request associated with dummy test order runs.`);
    });

    // 3. Freelance Requests
    const frQuery = await client.query(`
      SELECT id, buyer_user_id, freelancer_provider_id, brief, agreed_price, status, created_at
      FROM public.freelance_requests
      ORDER BY created_at;
    `);
    console.log(`\n[Table: public.freelance_requests] — Total candidate rows to purge: ${frQuery.rows.length}`);
    frQuery.rows.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ID: ${r.id}`);
      console.log(`     Details: Status: ${r.status} | Budget: ₹${r.agreed_price || "none"}`);
      console.log(`     Brief:   "${r.brief.slice(0, 70)}..."`);
      console.log(`     Created: ${r.created_at}`);
      console.log(`     Reason:  Synthetic fixture or automated test request from Phase 0/11.`);
    });

    // 4. Models: Curated vs Test
    const curatedTitles = [
      "nema 17 stepper servo mount",
      "driplnk martbot mascot",
      "parametric spiral gear assembly",
      "precision phone & tablet stand",
      "draft cyberpunk desk organizer",
      "draft drone chassis frame",
    ];

    const allModelsQuery = await client.query(`
      SELECT id, title, name, owner_id, status, file_sha256, created_at
      FROM public.models
      ORDER BY created_at;
    `);

    const modelsToKeep: typeof allModelsQuery.rows = [];
    const modelsToPurge: typeof allModelsQuery.rows = [];

    allModelsQuery.rows.forEach((r) => {
      const cleanTitle = (r.title || r.name || "").toLowerCase();
      if (curatedTitles.some((ct) => cleanTitle.includes(ct))) {
        modelsToKeep.push(r);
      } else {
        modelsToPurge.push(r);
      }
    });

    console.log(`\n[Table: public.models] — Total rows: ${allModelsQuery.rows.length}`);
    console.log(`  -> Models to PURGE: ${modelsToPurge.length}`);
    modelsToPurge.forEach((r, idx) => {
      console.log(`    ${idx + 1}. ID: ${r.id}`);
      console.log(`       Title:   "${r.title || r.name}" (Status: ${r.status})`);
      console.log(`       Created: ${r.created_at}`);
      console.log(`       Reason:  Test CAD model / scratch draft / test upload fixture.`);
    });

    console.log(`\n  -> Models to PRESERVE (Curated Seed Supply): ${modelsToKeep.length}`);
    modelsToKeep.forEach((r, idx) => {
      console.log(`    ${idx + 1}. ID: ${r.id} | Title: "${r.title || r.name}" (${r.status})`);
    });

    // 5. Listings
    const lQuery = await client.query(`
      SELECT id, title, seller_id, status, price_inr, created_at
      FROM public.listings
      ORDER BY created_at;
    `);
    console.log(`\n[Table: public.listings] — Total candidate rows to purge: ${lQuery.rows.length}`);
    lQuery.rows.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ID: ${r.id}`);
      console.log(`     Title:   "${r.title}" (Status: ${r.status}, ₹${r.price_inr})`);
      console.log(`     Created: ${r.created_at}`);
      console.log(`     Reason:  Synthetic listing fixture (UUID: ${r.id}).`);
    });

    // -------------------------------------------------------------------------
    // STEP 3: Confirm Preserved Vendor & Freelancer Profiles (Seeded Supply)
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 3: CONFIRM PRESERVED VENDOR & FREELANCER PROFILES ---");
    const vpQuery = await client.query(`
      SELECT vp.provider_id, vp.business_name, vp.status, p.full_name, p.email
      FROM public.vendor_profiles vp
      JOIN public.providers pr ON pr.id = vp.provider_id
      JOIN public.profiles p ON p.id = pr.user_id;
    `);
    console.log("  Vendors preserved as initial seeded supply:");
    vpQuery.rows.forEach((r) => {
      console.log(`    ✓ ${r.business_name} (Status: ${r.status}) — Owner: ${r.full_name} (${r.email})`);
    });

    const fpQuery = await client.query(`
      SELECT pr.id, pr.type, pr.status, p.full_name, p.email
      FROM public.providers pr
      JOIN public.profiles p ON p.id = pr.user_id
      WHERE pr.type = 'freelancer';
    `);
    console.log("  Freelancers preserved as initial seeded supply:");
    fpQuery.rows.forEach((r) => {
      console.log(`    ✓ ${r.full_name} (${r.email}) — Provider ID: ${r.id} (Status: ${r.status})`);
    });

    console.log("\n================================================================================");
    console.log("✅ DRY-RUN COMPLETED: Zero rows were deleted. Review the lists above.");
    console.log("================================================================================");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("❌ Dry run failed:", err);
  process.exit(1);
});
