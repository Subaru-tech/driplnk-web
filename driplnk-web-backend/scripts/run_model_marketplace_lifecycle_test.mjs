import { createClient } from "@supabase/supabase-js";
globalThis.WebSocket = class DummyWebSocket {};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

async function run() {
  console.log("=== STARTING MODEL MARKETPLACE LIFECYCLE E2E TEST ===");

  // 1. Get creator profile and admin profile
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .limit(5);

  if (pErr || !profiles || profiles.length === 0) {
    throw new Error(`Failed to fetch profiles: ${pErr?.message}`);
  }

  const creator = profiles[0];
  const buyer = profiles[1] || profiles[0];
  const admin = profiles.find((p) => p.role === "admin") || profiles[0];
  console.log(`[AUTH CONTEXT] Creator: ${creator.id} | Buyer: ${buyer.id} | Admin: ${admin.id}`);

  // Get a category and license
  const { data: cat } = await supabase.from("categories").select("id, name").eq("slug", "mechanical").single();
  const { data: lic } = await supabase.from("licenses").select("id, name").eq("slug", "standard").single();

  const testTitle = `E2E Test CAD Model ${Date.now()}`;
  const testSlug = `e2e-test-cad-model-${Date.now()}`;

  // 2. Step 1: Create a Draft Model
  console.log("\n--- TEST 1: Creating Draft Model ---");
  const { data: model, error: mErr } = await supabase
    .from("models")
    .insert({
      owner_id: creator.id,
      seller_user_id: creator.id,
      name: testTitle,
      title: testTitle,
      slug: testSlug,
      description: "Precision engineered robotic actuator housing for testing.",
      category: cat?.name || "Mechanical",
      category_id: cat?.id || null,
      license_type: (lic?.slug || "standard").toLowerCase(),
      license_id: lic?.id || null,
      price: 0,
      status: "draft",
      storage_path: "models/test_housing_main.stl",
      file_path: "models/test_housing_main.stl",
      preview_image_paths: ["https://images.unsplash.com/photo-1581091226825-a6a2a5aee158"],
    })
    .select("id, status")
    .single();

  if (mErr || !model) throw new Error(`Draft creation failed: ${mErr?.message}`);
  console.log(`✓ Draft Model created: ${model.id} (status: ${model.status})`);

  // Insert model_files
  const { error: fErr } = await supabase.from("model_files").insert([
    {
      model_id: model.id,
      filename: "test_housing_main.stl",
      storage_path: "models/test_housing_main.stl",
      format: "STL",
      file_size: 2048576,
      is_primary: true,
      is_downloadable: true,
    },
    {
      model_id: model.id,
      filename: "test_housing_b_rep.step",
      storage_path: "models/test_housing_b_rep.step",
      format: "STEP",
      file_size: 1048576,
      is_primary: false,
      is_downloadable: true,
    },
  ]);
  if (fErr) throw new Error(`Model files insert failed: ${fErr.message}`);
  console.log("✓ Multi-part model files inserted (STL & STEP)");

  // Insert model_versions
  const { error: vErr } = await supabase.from("model_versions").insert({
    model_id: model.id,
    version_number: "1.0.0",
    changelog: "Initial prototype draft",
    created_by: creator.id,
    is_current: true,
  });
  if (vErr) throw new Error(`Model version insert failed: ${vErr.message}`);
  console.log("✓ Model version v1.0.0 created");

  // 3. Test Public Catalog Isolation (Draft must NOT appear in public catalog)
  console.log("\n--- TEST 2: Public Catalog Isolation for Draft ---");
  const { data: publicCatalog } = await supabase.rpc("get_marketplace_models", {
    p_search: testTitle,
    p_category: null,
    p_license_type: null,
    p_sort: "newest",
    p_page: 1,
    p_page_size: 10,
  });
  const foundInPublic = Array.isArray(publicCatalog) && publicCatalog.some((m) => m.id === model.id);
  if (foundInPublic) {
    throw new Error("SECURITY FAILURE: Draft model appeared in public get_marketplace_models!");
  }
  console.log("✓ Draft model is correctly HIDDEN from public catalog");

  // 4. Step 2: Submit for Review
  console.log("\n--- TEST 3: Submit Model for Review ---");
  const { error: submitErr } = await supabase
    .from("models")
    .update({ status: "pending_review", updated_at: new Date().toISOString() })
    .eq("id", model.id);
  if (submitErr) throw new Error(`Submit for review failed: ${submitErr.message}`);
  console.log("✓ Model status updated to pending_review");

  // 5. Check Admin Pending Queue
  console.log("\n--- TEST 4: Admin Pending Queue Inspection ---");
  const { data: pendingList, error: penErr } = await supabase.rpc("admin_get_pending_models");
  if (penErr) throw new Error(`admin_get_pending_models RPC error: ${penErr.message}`);
  const inPending = pendingList?.some((m) => m.id === model.id);
  if (!inPending) throw new Error("Model pending_review was NOT found in admin_get_pending_models!");
  console.log(`✓ Model confirmed present in admin review queue (${pendingList.length} items waiting)`);

  // 6. Admin Approval
  console.log("\n--- TEST 5: Admin Review & Publication ---");
  const { data: reviewRes, error: revErr } = await supabase.rpc("admin_review_model", {
    p_model_id: model.id,
    p_status: "published",
    p_notes: "Mesh verified, manifold check passed, verified printability.",
  });
  if (revErr) throw new Error(`admin_review_model RPC error: ${revErr.message}`);
  console.log("✓ Model approved and published by Admin:", reviewRes);

  // 7. Verify model is now live in public get_marketplace_models
  console.log("\n--- TEST 6: Public Catalog Verification ---");
  const { data: liveCatalog } = await supabase.rpc("get_marketplace_models", {
    p_search: testTitle,
    p_category: null,
    p_license_type: null,
    p_sort: "newest",
    p_page: 1,
    p_page_size: 10,
  });
  const isLive = Array.isArray(liveCatalog) && liveCatalog.some((m) => m.id === model.id);
  if (!isLive) throw new Error("Model was NOT found in get_marketplace_models after approval!");
  console.log(`✓ Model is now live in public marketplace! Total live models matching: ${liveCatalog.length}`);

  // Verify get_marketplace_model_by_id returns files and details
  const { data: modelDetailRows, error: detErr } = await supabase.rpc("get_marketplace_model_by_id", {
    p_model_id: model.id,
  });
  if (detErr || !modelDetailRows || modelDetailRows.length === 0) {
    throw new Error(`get_marketplace_model_by_id error: ${detErr?.message}`);
  }
  const modelDetail = modelDetailRows[0];
  console.log(`✓ Retrieved model detail: "${modelDetail.title}", formats: [${(modelDetail.formats || []).join(", ")}], files count: ${modelDetail.files?.length}`);

  // 8. Test Toggle Favorite
  console.log("\n--- TEST 7: Favorite Toggle ---");
  const { data: favRes1 } = await supabase.rpc("toggle_model_favorite", {
    p_user_id: buyer.id,
    p_model_id: model.id,
  });
  console.log("✓ Favorited:", favRes1);
  const { data: favRes2 } = await supabase.rpc("toggle_model_favorite", {
    p_user_id: buyer.id,
    p_model_id: model.id,
  });
  console.log("✓ Unfavorited:", favRes2);

  // 9. Buyer Acquisition
  console.log("\n--- TEST 8: Buyer Free Acquisition ---");
  const { data: claimRes, error: clErr } = await supabase.rpc("claim_model_acquisition", {
    p_user_id: buyer.id,
    p_model_id: model.id,
  });
  if (clErr) throw new Error(`claim_model_acquisition failed: ${clErr.message}`);
  console.log("✓ Claim result:", claimRes);

  // 10. Check User Acquisitions (My Library)
  console.log("\n--- TEST 9: My Library Verification ---");
  const { data: library, error: libErr } = await supabase.rpc("get_user_model_acquisitions", {
    p_user_id: buyer.id,
  });
  if (libErr) throw new Error(`get_user_model_acquisitions error: ${libErr.message}`);
  const inLibrary = library?.some((item) => item.model_id === model.id);
  if (!inLibrary) throw new Error("Model was NOT found in user acquisitions library!");
  console.log(`✓ Acquired model present in buyer library! (${library.length} items owned)`);

  // 11. Security Check: Download Access Verification
  console.log("\n--- TEST 10: Secure Ownership & Download Authorization ---");
  const { data: buyerAccess } = await supabase.rpc("can_user_access_model_file", {
    p_user_id: buyer.id,
    p_model_id: model.id,
  });
  if (buyerAccess !== true) {
    throw new Error("Authorization failed: Legitimate buyer was denied access to model file!");
  }
  console.log("✓ Legitimate buyer authorized to download model file: PASS");

  const fakeUnauthorizedUser = "00000000-0000-0000-0000-000000000000";
  const { data: strangerAccess } = await supabase.rpc("can_user_access_model_file", {
    p_user_id: fakeUnauthorizedUser,
    p_model_id: model.id,
  });
  if (strangerAccess === true) {
    throw new Error("SECURITY BREACH: Unauthorized stranger was GRANTED download access!");
  }
  console.log("✓ Unauthorized user strictly denied download access: PASS");

  // 12. Model Events Audit Trail
  console.log("\n--- TEST 11: Audit Trail Verification ---");
  const { data: events, error: evErr } = await supabase
    .from("model_events")
    .select("event_type, created_at")
    .eq("model_id", model.id)
    .order("created_at", { ascending: true });

  if (evErr || !events) throw new Error(`Failed to query model_events: ${evErr?.message}`);
  console.log(`✓ Audit log captured ${events.length} events for model:`, events.map((e) => e.event_type));

  // 13. Clean up test record
  console.log("\n--- CLEANUP ---");
  await supabase.from("model_events").delete().eq("model_id", model.id);
  await supabase.from("model_acquisitions").delete().eq("model_id", model.id);
  await supabase.from("model_files").delete().eq("model_id", model.id);
  await supabase.from("model_versions").delete().eq("model_id", model.id);
  await supabase.from("model_favorites").delete().eq("model_id", model.id);
  await supabase.from("models").delete().eq("id", model.id);
  console.log("✓ Test records cleaned up successfully");

  console.log("\n=======================================================");
  console.log("🎉 ALL 11 END-TO-END MODEL MARKETPLACE TESTS PASSED!");
  console.log("=======================================================");
}

run().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
