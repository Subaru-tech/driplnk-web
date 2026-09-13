import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Ensure Node 20 WebSocket compatibility
globalThis.WebSocket = class DummyWebSocket {};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const B2_ENDPOINT = process.env.B2_S3_ENDPOINT || "https://s3.us-east-005.backblazeb2.com";
const B2_REGION = process.env.B2_REGION || "us-east-005";
const B2_KEY_ID = process.env.B2_APPLICATION_KEY_ID;
const B2_APP_KEY = process.env.B2_APPLICATION_KEY;
const B2_BUCKET = process.env.B2_BUCKET_NAME || "driplink-models-storage";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase credentials in environment.");
  process.exit(1);
}

if (!B2_KEY_ID || !B2_APP_KEY) {
  console.error("Missing Backblaze B2 credentials in environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const s3Client = new S3Client({
  endpoint: B2_ENDPOINT,
  region: B2_REGION,
  credentials: {
    accessKeyId: B2_KEY_ID,
    secretAccessKey: B2_APP_KEY,
  },
  forcePathStyle: true,
});

function computeSha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function streamToBuffer(readableStream) {
  const chunks = [];
  for await (const chunk of readableStream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function listAllSupabaseFiles(folder = "") {
  const files = [];
  const { data: items, error } = await supabase.storage.from("model-files").list(folder, { limit: 100 });
  if (error) {
    console.warn(`Could not list folder '${folder}':`, error.message);
    return files;
  }

  for (const item of items) {
    const itemPath = folder ? `${folder}/${item.name}` : item.name;
    if (item.id === null) {
      // It's a directory
      const subFiles = await listAllSupabaseFiles(itemPath);
      files.push(...subFiles);
    } else {
      files.push({
        path: itemPath,
        size: item.metadata?.size || item.metadata?.contentLength,
        id: item.id,
      });
    }
  }
  return files;
}

async function runMigration() {
  console.log("================================================================================");
  console.log("             PHASE 6: SUPABASE STORAGE -> BACKBLAZE B2 MIGRATION                ");
  console.log("================================================================================");
  console.log(`Source Storage:      Supabase Storage (bucket: 'model-files')`);
  console.log(`Destination Storage: Backblaze B2 S3 (bucket: '${B2_BUCKET}')`);
  console.log(`Endpoint:            ${B2_ENDPOINT} (Region: ${B2_REGION})`);
  console.log("--------------------------------------------------------------------------------\n");

  // 1. Discover all physical files in Supabase Storage
  console.log("[1/4] Discovering all objects in Supabase Storage 'model-files' bucket...");
  const storageFiles = await listAllSupabaseFiles();
  console.log(`Found ${storageFiles.length} storage object(s) in Supabase Storage:\n`);
  storageFiles.forEach((f, idx) => console.log(`  [${idx + 1}] ${f.path} (${f.size ?? "unknown"} bytes)`));

  // 2. Query models table
  console.log("\n[2/4] Querying 'models' database table...");
  const { data: models, error: modelsErr } = await supabase
    .from("models")
    .select("id, title, file_path, storage_path, status, storage_provider");

  if (modelsErr) {
    console.error("Failed to query models table:", modelsErr);
    process.exit(1);
  }
  console.log(`Found ${models.length} model record(s) in PostgreSQL.\n`);

  // 3. Migrate each file and verify checksums
  console.log("[3/4] Migrating files to Backblaze B2 & verifying cryptographic checksums...");
  const migrationResults = [];

  for (const file of storageFiles) {
    const storagePath = file.path;
    console.log(`\nProcessing: ${storagePath}`);

    // a) Download from Supabase Storage
    const { data: blob, error: dlErr } = await supabase.storage.from("model-files").download(storagePath);
    if (dlErr || !blob) {
      console.error(`  ❌ Failed to download from Supabase Storage:`, dlErr?.message);
      migrationResults.push({
        path: storagePath,
        status: "FAILED_DOWNLOAD",
        error: dlErr?.message,
      });
      continue;
    }

    const originalBuffer = Buffer.from(await blob.arrayBuffer());
    const originalSize = originalBuffer.length;
    const originalSha256 = computeSha256(originalBuffer);
    console.log(`  -> Downloaded original: ${originalSize} bytes, SHA-256: ${originalSha256}`);

    // b) Upload to Backblaze B2
    try {
      const ext = storagePath.split(".").pop()?.toLowerCase();
      const mimeTypes = {
        stl: "model/stl",
        obj: "model/obj",
        step: "model/step",
        stp: "model/step",
        gcode: "text/x.gcode",
        threemf: "model/3mf",
        "3mf": "model/3mf",
      };
      const contentType = mimeTypes[ext] || "application/octet-stream";

      await s3Client.send(
        new PutObjectCommand({
          Bucket: B2_BUCKET,
          Key: storagePath,
          Body: originalBuffer,
          ContentType: contentType,
        })
      );
      console.log(`  -> Uploaded to B2 bucket '${B2_BUCKET}' with key '${storagePath}'`);

      // c) Read back from B2 and verify size and checksum
      const b2GetRes = await s3Client.send(
        new GetObjectCommand({
          Bucket: B2_BUCKET,
          Key: storagePath,
        })
      );

      const b2Buffer = await streamToBuffer(b2GetRes.Body);
      const b2Size = b2Buffer.length;
      const b2Sha256 = computeSha256(b2Buffer);
      console.log(`  -> Readback from B2:    ${b2Size} bytes, SHA-256: ${b2Sha256}`);

      const sizeMatch = originalSize === b2Size;
      const checksumMatch = originalSha256 === b2Sha256;

      if (!sizeMatch || !checksumMatch) {
        console.error(`  ❌ CHECKSUM/SIZE MISMATCH! Source: ${originalSha256}, B2: ${b2Sha256}`);
        migrationResults.push({
          path: storagePath,
          originalSize,
          b2Size,
          originalSha256,
          b2Sha256,
          verified: false,
          status: "CHECKSUM_MISMATCH",
        });
        continue;
      }

      console.log(`  ✅ Verification PASSED: Size and SHA-256 match perfectly.`);

      // d) Update database rows pointing to this storage path
      const matchingModels = models.filter(
        (m) => m.file_path === storagePath || m.storage_path === storagePath
      );

      let dbUpdated = 0;
      for (const model of matchingModels) {
        const { error: updateErr } = await supabase
          .from("models")
          .update({
            storage_path: storagePath,
            file_path: storagePath,
            storage_provider: "backblaze-b2",
            updated_at: new Date().toISOString(),
          })
          .eq("id", model.id);

        if (updateErr) {
          console.error(`  ❌ Failed to update model ${model.id} in DB:`, updateErr);
        } else {
          dbUpdated++;
          console.log(`  -> Updated DB model [${model.id}] '${model.title}' -> storage_provider: backblaze-b2`);
        }
      }

      migrationResults.push({
        path: storagePath,
        size: originalSize,
        sha256: originalSha256,
        b2Sha256,
        verified: true,
        matchingModelsCount: matchingModels.length,
        dbUpdatedCount: dbUpdated,
        status: "SUCCESS",
      });
    } catch (b2Err) {
      console.error(`  ❌ B2 transfer failed:`, b2Err);
      migrationResults.push({
        path: storagePath,
        status: "B2_ERROR",
        error: b2Err instanceof Error ? b2Err.message : String(b2Err),
      });
    }
  }

  // 4. Verification & Summary Report
  console.log("\n================================================================================");
  console.log("                        MIGRATION SUMMARY & VERIFICATION                        ");
  console.log("================================================================================");
  console.table(
    migrationResults.map((r) => ({
      "Storage Object Key": r.path,
      "Size (Bytes)": r.size || r.originalSize || "N/A",
      "Source SHA-256": (r.sha256 || r.originalSha256 || "").slice(0, 16) + "...",
      "B2 SHA-256": (r.b2Sha256 || "").slice(0, 16) + "...",
      "Integrity Check": r.verified ? "MATCH (PASS)" : "FAILED",
      "DB Pointers Updated": `${r.dbUpdatedCount ?? 0}/${r.matchingModelsCount ?? 0}`,
      Status: r.status,
    }))
  );

  const allPassed = migrationResults.length > 0 && migrationResults.every((r) => r.verified);
  if (allPassed) {
    console.log("\n✅ ALL EXISTING OBJECTS SUCCESSFULLY MIGRATED AND VERIFIED BIT-FOR-BIT!");
    console.log("Original Supabase Storage files are PRESERVED as backup.");
  } else {
    console.error("\n❌ WARNING: Some objects encountered errors during migration.");
    process.exit(1);
  }
}

runMigration().catch((err) => {
  console.error("Migration execution fatal error:", err);
  process.exit(1);
});
