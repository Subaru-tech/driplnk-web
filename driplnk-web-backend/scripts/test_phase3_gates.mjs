import { createClient } from "@supabase/supabase-js";

import fs from "fs";
import path from "path";

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vjlsuadvxjmxrwnqytmu.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class DummyWebSocket {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  };
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const anonClient = createClient(SUPABASE_URL, ANON_KEY);

const ALLOWED_EXTS = [".stl", ".step", ".stp", ".3mf", ".obj"];
const MAX_BYTES = 50 * 1024 * 1024;
const EICAR_SIG = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

function preCheckFile(name, size, buffer) {
  const dot = name.lastIndexOf(".");
  const ext = dot === -1 ? "" : name.slice(dot).toLowerCase();
  
  // 1. Extension allowlist
  if (!ALLOWED_EXTS.includes(ext)) {
    return { valid: false, reason: `File type '${ext}' disallowed. Allowed: ${ALLOWED_EXTS.join(", ")}` };
  }
  // 2. Max size check
  if (size > MAX_BYTES) {
    return { valid: false, reason: `File size exceeds max 50 MB limit.` };
  }
  // 3. Virus / malware check
  if (buffer.toString().includes(EICAR_SIG)) {
    return { valid: false, reason: `Malware / virus signature detected in file payload (EICAR-Test-Signature). Rejected before storage.` };
  }
  return { valid: true };
}

async function run() {
  console.log("=== PHASE 3 AUTOMATED PRE-CHECKS & MODERATION GATE VERIFICATION ===");

  // TEST 1: Disallowed file type (.sh / .exe)
  const test1 = preCheckFile("malicious_exploit.exe", 1024, Buffer.from("dummy"));
  console.log("\n[TEST 1: Disallowed Extension Check]");
  console.log("File: malicious_exploit.exe");
  console.log("Result: valid =", test1.valid, "| reason:", test1.reason);
  if (test1.valid) throw new Error("Test 1 failed: Disallowed extension was not rejected!");

  // TEST 2: Oversized file (> 50 MB)
  const test2 = preCheckFile("large_assembly.stl", 55 * 1024 * 1024, Buffer.from("dummy"));
  console.log("\n[TEST 2: Oversized File Check]");
  console.log("File: large_assembly.stl (55 MB)");
  console.log("Result: valid =", test2.valid, "| reason:", test2.reason);
  if (test2.valid) throw new Error("Test 2 failed: Oversized file was not rejected!");

  // TEST 3: Malware / Virus EICAR signature
  const test3 = preCheckFile("infected_mesh.stl", 2048, Buffer.from(EICAR_SIG));
  console.log("\n[TEST 3: Malware Signature Check]");
  console.log("File: infected_mesh.stl containing EICAR test signature");
  console.log("Result: valid =", test3.valid, "| reason:", test3.reason);
  if (test3.valid) throw new Error("Test 3 failed: Malware payload was not rejected!");

  // TEST 4: Valid .stl file upload & Moderation Gate Lifecycle
  console.log("\n[TEST 4: Valid Upload & Moderation Gate Lifecycle]");
  const validName = "turbine_blade_test.stl";
  const validBuffer = Buffer.from("solid turbine\nfacet normal 0 0 0\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid turbine");
  const check = preCheckFile(validName, validBuffer.length, validBuffer);
  console.log("Pre-check for valid STL:", check);

  // 1. Upload to storage
  const storagePath = `test-user/${Date.now()}-${validName}`;
  const { error: upErr } = await supabase.storage.from("model-files").upload(storagePath, validBuffer, {
    contentType: "model/stl",
    upsert: true
  });
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);
  console.log("1. Valid file successfully accepted and stored in model-files bucket at:", storagePath);

  // 2. Insert model into DB with status = 'in_review'
  const modelSlug = `turbine-blade-${Date.now().toString(36)}`;
  const { data: newModel, error: insertErr } = await supabase.from("models").insert({
    owner_id: "e5f62dd4-82b9-40ab-8d36-6317c03d4304",
    seller_user_id: "e5f62dd4-82b9-40ab-8d36-6317c03d4304",
    title: "Industrial Turbine Blade Test",
    name: "Industrial Turbine Blade Test",
    slug: modelSlug,
    description: "High tolerance aerospace aerodynamic turbine blade mesh.",
    category: "Mechanical",
    license_type: "standard",
    price: 0,
    status: "in_review",
    storage_path: storagePath,
    file_path: storagePath,
    credits_spent: 0
  }).select("id, status, title").single();

  if (insertErr) throw new Error(`Model insert failed: ${insertErr.message}`);
  console.log("2. Model created in database with status:", newModel.status, "(ID:", newModel.id, ")");

  // 3. Query public catalog via anon client to confirm model is NOT visible in public search
  const { data: publicCatalogBefore } = await anonClient.rpc("get_marketplace_models", {
    p_search: "Industrial Turbine Blade Test"
  });
  const isFoundBefore = (publicCatalogBefore || []).some(m => m.id === newModel.id);
  console.log("3. Public catalog check while 'in_review':");
  console.log("   Found in public catalog?", isFoundBefore, "(Expected: false)");

  // 4. Admin reviews and approves the model
  console.log("4. Simulating Admin approval via admin_review_model RPC...");
  const { data: approved, error: revErr } = await supabase.rpc("admin_review_model", {
    p_model_id: newModel.id,
    p_status: "published",
    p_notes: "CAD geometry and manifold integrity verified by admin."
  });
  if (revErr) throw new Error(`admin_review_model error: ${revErr.message}`);
  console.log("   Admin review result: approved =", approved);

  // 5. Query public catalog again to confirm model is NOW queryable
  const { data: publicCatalogAfter } = await anonClient.rpc("get_marketplace_models", {
    p_search: "Industrial Turbine Blade Test"
  });
  const isFoundAfter = (publicCatalogAfter || []).some(m => m.id === newModel.id);
  console.log("5. Public catalog check after 'published':");
  console.log("   Found in public catalog?", isFoundAfter, "(Expected: true)");

  // Clean up test model
  await supabase.from("models").delete().eq("id", newModel.id);
  await supabase.storage.from("model-files").remove([storagePath]);
  console.log("6. Test model cleaned up.");
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
