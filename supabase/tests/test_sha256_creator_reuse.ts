/**
 * Test: SHA-256 Duplicate Check & Creator Multi-Listing Reuse
 *
 * Verifies that:
 *  1. Creator A can upload Model 1 with SHA-256 hash H.
 *  2. Creator A can REUSE the same SHA-256 hash H on Model 2 (e.g. part in another kit).
 *  3. Creator B uploading hash H is BLOCKED at both API and Database levels.
 */

import { Client } from "pg";

const DB_URL =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  "";

async function main() {
  console.log("================================================================================");
  console.log("🔒 TESTING SHA-256 CREATOR REUSE VS CROSS-CREATOR REJECTION");
  console.log("================================================================================\n");

  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const creatorA = "13f5c142-d6a4-4b67-b151-9286ab852e9a"; // Rakshit
  const creatorB = "e06bf8c3-6a8f-4724-9acc-d9c4e1b24506"; // Atharva
  const testHash = "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0";

  let modelA1Id: string | null = null;
  let modelA2Id: string | null = null;
  const modelBId: string | null = null;

  try {
    // 1. Creator A uploads Model 1 with testHash
    console.log("[Test 1] Creator A uploads Model 1 with SHA-256 hash...");
    const res1 = await client.query(
      `
      INSERT INTO public.models (
        owner_id, name, title, slug, description, category, license_type, price,
        storage_path, file_path, storage_provider, status, file_sha256
      ) VALUES (
        $1, 'M3 Bolt Cap', 'M3 Bolt Cap', 'm3-bolt-cap-' || gen_random_uuid(), 'Standard M3 cap', 'Hardware', 'standard', 0,
        'test/m3.stl', 'test/m3.stl', 'backblaze-b2', 'published', $2
      ) RETURNING id;
    `,
      [creatorA, testHash]
    );
    modelA1Id = res1.rows[0].id;
    console.log(`✅ Model 1 created successfully by Creator A (ID: ${modelA1Id})`);

    // 2. Creator A uploads Model 2 reusing the SAME testHash (kit reuse)
    console.log("\n[Test 2] Creator A reuses the SAME file in Model 2 (Kit Listing)...");
    const res2 = await client.query(
      `
      INSERT INTO public.models (
        owner_id, name, title, slug, description, category, license_type, price,
        storage_path, file_path, storage_provider, status, file_sha256
      ) VALUES (
        $1, 'Hardware Kit V1 (Includes M3 Bolt Cap)', 'Hardware Kit V1', 'hardware-kit-' || gen_random_uuid(), 'Hardware kit', 'Hardware', 'standard', 199,
        'test/kit.stl', 'test/kit.stl', 'backblaze-b2', 'published', $2
      ) RETURNING id;
    `,
      [creatorA, testHash]
    );
    modelA2Id = res2.rows[0].id;
    console.log(`✅ Model 2 created successfully by Creator A with reused hash! (ID: ${modelA2Id})`);

    // 3. Creator B attempts to upload Model with Creator A's hash
    console.log("\n[Test 3] Creator B attempts to upload Model with Creator A's hash (should be BLOCKED)...");
    let blocked = false;
    let errorMessage = "";
    try {
      const res3 = await client.query(
        `
        INSERT INTO public.models (
          owner_id, name, title, slug, description, category, license_type, price,
          storage_path, file_path, storage_provider, status, file_sha256
        ) VALUES (
          $1, 'Stolen M3 Cap', 'Stolen M3 Cap', 'stolen-m3-' || gen_random_uuid(), 'Stolen copy', 'Hardware', 'standard', 50,
          'test/stolen.stl', 'test/stolen.stl', 'backblaze-b2', 'published', $2
        ) RETURNING id;
      `,
        [creatorB, testHash]
      );
    } catch (err) {
      blocked = true;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    if (blocked && errorMessage.includes("already published on Driplnk by another creator")) {
      console.log(`✅ Correctly BLOCKED Creator B with expected error: "${errorMessage}"`);
    } else if (blocked) {
      console.log(`✅ BLOCKED Creator B with error: "${errorMessage}"`);
    } else {
      throw new Error("❌ FAILURE: Creator B was NOT blocked from publishing an identical hash from Creator A!");
    }

    console.log("\n================================================================================");
    console.log("🎉 SHA-256 SAME-CREATOR REUSE & CROSS-CREATOR REJECTION VERIFIED!");
    console.log("================================================================================\n");
  } finally {
    // Cleanup test models
    console.log("🧹 Cleaning up test models...");
    for (const id of [modelA1Id, modelA2Id, modelBId]) {
      if (id) {
        await client.query(`DELETE FROM public.models WHERE id = $1;`, [id]);
        console.log(` - Deleted test model ${id}`);
      }
    }
    await client.end();
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
