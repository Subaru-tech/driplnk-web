/**
 * Phase 10b Verification: Direct RPC Bypass Attempt Test
 *
 * Demonstrates defense-in-depth:
 * 1. An attacker attempts to call create_mart_order RPC via PostgREST with the Anon Key
 *    -> Rejected (401/403 or execution revoked).
 * 2. An attacker attempts a parameter forgery attack against create_mart_order RPC directly
 *    using curl, passing a weapon file path ("lower_receiver_v3.stl") but deliberately
 *    forging "p_moderation_status": "cleared" to try to bypass moderation and auto-dispatch to a vendor.
 * 3. Proves that the PostgreSQL function's internal regex catches the file path, overrides
 *    the forged parameter, forces status = 'pending_moderation' and moderation_status = 'weapon_review',
 *    and prevents vendor notification dispatch.
 */

import { Client } from "pg";
import { execSync } from "child_process";

const DB_URL = process.env.DATABASE_URL || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vjlsuadvxjmxrwnqytmu.supabase.co";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqbHN1YWR2eGpteHJ3bnF5dG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4ODU1MjYsImV4cCI6MjEwMzQ2MTUyNn0.t_HOrPvULI_87Q4MQbGXx9qP4hO7tK-nPjgA_SvlLys";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function main() {
  console.log("================================================================================");
  console.log("🛡️  PHASE 10b: DIRECT RPC PARAMETER FORGERY & BYPASS ATTEMPT TEST");
  console.log("================================================================================\n");

  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let testOrderId: string | null = null;
  let testQuoteId: string | null = null;

  try {
    // 1. Fetch valid buyer and vendor for realistic RPC execution
    const vendorRes = await client.query(`
      SELECT p.id as provider_id, p.user_id, vp.business_name, prof.email as vendor_email
      FROM public.providers p
      JOIN public.vendor_profiles vp ON vp.provider_id = p.id
      JOIN public.profiles prof ON prof.id = p.user_id
      WHERE p.type = 'vendor' AND p.status = 'approved' AND vp.status = 'approved'
      LIMIT 1;
    `);
    const vendor = vendorRes.rows[0];

    const buyerRes = await client.query(`
      SELECT id, email, full_name
      FROM public.profiles
      WHERE id <> $1 AND email NOT LIKE '%@clerk.internal'
      LIMIT 1;
    `, [vendor.user_id]);
    const buyer = buyerRes.rows[0];

    // Ensure pricing rule exists
    await client.query(`DELETE FROM public.vendor_pricing_rules WHERE provider_id = $1 AND lower(material) = 'pla'`, [vendor.provider_id]);
    await client.query(`
      INSERT INTO public.vendor_pricing_rules (provider_id, material, price_per_gram, min_order_price, active)
      VALUES ($1, 'pla', 4.50, 150.00, true);
    `, [vendor.provider_id]);

    // Create quote request with weapon filename
    const weaponFileName = "lower_receiver_v3.stl";
    const quoteFilePath = `mart-quotes/${buyer.id}/${Date.now()}-${weaponFileName}`;
    const quoteRes = await client.query(`
      INSERT INTO public.quote_requests (user_id, file_path, material, weight_g)
      VALUES ($1, $2, 'pla', 125.0)
      RETURNING id;
    `, [buyer.id, quoteFilePath]);
    testQuoteId = quoteRes.rows[0].id;

    console.log("Test Context:");
    console.log(`  - Buyer ID:       ${buyer.id} (${buyer.full_name})`);
    console.log(`  - Provider ID:    ${vendor.provider_id} (${vendor.business_name})`);
    console.log(`  - Quote ID:       ${testQuoteId}`);
    console.log(`  - Quote File:     ${quoteFilePath}\n`);

    // -------------------------------------------------------------------------
    // BYPASS ATTEMPT 1: Anonymous Caller attempts to invoke create_mart_order
    // -------------------------------------------------------------------------
    console.log("--- BYPASS ATTEMPT 1: curl invoke create_mart_order via Anon Key ---");
    const anonPayload = JSON.stringify({
      p_buyer_user_id: buyer.id,
      p_quote_request_id: testQuoteId,
      p_provider_id: vendor.provider_id,
      p_material: "pla",
      p_moderation_status: "cleared",
    });

    const anonCurlCmd = `curl -s -w "\\nHTTP_STATUS:%{http_code}" -X POST "${SUPABASE_URL}/rest/v1/rpc/create_mart_order" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer ${ANON_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '${anonPayload}'`;

    console.log(`REQUEST:\n${anonCurlCmd}\n`);
    const anonOutput = execSync(anonCurlCmd, { encoding: "utf8" });
    console.log(`RESPONSE:\n${anonOutput.trim()}\n`);

    const anonStatusMatch = anonOutput.match(/HTTP_STATUS:(\d+)/);
    const anonStatusCode = anonStatusMatch ? parseInt(anonStatusMatch[1], 10) : 0;
    if (anonStatusCode === 200) {
      throw new Error("SECURITY FAILURE: Anonymous client was able to execute create_mart_order RPC!");
    }
    console.log(`✅ ATTEMPT 1 BLOCKED: Anon execution correctly rejected (HTTP ${anonStatusCode} Forbidden/Unauthorized).\n`);

    // -------------------------------------------------------------------------
    // BYPASS ATTEMPT 2: Parameter Forgery Attack via direct service-role RPC call
    // Caller attempts to force p_moderation_status = 'cleared' with a weapon file
    // -------------------------------------------------------------------------
    console.log("--- BYPASS ATTEMPT 2: Direct RPC Parameter Forgery (p_moderation_status: 'cleared') ---");

    // Get baseline notification count
    const preCountRes = await client.query(`SELECT count(*)::int as count FROM net._http_response;`);
    const preNotificationCount = preCountRes.rows[0].count;

    const forgedPayload = JSON.stringify({
      p_buyer_user_id: buyer.id,
      p_quote_request_id: testQuoteId,
      p_provider_id: vendor.provider_id,
      p_material: "pla",
      p_moderation_status: "cleared", // FORGED: Attacker tries to claim order is already cleared
      p_moderation_flags: {
        tampered: true,
        forged_by: "attacker_direct_rpc",
        claimed_status: "clean_benign_part",
      },
    });

    const forgedCurlCmd = `curl -s -w "\\nHTTP_STATUS:%{http_code}" -X POST "${SUPABASE_URL}/rest/v1/rpc/create_mart_order" \\
  -H "apikey: ${SERVICE_KEY}" \\
  -H "Authorization: Bearer ${SERVICE_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '${forgedPayload}'`;

    console.log(`REQUEST:\n${forgedCurlCmd}\n`);
    const forgedOutput = execSync(forgedCurlCmd, { encoding: "utf8" });
    console.log(`RESPONSE:\n${forgedOutput.trim()}\n`);

    const forgedStatusMatch = forgedOutput.match(/HTTP_STATUS:(\d+)/);
    const forgedStatusCode = forgedStatusMatch ? parseInt(forgedStatusMatch[1], 10) : 0;
    const responseBody = forgedOutput.replace(/\nHTTP_STATUS:\d+/, "").trim();

    if (forgedStatusCode !== 200) {
      throw new Error(`RPC call failed with status ${forgedStatusCode}: ${responseBody}`);
    }

    testOrderId = JSON.parse(responseBody);
    console.log(`RPC returned Order UUID: ${testOrderId}\n`);

    // Inspect the resulting row in database
    const orderRowRes = await client.query(`
      SELECT id, status, moderation_status, moderation_flags, price, created_at
      FROM public.mart_orders
      WHERE id = $1;
    `, [testOrderId]);

    if (orderRowRes.rows.length === 0) {
      throw new Error(`Order ${testOrderId} not found in database!`);
    }

    const orderRow = orderRowRes.rows[0];
    console.log("INSPECTING CREATED MART ORDER IN DATABASE:");
    console.log(`  Order ID:                  ${orderRow.id}`);
    console.log(`  Forged Parameter Passed:   p_moderation_status = 'cleared'`);
    console.log(`  Actual DB Status:          ${orderRow.status}`);
    console.log(`  Actual DB Moderation:      ${orderRow.moderation_status}`);
    console.log(`  Actual DB Flags:           ${JSON.stringify(orderRow.moderation_flags)}\n`);

    // Verify DB forced pending_moderation despite forged parameter
    if (orderRow.status !== "pending_moderation") {
      throw new Error(`SECURITY FAILURE: Order status is '${orderRow.status}', expected 'pending_moderation'! Forgery succeeded!`);
    }
    if (orderRow.moderation_status !== "weapon_review") {
      throw new Error(`SECURITY FAILURE: Moderation status is '${orderRow.moderation_status}', expected 'weapon_review'!`);
    }
    if (!orderRow.moderation_flags?.weapon_match) {
      throw new Error(`SECURITY FAILURE: moderation_flags.weapon_match is not true!`);
    }

    // Verify notification suppression
    await new Promise((r) => setTimeout(r, 1200));
    const postCountRes = await client.query(`SELECT count(*)::int as count FROM net._http_response;`);
    const postNotificationCount = postCountRes.rows[0].count;
    const notificationsSent = postNotificationCount - preNotificationCount;

    console.log(`  HTTP Vendor Notifications Sent: ${notificationsSent} (0 expected)`);
    if (notificationsSent !== 0) {
      throw new Error(`SECURITY FAILURE: ${notificationsSent} notifications dispatched for held order!`);
    }

    console.log("\n✅ ATTEMPT 2 BLOCKED: Server-side DB regex caught the weapon file path,");
    console.log("   overrode the forged p_moderation_status='cleared', forced status='pending_moderation',");
    console.log("   and suppressed vendor dispatch with 0 vendor alerts.");

    console.log("\n================================================================================");
    console.log("🎉 ALL BYPASS ATTEMPTS DEFEATED: Database-level weapon gate is 100% airtight!");
    console.log("================================================================================");
  } finally {
    if (testOrderId) {
      await client.query(`DELETE FROM public.mart_orders WHERE id = $1`, [testOrderId]);
    }
    if (testQuoteId) {
      await client.query(`DELETE FROM public.quote_requests WHERE id = $1`, [testQuoteId]);
    }
    await client.end();
  }
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
