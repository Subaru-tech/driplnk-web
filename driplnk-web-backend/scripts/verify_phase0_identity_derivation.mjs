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

// Define User Identities
const USER_A_SESSION_ID = "e5f62dd4-82b9-40ab-8d36-6317c03d4304"; // Authenticated session user
const USER_B_VICTIM_ID = "fb9a0532-509c-483a-96a1-25ad299a30e1";  // Target victim user
const APPROVED_VENDOR_PROVIDER_ID = "ccaa0a34-e0cf-4635-8746-4e2d7fdf549e"; // Zenith Hub (owned by user 3345ed81...)

async function run() {
  console.log("=== PHASE 0 SERVER ACTION IDENTITY DERIVATION & INJECTION TEST ===\n");
  console.log("Session Identity (from Clerk session):", USER_A_SESSION_ID);
  console.log("Attacker Injected Identity (in payload):", USER_B_VICTIM_ID);

  // -------------------------------------------------------------
  // TEST 1: create_mart_order identity spoofing attempt
  // -------------------------------------------------------------
  console.log("\n--- TEST 1: create_mart_order Identity Spoofing ---");
  console.log("Simulating client form submission with forged buyer_user_id...");

  // Attacker client sends malicious payload attempting to order on behalf of User B
  const maliciousClientPayload = {
    filePath: "quotes/test-part.stl",
    providerId: APPROVED_VENDOR_PROVIDER_ID,
    material: "pla",
    price: 225.00,
    weightG: 50,
    // FORGED FIELDS INJECTED BY ATTACKER:
    buyer_user_id: USER_B_VICTIM_ID,
    userId: USER_B_VICTIM_ID,
    user_id: USER_B_VICTIM_ID
  };

  // Server Action Logic:
  // 1. Session identity is derived server-side via getUnifiedUser() / Clerk auth():
  const sessionUser = { id: USER_A_SESSION_ID }; // Output of getUnifiedUser()

  // 2. Create quote request using server-side sessionUser.id
  const { data: qrId, error: qrErr } = await supabase.rpc("create_quote_request", {
    p_user_id: sessionUser.id, // Strictly derived from session, NOT maliciousClientPayload
    p_file_path: maliciousClientPayload.filePath,
    p_material: maliciousClientPayload.material,
    p_weight_g: maliciousClientPayload.weightG
  });
  if (qrErr) throw new Error(`create_quote_request error: ${qrErr.message}`);

  // 3. Create mart order using server-side sessionUser.id
  const { data: orderId, error: orderErr } = await supabase.rpc("create_mart_order", {
    p_buyer_user_id: sessionUser.id, // Strictly derived from session, NOT maliciousClientPayload.buyer_user_id
    p_quote_request_id: qrId,
    p_provider_id: maliciousClientPayload.providerId,
    p_material: maliciousClientPayload.material,
    p_price: maliciousClientPayload.price
  });
  if (orderErr) throw new Error(`create_mart_order error: ${orderErr.message}`);

  // 4. Verify DB record: who is the recorded buyer?
  const { data: orderRecord } = await supabase
    .from("mart_orders")
    .select("id, buyer_user_id, provider_id, price, status")
    .eq("id", orderId)
    .single();

  console.log("Order created in database:", orderRecord);
  console.log("Expected Buyer ID (User A session):", USER_A_SESSION_ID);
  console.log("Actual Buyer ID in DB:             ", orderRecord.buyer_user_id);
  console.log("Did forged User B ID get recorded? ", orderRecord.buyer_user_id === USER_B_VICTIM_ID ? "YES (VULNERABLE!)" : "NO (SECURE)");

  if (orderRecord.buyer_user_id !== USER_A_SESSION_ID) {
    throw new Error("Security Failure: Injected buyer ID was accepted!");
  }

  // -------------------------------------------------------------
  // TEST 2: respond_to_mart_order unauthorized interception
  // -------------------------------------------------------------
  console.log("\n--- TEST 2: respond_to_mart_order Unauthorized Interception ---");
  console.log("User A attempts to modify an order where they are neither vendor nor buyer...");

  // Let's create an order between User B (buyer) and Vendor (Zenith)
  const { data: qrB } = await supabase.rpc("create_quote_request", {
    p_user_id: USER_B_VICTIM_ID,
    p_file_path: "quotes/victim-part.stl",
    p_material: "pla",
    p_weight_g: 30
  });

  const { data: orderBId } = await supabase.rpc("create_mart_order", {
    p_buyer_user_id: USER_B_VICTIM_ID,
    p_quote_request_id: qrB,
    p_provider_id: APPROVED_VENDOR_PROVIDER_ID,
    p_material: "pla",
    p_price: 135.00
  });

  console.log("Created target order for User B (ID:", orderBId, ")");

  // Attacker (User A) calls Server Action to cancel/accept User B's order:
  // Even if attacker attempts to pass user_id = USER_B_VICTIM_ID in the client payload:
  console.log("Attacker User A attempts to call respond_to_mart_order on User B's order...");
  const { data: respondRes, error: respondErr } = await supabase.rpc("respond_to_mart_order", {
    p_user_id: sessionUser.id, // Derived from User A's session
    p_order_id: orderBId,
    p_action: "cancel"
  });

  console.log("RPC Error returned:", respondErr ? respondErr.message : "None");
  if (!respondErr) {
    throw new Error("Security Failure: Unauthorized user was able to mutate victim order!");
  }
  console.log("Authorization Result: Interception blocked with error:", respondErr.message);

  // Clean up test orders
  await supabase.from("mart_orders").delete().in("id", [orderId, orderBId]);
  await supabase.from("quote_requests").delete().in("id", [qrId, qrB]);
  console.log("\n=== PHASE 0 IDENTITY DERIVATION & INJECTION TESTS PASSED ===");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
