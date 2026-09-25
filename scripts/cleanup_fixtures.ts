import { Client } from "pg";

const connectionString =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  "";

async function runFixtureCleanup() {
  const client = new Client({ connectionString });
  await client.connect();

  console.log("Connected to PostgreSQL for fixture cleanup.\n");

  try {
    await client.query("BEGIN;");

    // 1. Snapshot provider tables into safety schema backup_pre_purge_20260914
    console.log("1. Creating safety snapshots in backup_pre_purge_20260914...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_pre_purge_20260914.providers AS TABLE public.providers;
      CREATE TABLE IF NOT EXISTS backup_pre_purge_20260914.freelancer_profiles AS TABLE public.freelancer_profiles;
      CREATE TABLE IF NOT EXISTS backup_pre_purge_20260914.vendor_profiles AS TABLE public.vendor_profiles;
    `);
    console.log("   ✓ Snapshots recorded.");

    // 2. Merge Atharva duplicate: Update Clerk-linked profile (b8686a6c-...) with rich seed details
    console.log("2. Merging Atharva profiles in favor of Clerk-linked b8686a6c-74d7-432e-9732-995b8cb79256...");
    await client.query(`
      UPDATE public.freelancer_profiles
      SET
        display_name = 'Atharva Ramani',
        bio = 'Parametric CAD designer and additive manufacturing specialist. 5+ years experience in tolerance fit optimization, gear trains, and custom mechanical assemblies.',
        skills = ARRAY['SolidWorks', 'Fusion 360', 'LeaFF OS', 'Tolerance Fits', 'Gear Design'],
        portfolio_urls = ARRAY['https://github.com', 'https://cad.onshape.com'],
        rate_type = 'hourly',
        base_rate = 1200,
        status = 'approved',
        updated_at = NOW()
      WHERE provider_id = 'b8686a6c-74d7-432e-9732-995b8cb79256';
    `);

    // Ensure Clerk profile email is set to Atharva's real inbox
    await client.query(`
      UPDATE public.profiles
      SET email = 'atharvaramani350@gmail.com'
      WHERE clerk_id = 'user_3IukzMSUdudpAc7brsSg4aJrcyd';
    `);

    // Delete old seed fixture 11111111-1111-1111-1111-111111111111
    await client.query(`
      DELETE FROM public.freelancer_profiles WHERE provider_id = '11111111-1111-1111-1111-111111111111';
      DELETE FROM public.providers WHERE id = '11111111-1111-1111-1111-111111111111';
    `);
    console.log("   ✓ Atharva duplicate merged & old seed fixture (11111111-...) deleted.");

    // 3. Delete Pending Applicant freelancer fixture (33333333-3333-3333-3333-333333333333)
    console.log("3. Deleting Pending Applicant fixture (33333333-3333-3333-3333-333333333333)...");
    await client.query(`
      DELETE FROM public.freelancer_profiles WHERE provider_id = '33333333-3333-3333-3333-333333333333';
      DELETE FROM public.providers WHERE id = '33333333-3333-3333-3333-333333333333';
    `);
    console.log("   ✓ Pending Applicant deleted.");

    // 4. Delete Rakshit 3D Farm (Pending) test vendor fixture (c5064e4c-efe4-44f7-a328-6495d77fb4d6)
    console.log("4. Deleting Rakshit 3D Farm (Pending) fixture (c5064e4c-efe4-44f7-a328-6495d77fb4d6)...");
    await client.query(`
      DELETE FROM public.vendor_profiles WHERE provider_id = 'c5064e4c-efe4-44f7-a328-6495d77fb4d6';
      DELETE FROM public.providers WHERE id = 'c5064e4c-efe4-44f7-a328-6495d77fb4d6';
    `);
    console.log("   ✓ Rakshit 3D Farm (Pending) deleted.");

    await client.query("COMMIT;");
    console.log("\nTransaction committed successfully!");

    // Final state inspection
    console.log("\n=== REMAINING LIVE FREELANCERS ===");
    const liveFree = await client.query(`
      SELECT fp.provider_id, fp.display_name, fp.status, fp.rate_type, fp.base_rate, p.email
      FROM public.freelancer_profiles fp
      LEFT JOIN public.providers pr ON pr.id = fp.provider_id
      LEFT JOIN public.profiles p ON p.id = pr.user_id
    `);
    console.table(liveFree.rows);

    console.log("\n=== REMAINING LIVE VENDORS ===");
    const liveVend = await client.query(`
      SELECT vp.provider_id, vp.business_name, vp.status, vp.location
      FROM public.vendor_profiles vp
    `);
    console.table(liveVend.rows);
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("Failed, rolled back:", err);
  } finally {
    await client.end();
  }
}

runFixtureCleanup().catch(console.error);
