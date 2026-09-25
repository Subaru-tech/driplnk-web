/**
 * End-to-End Test: Perceptual Hash Duplicate Flagging & Admin Moderation Queue
 *
 * Demonstrates:
 *  1. Original Model A is uploaded by Creator A with perceptual hash A (published).
 *  2. Visually similar Model B is uploaded by Creator B with perceptual hash B (92% visual similarity).
 *  3. Model B is flagged: moderation_status = 'duplicate_review', status = 'pending_review'.
 *  4. Model B appears in the Admin Moderation Queue with similarity details and matched model link.
 */

import { Client } from "pg";

const DB_URL =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  "";

// Generates a normalized 64-dim vector
function generateBaseVector(): number[] {
  const vec: number[] = [];
  for (let i = 0; i < 64; i++) {
    vec.push(Math.sin((i + 1) * 0.4) * 0.5 + 0.5);
  }
  return vec;
}

// Generates a vector with high cosine similarity (~92% similarity)
function generateSimilarVector(base: number[], noise: number = 0.08): number[] {
  return base.map((val) => Math.max(0, Math.min(1, val + (Math.random() - 0.5) * noise)));
}

async function main() {
  console.log("================================================================================");
  console.log("🖼️ TESTING PERCEPTUAL HASH DUPLICATE DETECTION & ADMIN QUEUE WORKFLOW");
  console.log("================================================================================\n");

  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const creatorA = "13f5c142-d6a4-4b67-b151-9286ab852e9a"; // Rakshit
  const creatorB = "e06bf8c3-6a8f-4724-9acc-d9c4e1b24506"; // Atharva

  let modelAId: string | null = null;
  let modelBId: string | null = null;

  try {
    const phashA = generateBaseVector();
    const phashB = generateSimilarVector(phashA, 0.05);

    // Step 1: Creator A publishes original Model A
    console.log("[Step 1] Creator A uploads and publishes original Model A (Dragon Figurine)...");
    const resA = await client.query(
      `
      INSERT INTO public.models (
        owner_id, name, title, slug, description, category, license_type, price,
        storage_path, file_path, storage_provider, status, preview_phash
      ) VALUES (
        $1, 'Articulated Crystal Dragon', 'Articulated Crystal Dragon', 'crystal-dragon-' || gen_random_uuid(),
        'Original articulated crystal dragon model designed from scratch.', 'Art & Collectibles', 'standard', 499,
        'models/dragon.stl', 'models/dragon.stl', 'backblaze-b2', 'published',
        $2::vector
      ) RETURNING id, title, status, moderation_status;
    `,
      [creatorA, `[${phashA.join(",")}]`]
    );
    modelAId = resA.rows[0].id;
    console.log(`✅ Model A created and published: "${resA.rows[0].title}" (ID: ${modelAId})\n`);

    // Step 2: Creator B uploads visually similar Model B
    console.log("[Step 2] Creator B uploads visually-similar Model B (Crystal Dragon Re-upload)...");

    // Match check via match_model_phash
    const matchQuery = await client.query(
      `
      SELECT id, title, similarity
      FROM match_model_phash($1::vector, 0.85, 3);
    `,
      [`[${phashB.join(",")}]`]
    );

    console.log(`🔍 Perceptual Hash match query found ${matchQuery.rows.length} candidate(s):`);
    for (const match of matchQuery.rows) {
      console.log(` -> Matched Model: "${match.title}" (ID: ${match.id}) with ${(match.similarity * 100).toFixed(1)}% visual similarity`);
    }

    const isDuplicate = matchQuery.rows.length > 0;
    const topMatch = matchQuery.rows[0];

    const moderationStatus = isDuplicate ? "duplicate_review" : null;
    const modelStatus = isDuplicate ? "pending_review" : "published";
    const moderationFlags = isDuplicate
      ? {
          duplicate_detected: true,
          matched_model_id: topMatch.id,
          similarity: Number(topMatch.similarity.toFixed(4)),
          flagged_at: new Date().toISOString(),
        }
      : {};

    const resB = await client.query(
      `
      INSERT INTO public.models (
        owner_id, name, title, slug, description, category, license_type, price,
        storage_path, file_path, storage_provider, status, moderation_status, moderation_flags, preview_phash
      ) VALUES (
        $1, 'Crystal Dragon Copy', 'Crystal Dragon Copy', 'crystal-dragon-copy-' || gen_random_uuid(),
        'Claimed remix of crystal dragon.', 'Art & Collectibles', 'standard', 299,
        'models/dragon_copy.stl', 'models/dragon_copy.stl', 'backblaze-b2',
        $2, $3, $4, $5::vector
      ) RETURNING id, title, status, moderation_status, moderation_flags;
    `,
      [creatorB, modelStatus, moderationStatus, JSON.stringify(moderationFlags), `[${phashB.join(",")}]`]
    );
    modelBId = resB.rows[0].id;

    console.log(`\n✅ Model B inserted with status: "${resB.rows[0].status}" and moderation_status: "${resB.rows[0].moderation_status}"`);
    console.log(`   Flags: ${JSON.stringify(resB.rows[0].moderation_flags, null, 2)}\n`);

    // Step 3: Verify Model B sits in the Admin Moderation Queue
    console.log("--------------------------------------------------------------------------------");
    console.log("🛡️ ADMIN MODERATION QUEUE INSPECTION (app/admin/listings)");
    console.log("--------------------------------------------------------------------------------");

    const queueQuery = await client.query(`
      SELECT 
        m.id,
        m.title,
        m.status,
        m.moderation_status,
        m.moderation_flags,
        prof.full_name as creator_name,
        m.created_at
      FROM public.models m
      LEFT JOIN public.profiles prof ON prof.id = m.owner_id
      WHERE m.moderation_status IS NOT NULL
        AND m.id = $1;
    `, [modelBId]);

    if (queueQuery.rows.length === 0) {
      throw new Error("❌ FAILURE: Model B did NOT land in the admin moderation queue!");
    }

    const queuedItem = queueQuery.rows[0];
    console.log(`[QUEUE ENTRY CONFIRMED]`);
    console.log(`Model ID:          ${queuedItem.id}`);
    console.log(`Title:             ${queuedItem.title}`);
    console.log(`Creator:           ${queuedItem.creator_name}`);
    console.log(`Listing Status:    ${queuedItem.status}`);
    console.log(`Moderation Reason: ${queuedItem.moderation_status}`);
    console.log(`Duplicate Match:   Model #${queuedItem.moderation_flags?.matched_model_id} (${(queuedItem.moderation_flags?.similarity * 100).toFixed(1)}% match)`);
    console.log(`Flagged At:        ${queuedItem.moderation_flags?.flagged_at}`);

    console.log("\n================================================================================");
    console.log("🎉 PERCEPTUAL HASH DUPLICATE FLAGGED INTO ADMIN QUEUE SUCCESSFULLY!");
    console.log("================================================================================\n");
  } finally {
    console.log("🧹 Cleaning up test models...");
    if (modelAId) await client.query(`DELETE FROM public.models WHERE id = $1;`, [modelAId]);
    if (modelBId) await client.query(`DELETE FROM public.models WHERE id = $1;`, [modelBId]);
    await client.end();
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
