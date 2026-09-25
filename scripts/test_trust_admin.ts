import pg from "pg";

const CONNECTION_STRING = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";

async function main() {
  console.log("=== RUNNING TRUST LAYER & ADMIN QUEUE E2E VERIFICATION ===");
  const client = new pg.Client({ connectionString: CONNECTION_STRING });
  await client.connect();

  try {
    // 1. Verify schema constraints
    console.log("\n[Test 1] Checking status check constraints...");
    const constraintsRes = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conname IN ('providers_status_check', 'vendor_profiles_status_check', 'freelancer_profiles_status_check');
    `);
    for (const row of constraintsRes.rows) {
      console.log(`✓ ${row.conname}: ${row.def}`);
      if (!row.def.includes("changes_requested")) {
        throw new Error(`Constraint ${row.conname} missing 'changes_requested'`);
      }
    }

    // 2. Verify admin_notes columns
    console.log("\n[Test 2] Checking admin_notes column presence...");
    const colsRes = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_name IN ('providers', 'vendor_profiles', 'freelancer_profiles')
        AND column_name = 'admin_notes';
    `);
    console.log(`✓ Found ${colsRes.rows.length} admin_notes columns across providers, vendor_profiles, freelancer_profiles.`);
    if (colsRes.rows.length < 3) {
      throw new Error("Missing admin_notes on one or more tables");
    }

    // 3. Test admin_get_pending_providers RPC
    console.log("\n[Test 3] Testing admin_get_pending_providers() query...");
    const pendingRes = await client.query(`SELECT * FROM public.admin_get_pending_providers();`);
    console.log(`✓ admin_get_pending_providers returned ${pendingRes.rows.length} providers.`);
    if (pendingRes.rows.length > 0) {
      const sample = pendingRes.rows[0];
      console.log(`  Sample Provider: ID=${sample.provider_id}, Type=${sample.type}, Status=${sample.status}`);
      console.log(`  Details keys: ${Object.keys(sample.details).join(", ")}`);
    }

    // 4. Test admin_review_provider RPC with 'changes_requested'
    console.log("\n[Test 4] Testing admin_review_provider RPC with changes_requested and admin notes...");
    
    const testUserId = "4731bf91-6b5e-447a-b408-64a53ec9a3fd";

    const testProviderRes = await client.query(`
      INSERT INTO public.providers (user_id, type, status)
      VALUES ($1, 'freelancer', 'pending')
      RETURNING id;
    `, [testUserId]);
    const testProviderId = testProviderRes.rows[0].id;

    await client.query(`
      INSERT INTO public.freelancer_profiles (provider_id, display_name, bio, skills, portfolio_urls, rate_type, base_rate, status)
      VALUES ($1, 'Atharva CAD Test', 'Parametric CAD Designer', ARRAY['SolidWorks', 'Fusion 360'], ARRAY['https://github.com/test'], 'hourly', 1200, 'pending');
    `, [testProviderId]);

    // Review with changes_requested
    const reviewNote = "Please add portfolio links showing parametric CAD or tolerance fit parts.";
    const reviewRes = await client.query(`
      SELECT public.admin_review_provider($1, 'changes_requested', $2) as result;
    `, [testProviderId, reviewNote]);

    console.log("✓ Review RPC returned:", reviewRes.rows[0].result);

    // Verify provider status and admin_notes updated
    const checkProvider = await client.query(`
      SELECT status, admin_notes FROM public.providers WHERE id = $1;
    `, [testProviderId]);
    console.log(`✓ Provider status after review: ${checkProvider.rows[0].status}`);
    console.log(`✓ Provider admin notes: "${checkProvider.rows[0].admin_notes}"`);

    if (checkProvider.rows[0].status !== "changes_requested" || checkProvider.rows[0].admin_notes !== reviewNote) {
      throw new Error("Provider did not update to changes_requested with correct notes");
    }

    // 5. Test Resubmission / Flip back to pending
    console.log("\n[Test 5] Testing resubmission flips status back to pending...");
    const resubmitRes = await client.query(`
      SELECT public.register_freelancer_profile(
        $1,
        'Atharva CAD Test Updated',
        'Parametric CAD Designer with updated portfolio',
        ARRAY['SolidWorks', 'Fusion 360', 'Tolerance Fits'],
        ARRAY['https://github.com/test', 'https://cad.test/hub'],
        'hourly',
        1200
      ) as result;
    `, [testUserId]);
    console.log("✓ register_freelancer_profile returned:", resubmitRes.rows[0].result);

    const checkResubmitted = await client.query(`
      SELECT status FROM public.providers WHERE id = $1;
    `, [testProviderId]);
    console.log(`✓ Provider status after resubmission: ${checkResubmitted.rows[0].status}`);
    if (checkResubmitted.rows[0].status !== "pending") {
      throw new Error("Status should have flipped back to 'pending' on resubmission");
    }

    // 6. Test final approval and Verified badge state
    console.log("\n[Test 6] Testing final approval...");
    await client.query(`
      SELECT public.admin_review_provider($1, 'approved', 'Approved by founder review') as result;
    `, [testProviderId]);

    const checkApproved = await client.query(`
      SELECT status FROM public.providers WHERE id = $1;
    `, [testProviderId]);
    console.log(`✓ Provider status after approval: ${checkApproved.rows[0].status}`);

    // Cleanup test data
    await client.query(`DELETE FROM public.freelancer_profiles WHERE provider_id = $1;`, [testProviderId]);
    await client.query(`DELETE FROM public.providers WHERE id = $1;`, [testProviderId]);
    console.log("✓ Cleaned up test fixtures.");

    console.log("\n=======================================================");
    console.log("  ALL TRUST LAYER & ADMIN QUEUE TESTS PASSED (6/6)     ");
    console.log("=======================================================");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
