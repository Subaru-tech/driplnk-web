/**
 * Comprehensive Platform E2E Verification Suite for DripLnk
 * 
 * Tests core backend workflows, database integrity, storage, RLS boundaries,
 * and weapon screening gates. All tests are transaction-safe or self-cleaning.
 */

import { Client } from "pg";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const DB_URL =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  "";

const SUPABASE_URL = "https://vjlsuadvxjmxrwnqytmu.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqbHN1YWR2eGpteHJ3bnF5dG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4ODU1MjYsImV4cCI6MjEwMzQ2MTUyNn0.t_HOrPvULI_87Q4MQbGXx9qP4hO7tK-nPjgA_SvlLys";

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
  durationMs: number;
}

const results: TestResult[] = [];

function record(suite: string, name: string, passed: boolean, startTime: number, details?: string) {
  const durationMs = Date.now() - startTime;
  results.push({ suite, name, passed, details, durationMs });
  const icon = passed ? "✅" : "❌";
  console.log(`  ${icon} [${suite}] ${name} (${durationMs}ms)`);
  if (details) {
    console.log(`     ↳ ${details}`);
  }
}

async function runE2ESuite() {
  console.log("================================================================================");
  console.log("🚀 STARTING DRIPLNK COMPREHENSIVE END-TO-END VERIFICATION SUITE");
  console.log("================================================================================\n");

  const pgClient = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();
  console.log("Connected to PostgreSQL database successfully.\n");

  // Track created IDs for foolproof cleanup
  const cleanupOrderIds: string[] = [];
  const cleanupQuoteIds: string[] = [];
  const cleanupFreelanceIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // SUITE 1: DATABASE INTEGRITY & SEED STATE
    // -------------------------------------------------------------------------
    console.log("--- SUITE 1: Database Baseline & Seed Inventory ---");
    {
      const t0 = Date.now();
      const vendorsRes = await pgClient.query(`
        SELECT vp.provider_id, vp.business_name, vp.status, p.status as p_status
        FROM public.vendor_profiles vp
        JOIN public.providers p ON p.id = vp.provider_id
        WHERE vp.status = 'approved' AND p.status = 'approved';
      `);
      const ok = vendorsRes.rows.length === 2;
      record(
        "DB State",
        "Active Approved Vendors Count (expected 2)",
        ok,
        t0,
        `Found ${vendorsRes.rows.length}: ${vendorsRes.rows.map((r) => r.business_name).join(", ")}`
      );
    }

    {
      const t0 = Date.now();
      const freeRes = await pgClient.query(`
        SELECT fp.provider_id, fp.display_name, fp.status, p.status as p_status
        FROM public.freelancer_profiles fp
        JOIN public.providers p ON p.id = fp.provider_id
        WHERE fp.status = 'approved' AND p.status = 'approved';
      `);
      const ok = freeRes.rows.length === 2;
      record(
        "DB State",
        "Active Approved Freelancers Count (expected 2)",
        ok,
        t0,
        `Found ${freeRes.rows.length}: ${freeRes.rows.map((r) => r.display_name).join(", ")}`
      );
    }

    {
      const t0 = Date.now();
      const modelsRes = await pgClient.query(`
        SELECT count(*)::int as total,
               count(*) FILTER (WHERE status = 'published')::int as published
        FROM public.models;
      `);
      const total = modelsRes.rows[0].total;
      const published = modelsRes.rows[0].published;
      const ok = total === 6 && published === 4;
      record(
        "DB State",
        "Curated Models Count (6 total, 4 published)",
        ok,
        t0,
        `Total: ${total}, Published: ${published}`
      );
    }

    {
      const t0 = Date.now();
      const ordersRes = await pgClient.query(`SELECT count(*)::int as count FROM public.mart_orders;`);
      const quotesRes = await pgClient.query(`SELECT count(*)::int as count FROM public.quote_requests;`);
      const frRes = await pgClient.query(`SELECT count(*)::int as count FROM public.freelance_requests;`);
      const ok = ordersRes.rows[0].count === 0 && quotesRes.rows[0].count === 0 && frRes.rows[0].count === 0;
      record(
        "DB State",
        "Transactional Tables Zeroed Post-Purge",
        ok,
        t0,
        `mart_orders=${ordersRes.rows[0].count}, quote_requests=${quotesRes.rows[0].count}, freelance_requests=${frRes.rows[0].count}`
      );
    }

    {
      const t0 = Date.now();
      const snapshotRes = await pgClient.query(`
        SELECT count(*)::int as count
        FROM information_schema.schemata
        WHERE schema_name = 'backup_pre_purge_20260914';
      `);
      const ok = snapshotRes.rows[0].count === 1;
      record("DB State", "Safety Backup Schema Exists (backup_pre_purge_20260914)", ok, t0);
    }

    // -------------------------------------------------------------------------
    // SUITE 2: STORAGE INTEGRITY (BACKBLAZE B2 / S3)
    // -------------------------------------------------------------------------
    console.log("\n--- SUITE 2: Backblaze B2 S3 Storage Connectivity ---");
    {
      const t0 = Date.now();
      try {
        const s3 = new S3Client({
          endpoint: process.env.B2_S3_ENDPOINT || "https://s3.us-east-005.backblazeb2.com",
          region: process.env.B2_REGION || "us-east-005",
          credentials: {
            accessKeyId: process.env.B2_APPLICATION_KEY_ID || "00509577657d46a0000000006",
            secretAccessKey: process.env.B2_APPLICATION_KEY || "K00586hTkofP/Q88eHFYhX4SeyUq21U",
          },
        });
        const bucket = process.env.B2_BUCKET_NAME || "driplink-models-storage";
        const cmd = new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 5 });
        const res = await s3.send(cmd);
        const ok = res.$metadata.httpStatusCode === 200 && Array.isArray(res.Contents);
        record(
          "Storage",
          "Backblaze B2 S3 API Handshake & Bucket Listing",
          ok,
          t0,
          `Bucket: ${bucket}, Sample objects returned: ${res.Contents?.length || 0}`
        );
      } catch (err) {
        record("Storage", "Backblaze B2 S3 API Handshake & Bucket Listing", false, t0, err instanceof Error ? err.message : String(err));
      }
    }

    // -------------------------------------------------------------------------
    // SUITE 3: MART QUOTING, WEAPON MODERATION & DIRECT RPC SECURITY
    // -------------------------------------------------------------------------
    console.log("\n--- SUITE 3: Mart Direct-Print & Weapon Screening Gate ---");

    // Fetch buyer and vendor for test transactions
    const vendorRes = await pgClient.query(`
      SELECT p.id as provider_id, vp.business_name
      FROM public.providers p
      JOIN public.vendor_profiles vp ON vp.provider_id = p.id
      WHERE p.status = 'approved' AND vp.status = 'approved'
      LIMIT 1;
    `);
    const vendorId = vendorRes.rows[0].provider_id;

    const buyerRes = await pgClient.query(`
      SELECT u.id, u.email
      FROM auth.users u
      JOIN public.profiles p ON p.id = u.id
      WHERE u.id <> $1 AND u.email NOT LIKE '%@clerk.internal'
      LIMIT 1;
    `, [vendorRes.rows[0].provider_id]);
    const buyerId = buyerRes.rows[0].id;

    // Subtest 3.1: Benign Order Placement
    {
      const t0 = Date.now();
      const quoteRes = await pgClient.query(
        `
        INSERT INTO public.quote_requests (
          user_id, file_path, material, weight_g, status
        ) VALUES (
          $1, 'mart-quotes/test/e2e_benign_bracket.stl', 'pla', 45.2, 'weighed'
        ) RETURNING id;
      `,
        [buyerId]
      );
      const quoteId = quoteRes.rows[0].id;
      cleanupQuoteIds.push(quoteId);

      const orderRes = await pgClient.query(
        `
        SELECT create_mart_order(
          $1::uuid, $2::uuid, $3::uuid, 'pla'::text, NULL::text, '{}'::jsonb
        ) as order_id;
      `,
        [buyerId, quoteId, vendorId]
      );
      const orderId = orderRes.rows[0].order_id;
      cleanupOrderIds.push(orderId);

      const inspectRes = await pgClient.query(
        `SELECT status, moderation_status FROM public.mart_orders WHERE id = $1`,
        [orderId]
      );
      const row = inspectRes.rows[0];
      const ok = row.status === "pending_vendor_response" && !row.moderation_status;
      record(
        "Mart Workflow",
        "Benign Direct-Print Order Placement",
        ok,
        t0,
        `Order ${orderId} -> status: ${row.status}, moderation_status: ${row.moderation_status}`
      );
    }

    // Subtest 3.2: Weapon Screening Interception
    let weaponOrderId: string | null = null;
    {
      const t0 = Date.now();
      const quoteRes = await pgClient.query(
        `
        INSERT INTO public.quote_requests (
          user_id, file_path, material, weight_g, status
        ) VALUES (
          $1, 'mart-quotes/test/lower_receiver_v3.stl', 'pla', 120.0, 'weighed'
        ) RETURNING id;
      `,
        [buyerId]
      );
      const quoteId = quoteRes.rows[0].id;
      cleanupQuoteIds.push(quoteId);

      // Invoke create_mart_order RPC via postgres function
      const orderRes = await pgClient.query(
        `
        SELECT create_mart_order(
          $1::uuid, $2::uuid, $3::uuid, 'pla'::text, NULL::text, '{}'::jsonb
        ) as order_id;
      `,
        [buyerId, quoteId, vendorId]
      );
      weaponOrderId = orderRes.rows[0].order_id;
      cleanupOrderIds.push(weaponOrderId!);

      const inspectRes = await pgClient.query(
        `SELECT status, moderation_status, moderation_flags FROM public.mart_orders WHERE id = $1`,
        [weaponOrderId]
      );
      const row = inspectRes.rows[0];
      const ok =
        row.status === "pending_moderation" &&
        row.moderation_status === "weapon_review" &&
        row.moderation_flags?.weapon_match === true;

      record(
        "Mart Weapon Gate",
        "Weapon CAD Filename Intercepted & Held",
        ok,
        t0,
        `Order ${weaponOrderId} -> status: ${row.status}, moderation: ${row.moderation_status}`
      );
    }

    // Subtest 3.3: Admin Clearance of Held Order
    {
      const t0 = Date.now();
      const adminClearRes = await pgClient.query(
        `
        SELECT admin_moderate_mart_order(
          $1::uuid, 'clear', 'E2E test admin review clearance'
        ) as result;
      `,
        [weaponOrderId]
      );
      const resultObj = adminClearRes.rows[0].result;

      const verifyRes = await pgClient.query(
        `SELECT status, moderation_status FROM public.mart_orders WHERE id = $1`,
        [weaponOrderId]
      );
      const ok =
        resultObj.success === true &&
        verifyRes.rows[0].status === "pending_vendor_response" &&
        verifyRes.rows[0].moderation_status === "cleared";

      record(
        "Mart Weapon Gate",
        "Admin Clearance Transitions Order to pending_vendor_response",
        ok,
        t0,
        `Result: ${JSON.stringify(resultObj)} -> DB status: ${verifyRes.rows[0].status}`
      );
    }

    // Subtest 3.4: Anon Role RPC Invocation Rejection
    {
      const t0 = Date.now();
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_mart_order`, {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_buyer_user_id: buyerId,
          p_quote_request_id: cleanupQuoteIds[0],
          p_provider_id: vendorId,
          p_material: "pla",
          p_moderation_status: "cleared",
        }),
      });
      const ok = res.status === 401 || res.status === 403;
      record(
        "Security / RLS",
        "Direct RPC Execution Blocked for Anon Key",
        ok,
        t0,
        `HTTP Status ${res.status} (expected 401/403)`
      );
    }

    // -------------------------------------------------------------------------
    // SUITE 4: FREELANCE MARKETPLACE WORKFLOW
    // -------------------------------------------------------------------------
    console.log("\n--- SUITE 4: Freelance Hire Request Lifecycle ---");
    {
      const t0 = Date.now();
      const freeProviderRes = await pgClient.query(`
        SELECT provider_id, display_name FROM public.freelancer_profiles WHERE status = 'approved' LIMIT 1;
      `);
      const freelancer = freeProviderRes.rows[0];

      // Create freelance request matching exact columns
      const createRes = await pgClient.query(
        `
        INSERT INTO public.freelance_requests (
          buyer_user_id, freelancer_provider_id, brief, agreed_price, status
        ) VALUES (
          $1, $2, 'Design a sealed enclosure for high-torque servo.', 5000, 'requested'
        ) RETURNING id, status;
      `,
        [buyerId, freelancer.provider_id]
      );
      const frId = createRes.rows[0].id;
      cleanupFreelanceIds.push(frId);

      const okCreate = createRes.rows[0].status === "requested";
      record(
        "Freelance",
        "Submit Freelance Hire Request",
        okCreate,
        t0,
        `Created ID ${frId} for Freelancer: ${freelancer.display_name}`
      );

      // Transition: Freelancer accepts request
      const t1 = Date.now();
      const acceptRes = await pgClient.query(
        `
        UPDATE public.freelance_requests
        SET status = 'accepted', updated_at = now()
        WHERE id = $1
        RETURNING status;
      `,
        [frId]
      );
      const okAccept = acceptRes.rows[0].status === "accepted";
      record("Freelance", "Freelancer Accepts Hire Request", okAccept, t1, `Status: ${acceptRes.rows[0].status}`);

      // Transition: Completed
      const t2 = Date.now();
      const completeRes = await pgClient.query(
        `
        UPDATE public.freelance_requests
        SET status = 'completed', updated_at = now()
        WHERE id = $1
        RETURNING status;
      `,
        [frId]
      );
      const okComplete = completeRes.rows[0].status === "completed";
      record("Freelance", "Freelancer Completes Request", okComplete, t2, `Status: ${completeRes.rows[0].status}`);
    }

    // -------------------------------------------------------------------------
    // SUITE 5: ROW-LEVEL SECURITY & PII PRIVACY AUDIT
    // -------------------------------------------------------------------------
    console.log("\n--- SUITE 5: Row-Level Security (RLS) & PII Protection ---");
    {
      const t0 = Date.now();
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,email,full_name,clerk_id`, {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
      });
      const data = await res.json();
      // Should return either an empty array or an error, never user PII
      const ok = Array.isArray(data) ? data.length === 0 : res.status >= 400;
      record(
        "Security / RLS",
        "Anon Role Access to profiles Table Blocked",
        ok,
        t0,
        `Returned ${Array.isArray(data) ? data.length : "error"} rows`
      );
    }

    {
      const t0 = Date.now();
      const res = await fetch(`${SUPABASE_URL}/rest/v1/mart_orders?select=*`, {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
      });
      const data = await res.json();
      const ok = Array.isArray(data) ? data.length === 0 : res.status >= 400;
      record(
        "Security / RLS",
        "Anon Role Access to mart_orders Table Blocked",
        ok,
        t0,
        `Returned ${Array.isArray(data) ? data.length : "error"} rows`
      );
    }

    {
      const t0 = Date.now();
      const res = await fetch(`${SUPABASE_URL}/rest/v1/freelance_requests?select=*`, {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
      });
      const data = await res.json();
      const ok = Array.isArray(data) ? data.length === 0 : res.status >= 400;
      record(
        "Security / RLS",
        "Anon Role Access to freelance_requests Blocked",
        ok,
        t0,
        `Returned ${Array.isArray(data) ? data.length : "error"} rows`
      );
    }

    // -------------------------------------------------------------------------
    // SUITE 6: CLEAN TEARDOWN & ZERO RESIDUAL STATE
    // -------------------------------------------------------------------------
    console.log("\n--- SUITE 6: Comprehensive Teardown & Residual Zero-State ---");
    {
      const t0 = Date.now();
      if (cleanupOrderIds.length > 0) {
        await pgClient.query(`DELETE FROM public.mart_orders WHERE id = ANY($1::uuid[])`, [cleanupOrderIds]);
      }
      if (cleanupQuoteIds.length > 0) {
        await pgClient.query(`DELETE FROM public.quote_requests WHERE id = ANY($1::uuid[])`, [cleanupQuoteIds]);
      }
      if (cleanupFreelanceIds.length > 0) {
        await pgClient.query(`DELETE FROM public.freelance_requests WHERE id = ANY($1::uuid[])`, [cleanupFreelanceIds]);
      }

      const moCheck = await pgClient.query(`SELECT count(*)::int as count FROM public.mart_orders;`);
      const qrCheck = await pgClient.query(`SELECT count(*)::int as count FROM public.quote_requests;`);
      const frCheck = await pgClient.query(`SELECT count(*)::int as count FROM public.freelance_requests;`);

      const zeroCount = moCheck.rows[0].count === 0 && qrCheck.rows[0].count === 0 && frCheck.rows[0].count === 0;
      record(
        "Teardown",
        "Self-Cleaning Post-Test Verification (0 residual records)",
        zeroCount,
        t0,
        `mart_orders=${moCheck.rows[0].count}, quote_requests=${qrCheck.rows[0].count}, freelance_requests=${frCheck.rows[0].count}`
      );
    }
  } finally {
    // Safety fallback cleanup
    if (cleanupOrderIds.length > 0) {
      await pgClient.query(`DELETE FROM public.mart_orders WHERE id = ANY($1::uuid[])`, [cleanupOrderIds]).catch(() => {});
    }
    if (cleanupQuoteIds.length > 0) {
      await pgClient.query(`DELETE FROM public.quote_requests WHERE id = ANY($1::uuid[])`, [cleanupQuoteIds]).catch(() => {});
    }
    if (cleanupFreelanceIds.length > 0) {
      await pgClient.query(`DELETE FROM public.freelance_requests WHERE id = ANY($1::uuid[])`, [cleanupFreelanceIds]).catch(() => {});
    }
    await pgClient.end();
  }

  // Summary
  console.log("\n================================================================================");
  console.log("📊 E2E TEST SUMMARY RESULTS");
  console.log("================================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`Total Probes Executed: ${total}`);
  console.log(`Passed:                ${passed}`);
  console.log(`Failed:                ${failed}`);
  console.log(`Pass Rate:             ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.error("\n❌ Some E2E probes failed!");
    process.exit(1);
  } else {
    console.log("\n🎉 ALL E2E VERIFICATION PROBES PASSED WITH 100% SUCCESS!");
  }
}

runE2ESuite().catch((err) => {
  console.error("FATAL: Unhandled error in E2E suite:", err);
  process.exit(1);
});
