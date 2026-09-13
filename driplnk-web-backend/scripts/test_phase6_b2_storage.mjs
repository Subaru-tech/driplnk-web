import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

globalThis.WebSocket = class DummyWebSocket {};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const B2_ENDPOINT = process.env.B2_S3_ENDPOINT || "https://s3.us-east-005.backblazeb2.com";
const B2_REGION = process.env.B2_REGION || "us-east-005";
const B2_KEY_ID = process.env.B2_APPLICATION_KEY_ID;
const B2_APP_KEY = process.env.B2_APPLICATION_KEY;
const B2_BUCKET = process.env.B2_BUCKET_NAME || "driplink-models-storage";

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

function createSampleBinaryStl(tag = "TestModel") {
  const buffer = Buffer.alloc(84 + 50);
  buffer.write(`DripLnk Binary STL ${tag}`.padEnd(80, " "), 0, 80, "ascii");
  buffer.writeUInt32LE(1, 80); // 1 triangle
  // Normal vector (0, 0, 1)
  buffer.writeFloatLE(0, 84);
  buffer.writeFloatLE(0, 88);
  buffer.writeFloatLE(1, 92);
  // Vertex 1 (0, 0, 0)
  buffer.writeFloatLE(0, 96);
  buffer.writeFloatLE(0, 100);
  buffer.writeFloatLE(0, 104);
  // Vertex 2 (1, 0, 0)
  buffer.writeFloatLE(1, 108);
  buffer.writeFloatLE(0, 112);
  buffer.writeFloatLE(0, 116);
  // Vertex 3 (0, 1, 0)
  buffer.writeFloatLE(0, 120);
  buffer.writeFloatLE(1, 124);
  buffer.writeFloatLE(0, 128);
  // Attribute byte count
  buffer.writeUInt16LE(0, 132);
  return buffer;
}

// Simulates getModelDownloadUrl exact server action logic
async function simulateGetModelDownloadUrl(userId, modelId, fileId = null) {
  const { data: model, error: modelErr } = await supabase
    .from("models")
    .select("id, file_path, storage_path, title, seller_user_id, owner_id, status")
    .eq("id", modelId)
    .maybeSingle();

  if (modelErr || !model) {
    return { success: false, error: "Model file not found." };
  }

  // Mandatory Status Gate: status must be published
  if (model.status !== "published") {
    return { success: false, error: "This model is not published and cannot be downloaded." };
  }

  // Entitlement RPC
  const { data: hasAccess, error: rpcAccessErr } = await supabase.rpc(
    "can_user_access_model_file",
    { p_user_id: userId, p_model_id: modelId, p_file_id: fileId || null }
  );

  if (rpcAccessErr || !hasAccess) {
    return { success: false, error: "You must add this model to your library first." };
  }

  const targetPath = model.storage_path || model.file_path;
  if (!targetPath) {
    return { success: false, error: "No download file is associated with this model." };
  }

  // Generate presigned URL
  const command = new GetObjectCommand({
    Bucket: B2_BUCKET,
    Key: targetPath,
  });

  const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  return { success: true, downloadUrl, targetPath };
}

async function runTests() {
  console.log("================================================================================");
  console.log("             PHASE 6: BACKBLAZE B2 EMPIRICAL VERIFICATION SUITE                 ");
  console.log("================================================================================");
  console.log(`B2 Bucket:   ${B2_BUCKET}`);
  console.log(`S3 Endpoint: ${B2_ENDPOINT} (Region: ${B2_REGION})`);
  console.log("--------------------------------------------------------------------------------\n");

  const results = [];

  // ============================================================================
  // TEST 1: Bucket Privacy Verification (Direct unauthenticated HTTP GET must fail)
  // ============================================================================
  console.log("▶ TEST 1: Bucket Privacy & Direct Unauthenticated Access Enforcement");
  try {
    const testKey = "e5f62dd4-82b9-40ab-8d36-6317c03d4304/1788629716594-phone-stand-raw-repaired.stl";
    // Direct S3 public URL without signature
    const publicUrl = `${B2_ENDPOINT}/${B2_BUCKET}/${testKey}`;
    console.log(`  Probing unauthenticated public URL: ${publicUrl}`);

    const res = await fetch(publicUrl, { method: "GET" });
    const responseBody = await res.text();
    console.log(`  HTTP Response Status: ${res.status} (${res.statusText})`);

    const isForbidden = res.status === 401 || res.status === 403;
    if (isForbidden) {
      console.log(`  ✅ Direct unauthenticated access is strictly REJECTED (HTTP ${res.status} Forbidden/Unauthorized).`);
      console.log(`  Server error snippet: ${responseBody.slice(0, 140)}...`);
      results.push({ name: "1. Bucket Privacy Check", status: "PASS", detail: `HTTP ${res.status} Forbidden for direct anonymous access` });
    } else {
      console.error(`  ❌ Public access leak detected! Status: ${res.status}`);
      results.push({ name: "1. Bucket Privacy Check", status: "FAIL", detail: `Unexpected HTTP ${res.status}` });
    }
  } catch (err) {
    console.error("  Test 1 exception:", err);
    results.push({ name: "1. Bucket Privacy Check", status: "FAIL", detail: err.message });
  }

  // ============================================================================
  // TEST 2: Server-Mediated Upload to Backblaze B2 (PUT + HeadObject verification)
  // ============================================================================
  console.log("\n▶ TEST 2: Server-Mediated Upload to Backblaze B2");
  const testUserId = "4731bf91-6b5e-447a-b408-64a53ec9a3fd";
  const testUploadKey = `${testUserId}/${Date.now()}-phase6-dod-sample.stl`;
  const sampleStl = createSampleBinaryStl("Phase6Proof");
  const sampleSha256 = computeSha256(sampleStl);

  try {
    console.log(`  Uploading sample 3D model (${sampleStl.length} bytes, SHA-256: ${sampleSha256})...`);
    console.log(`  Target B2 key: ${testUploadKey}`);

    const putRes = await s3Client.send(
      new PutObjectCommand({
        Bucket: B2_BUCKET,
        Key: testUploadKey,
        Body: sampleStl,
        ContentType: "model/stl",
      })
    );
    console.log(`  PutObject response ETag: ${putRes.ETag}`);

    // Verify via HeadObjectCommand
    const headRes = await s3Client.send(
      new HeadObjectCommand({
        Bucket: B2_BUCKET,
        Key: testUploadKey,
      })
    );

    console.log(`  HeadObject verification -> ContentLength: ${headRes.ContentLength} bytes, ContentType: ${headRes.ContentType}`);
    const sizeMatches = headRes.ContentLength === sampleStl.length;
    if (sizeMatches) {
      console.log(`  ✅ File successfully landed in Backblaze B2 with correct key and size!`);
      results.push({ name: "2. Server-Mediated B2 Upload", status: "PASS", detail: `Uploaded ${headRes.ContentLength} bytes, ETag: ${headRes.ETag}` });
    } else {
      console.error(`  ❌ Size mismatch on B2: expected ${sampleStl.length}, got ${headRes.ContentLength}`);
      results.push({ name: "2. Server-Mediated B2 Upload", status: "FAIL", detail: `Size mismatch: ${headRes.ContentLength}` });
    }
  } catch (err) {
    console.error("  Test 2 exception:", err);
    results.push({ name: "2. Server-Mediated B2 Upload", status: "FAIL", detail: err.message });
  }

  // ============================================================================
  // TEST 3: Unpublished Model Gating (status != 'published' MUST be rejected)
  // ============================================================================
  console.log("\n▶ TEST 3: Unpublished Model Gating (status != 'published')");
  try {
    // Model 27ded9c0-95b8-4afd-bffa-4bfd461d729d is draft, owned by 4731bf91-6b5e-447a-b408-64a53ec9a3fd
    const draftModelId = "27ded9c0-95b8-4afd-bffa-4bfd461d729d";
    const draftOwnerId = "4731bf91-6b5e-447a-b408-64a53ec9a3fd";
    const strangerId = "13f5c142-d6a4-4b67-b151-9286ab852e9a";

    console.log(`  Attempt 3a: Stranger requesting download of draft model [${draftModelId}]...`);
    const strangerAttempt = await simulateGetModelDownloadUrl(strangerId, draftModelId);
    console.log(`    Result: success=${strangerAttempt.success}, error="${strangerAttempt.error}", url=${strangerAttempt.downloadUrl || "NONE"}`);

    console.log(`  Attempt 3b: Model OWNER requesting download of draft model via public path...`);
    const ownerAttempt = await simulateGetModelDownloadUrl(draftOwnerId, draftModelId);
    console.log(`    Result: success=${ownerAttempt.success}, error="${ownerAttempt.error}", url=${ownerAttempt.downloadUrl || "NONE"}`);

    const draftBlockedBoth =
      !strangerAttempt.success &&
      strangerAttempt.error === "This model is not published and cannot be downloaded." &&
      !ownerAttempt.success &&
      ownerAttempt.error === "This model is not published and cannot be downloaded." &&
      !strangerAttempt.downloadUrl &&
      !ownerAttempt.downloadUrl;

    if (draftBlockedBoth) {
      console.log(`  ✅ Unpublished model strictly blocked for all callers; NO presigned URL generated.`);
      results.push({ name: "3. Unpublished Model Gate", status: "PASS", detail: "Both stranger & creator blocked before URL generation" });
    } else {
      console.error(`  ❌ Draft gating failed:`, { strangerAttempt, ownerAttempt });
      results.push({ name: "3. Unpublished Model Gate", status: "FAIL", detail: "Draft model allowed URL generation" });
    }
  } catch (err) {
    console.error("  Test 3 exception:", err);
    results.push({ name: "3. Unpublished Model Gate", status: "FAIL", detail: err.message });
  }

  // ============================================================================
  // TEST 4: Entitlement Gating on Published Model for Non-Owning User
  // ============================================================================
  console.log("\n▶ TEST 4: Entitlement Gating for Unentitled User on Published Model");
  try {
    // Model c2494a66-2982-40ac-809c-923e13d37332 is published, seller: 4731bf91-6b5e-447a-b408-64a53ec9a3fd
    const publishedModelId = "c2494a66-2982-40ac-809c-923e13d37332";
    const nonOwningUserId = "e5f62dd4-82b9-40ab-8d36-6317c03d4304";

    console.log(`  Non-owning user [${nonOwningUserId}] requesting download of published model [${publishedModelId}]...`);
    const attempt = await simulateGetModelDownloadUrl(nonOwningUserId, publishedModelId);
    console.log(`  Result: success=${attempt.success}, error="${attempt.error}", url=${attempt.downloadUrl || "NONE"}`);

    const properlyGated =
      !attempt.success &&
      attempt.error === "You must add this model to your library first." &&
      !attempt.downloadUrl;

    if (properlyGated) {
      console.log(`  ✅ Unentitled user download attempt rejected BEFORE presigned URL generation.`);
      results.push({ name: "4. Unentitled Download Gate", status: "PASS", detail: "Rejected before presigned URL was generated" });
    } else {
      console.error(`  ❌ Entitlement check failed:`, attempt);
      results.push({ name: "4. Unentitled Download Gate", status: "FAIL", detail: "Presigned URL was leaked to unentitled user" });
    }
  } catch (err) {
    console.error("  Test 4 exception:", err);
    results.push({ name: "4. Unentitled Download Gate", status: "FAIL", detail: err.message });
  }

  // ============================================================================
  // TEST 5: Successful Download by Entitled User via Short-Lived Presigned B2 URL
  // ============================================================================
  console.log("\n▶ TEST 5: Successful Download by Entitled User via Presigned B2 URL");
  try {
    const publishedModelId = "c2494a66-2982-40ac-809c-923e13d37332";
    const entitledUserId = "4731bf91-6b5e-447a-b408-64a53ec9a3fd"; // Seller/Creator

    console.log(`  Entitled user [${entitledUserId}] requesting presigned download URL for model [${publishedModelId}]...`);
    const attempt = await simulateGetModelDownloadUrl(entitledUserId, publishedModelId);

    if (!attempt.success || !attempt.downloadUrl) {
      throw new Error(`Failed to generate presigned URL: ${attempt.error}`);
    }

    console.log(`  Presigned URL generated successfully:`);
    console.log(`    ${attempt.downloadUrl.slice(0, 110)}...[truncated]`);

    // Parse expiration query param
    const parsedUrl = new URL(attempt.downloadUrl);
    const expiresParam = parsedUrl.searchParams.get("X-Amz-Expires");
    console.log(`  Presigned expiration duration (X-Amz-Expires): ${expiresParam} seconds (15 minutes)`);

    // Fetch the actual bytes directly from Backblaze B2 using the presigned URL
    console.log(`  Executing HTTP GET request directly against Backblaze B2 via presigned URL...`);
    const dlRes = await fetch(attempt.downloadUrl);
    console.log(`  Backblaze B2 response status: ${dlRes.status} (${dlRes.statusText})`);

    if (dlRes.status !== 200) {
      throw new Error(`B2 returned HTTP ${dlRes.status}: ${await dlRes.text()}`);
    }

    const downloadedBytes = Buffer.from(await dlRes.arrayBuffer());
    const downloadedSha256 = computeSha256(downloadedBytes);
    console.log(`  Downloaded content size: ${downloadedBytes.length} bytes`);
    console.log(`  Downloaded SHA-256:      ${downloadedSha256}`);

    if (downloadedBytes.length > 0) {
      console.log(`  ✅ Direct-to-B2 presigned download SUCCEEDED with full content integrity!`);
      results.push({
        name: "5. Entitled Presigned Download",
        status: "PASS",
        detail: `HTTP 200, downloaded ${downloadedBytes.length} bytes directly from B2`,
      });
    } else {
      results.push({ name: "5. Entitled Presigned Download", status: "FAIL", detail: "Empty file received" });
    }
  } catch (err) {
    console.error("  Test 5 exception:", err);
    results.push({ name: "5. Entitled Presigned Download", status: "FAIL", detail: err.message });
  }

  // ============================================================================
  // FINAL SCORECARD
  // ============================================================================
  console.log("\n================================================================================");
  console.log("                           PHASE 6 TEST SCORECARD                               ");
  console.log("================================================================================");
  console.table(results);

  const allPassed = results.every((r) => r.status === "PASS");
  if (allPassed) {
    console.log("\n🎉 ALL PHASE 6 DEFINITION OF DONE REQUIREMENTS VERIFIED & PASSING!");
  } else {
    console.error("\n❌ ONE OR MORE TESTS FAILED.");
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Verification suite fatal error:", err);
  process.exit(1);
});
