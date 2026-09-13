import { createClient } from "@supabase/supabase-js";


const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const adminSupabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

async function run() {
  console.log("=== STARTING FULL FREELANCE LIFECYCLE VERIFICATION ===");

  const buyerUserId = "24970a5c-1b32-4735-ab78-919497b61e35"; // Subaru 02
  const specialistUserId = "e5f62dd4-82b9-40ab-8d36-6317c03d4304"; // Atharva Ramani
  const specialistProviderId = "b8686a6c-74d7-432e-9732-995b8cb79256";

  console.log(`Buyer: ${buyerUserId}`);
  console.log(`Specialist Provider: ${specialistProviderId} (User: ${specialistUserId})`);

  // Step 1: Buyer creates a request
  console.log("\n[Step 1] Buyer creates freelance request via create_freelance_request RPC...");
  const { data: requestId, error: reqErr } = await adminSupabase.rpc("create_freelance_request", {
    p_buyer_user_id: buyerUserId,
    p_freelancer_provider_id: specialistProviderId,
    p_brief: "Custom Drone Gimbal Enclosure with vibration dampeners and quick-release GoPro latch. Tolerances: ±0.1mm for FDM PETG-CF.",
    p_reference_file_paths: ["references/spec_sheet_v1.pdf", "references/mounting_holes.dxf"]
  });

  if (reqErr) {
    console.error("Step 1 failed:", reqErr);
    process.exit(1);
  }
  const reqId = typeof requestId === "object" && requestId?.request_id ? requestId.request_id : requestId;
  console.log("✓ Request created! ID:", reqId);

  // Direct Supabase Query verification for Step 1
  const { data: q1, error: q1Err } = await adminSupabase
    .from("freelance_requests")
    .select("id, buyer_user_id, freelancer_provider_id, status, agreed_price, final_file_path, brief")
    .eq("id", reqId)
    .single();

  console.log("Direct Supabase Query [Step 1]:", q1);
  if (q1.status !== "requested" || q1.agreed_price !== null) {
    throw new Error("Step 1 assertion failed!");
  }

  // Step 2: Specialist accepts the request with agreed price 4800
  console.log("\n[Step 2] Specialist accepts request with agreed_price = 4800...");
  const { error: acceptErr } = await adminSupabase.rpc("respond_to_freelance_request", {
    p_request_id: reqId,
    p_user_id: specialistUserId,
    p_action: "accept",
    p_agreed_price: 4800
  });

  if (acceptErr) {
    console.error("Step 2 failed:", acceptErr);
    process.exit(1);
  }
  console.log("✓ Request accepted!");

  // Direct Supabase Query verification for Step 2
  const { data: q2 } = await adminSupabase
    .from("freelance_requests")
    .select("id, status, agreed_price, updated_at")
    .eq("id", reqId)
    .single();

  console.log("Direct Supabase Query [Step 2]:", q2);
  if (q2.status !== "accepted" || Number(q2.agreed_price) !== 4800) {
    throw new Error("Step 2 assertion failed!");
  }

  // Step 3: Check email visibility when accepted
  console.log("\n[Step 3] Verifying email visibility in get_freelance_requests_for_user RPC...");
  const { data: buyerView } = await adminSupabase.rpc("get_freelance_requests_for_user", {
    p_user_id: buyerUserId,
    p_role: "buyer"
  });
  const myReqAsBuyer = buyerView.find((r) => r.request_id === reqId);
  console.log("Buyer view of request (counterparty email):", {
    freelancer_name: myReqAsBuyer.freelancer_name,
    freelancer_email: myReqAsBuyer.freelancer_email
  });

  const { data: specialistView } = await adminSupabase.rpc("get_freelance_requests_for_user", {
    p_user_id: specialistUserId,
    p_role: "freelancer"
  });
  const myJobAsSpecialist = specialistView.find((r) => r.request_id === reqId);
  console.log("Specialist view of request (counterparty email):", {
    buyer_name: myJobAsSpecialist.buyer_name,
    buyer_email: myJobAsSpecialist.buyer_email
  });

  if (!myReqAsBuyer.freelancer_email || !myJobAsSpecialist.buyer_email) {
    throw new Error("Emails should be visible once accepted!");
  }

  // Step 4: Specialist delivers final CAD file
  console.log("\n[Step 4] Specialist uploads deliverable and marks delivered...");
  const dummyStlContent = Buffer.from("solid drone_gimbal\nfacet normal 0 0 0\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid");
  const deliverablePath = `deliverables/${reqId}/gimbal_v1_final.stl`;

  const { error: uploadErr } = await adminSupabase.storage
    .from("freelance-deliverables")
    .upload(deliverablePath, dummyStlContent, {
      contentType: "model/stl",
      upsert: true
    });

  if (uploadErr) {
    console.error("Deliverable upload failed:", uploadErr);
    process.exit(1);
  }
  console.log("✓ Deliverable uploaded to freelance-deliverables bucket:", deliverablePath);

  const { error: deliverErr } = await adminSupabase.rpc("respond_to_freelance_request", {
    p_request_id: reqId,
    p_user_id: specialistUserId,
    p_action: "deliver",
    p_final_file_path: deliverablePath
  });

  if (deliverErr) {
    console.error("Deliver RPC failed:", deliverErr);
    process.exit(1);
  }

  // Direct Supabase Query verification for Step 4
  const { data: q4 } = await adminSupabase
    .from("freelance_requests")
    .select("id, status, agreed_price, final_file_path")
    .eq("id", reqId)
    .single();

  console.log("Direct Supabase Query [Step 4]:", q4);
  if (q4.status !== "delivered" || q4.final_file_path !== deliverablePath) {
    throw new Error("Step 4 assertion failed!");
  }

  // Step 5: Buyer creates signed download URL and completes request
  console.log("\n[Step 5] Buyer downloads file and marks request completed...");
  const { data: signedUrlData, error: signErr } = await adminSupabase.storage
    .from("freelance-deliverables")
    .createSignedUrl(deliverablePath, 3600);

  if (signErr || !signedUrlData?.signedUrl) {
    console.error("Signed URL creation failed:", signErr);
    process.exit(1);
  }
  console.log("✓ Signed download URL generated successfully! (Length:", signedUrlData.signedUrl.length, ")");

  const { error: completeErr } = await adminSupabase.rpc("respond_to_freelance_request", {
    p_request_id: reqId,
    p_user_id: buyerUserId,
    p_action: "complete"
  });

  if (completeErr) {
    console.error("Complete RPC failed:", completeErr);
    process.exit(1);
  }

  // Direct Supabase Query verification for Step 5
  const { data: q5 } = await adminSupabase
    .from("freelance_requests")
    .select("id, status, agreed_price, final_file_path, updated_at")
    .eq("id", reqId)
    .single();

  console.log("Direct Supabase Query [Step 5]:", q5);
  if (q5.status !== "completed") {
    throw new Error("Step 5 assertion failed!");
  }

  console.log("\n=== ALL LIFECYCLE TRANSITIONS VERIFIED END-TO-END! ===");
}

run().catch(console.error);
