import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envFile = fs.readFileSync(".env.local", "utf8");
function getEnv(key) {
  const m = envFile.match(new RegExp(`${key}=([^\\r\\n]+)`));
  return m ? m[1].trim() : null;
}

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const CLERK_SECRET_KEY = getEnv("CLERK_SECRET_KEY");

if (!SUPABASE_URL || !SUPABASE_KEY || !CLERK_SECRET_KEY) {
  console.error("Missing required env vars:", {
    hasUrl: Boolean(SUPABASE_URL),
    hasKey: Boolean(SUPABASE_KEY),
    hasClerk: Boolean(CLERK_SECRET_KEY)
  });
  process.exit(1);
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const ARTIFACTS_DIR = "/home/sasa/.gemini/antigravity-ide/brain/c4394864-cb63-4628-ad09-f780aa2d93ee";
const SAMPLE_STL_PATH = `${ARTIFACTS_DIR}/scratch/ref1_cube_20mm.stl`;

// Users
const VENDOR_A_USER_ID = "e5f62dd4-82b9-40ab-8d36-6317c03d4304"; // Atharva Ramani (Apex)
const VENDOR_A_CLERK_ID = "user_3IukzMSUdudpAc7brsSg4aJrcyd";
const VENDOR_A_PROVIDER_ID = "27d2ae80-2683-4655-a15d-2272900a9616";

const BUYER_USER_ID = "24970a5c-1b32-4735-ab78-919497b61e35"; // Subaru 02
const BUYER_CLERK_ID = "user_3Iwb0Qt5F0ZwIX15zCjldX7BcyZ";

const VENDOR_B_USER_ID = "3345ed81-f953-4bff-b1f5-f32aca16fbff"; // Aman Gupta (Zenith)
const VENDOR_B_PROVIDER_ID = "ccaa0a34-e0cf-4635-8746-4e2d7fdf549e";

function createWs(url) {
  const ws = new WebSocket(url);
  let id = 1;
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const curId = id++;
      const handler = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.id === curId) {
          ws.removeEventListener("message", handler);
          if (data.error) reject(new Error(JSON.stringify(data.error)));
          else resolve(data.result);
        }
      };
      ws.addEventListener("message", handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });

  const evalVal = async (expr) => {
    const res = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
    return res.result?.value;
  };

  return { ws, send, evalVal };
}

async function saveScreenshot(send, filename) {
  const snap = await send("Page.captureScreenshot", { format: "png" });
  const filepath = `${ARTIFACTS_DIR}/${filename}`;
  fs.writeFileSync(filepath, Buffer.from(snap.data, "base64"));
  console.log(`[Screenshot] Saved -> ${filename}`);
}

async function main() {
  console.log("==========================================================");
  console.log("=== STARTING FULL TWO-IDENTITY MART LIFECYCLE AUDIT ===");
  console.log("==========================================================");
  console.log("Vendor A (Apex Hub):", VENDOR_A_USER_ID, VENDOR_A_CLERK_ID);
  console.log("Buyer (Subaru 02):   ", BUYER_USER_ID, BUYER_CLERK_ID);
  console.log("Vendor B (Zenith Hub):", VENDOR_B_USER_ID, VENDOR_B_PROVIDER_ID);

  // 1. Connect to Browser target
  const verRes = await fetch("http://localhost:9222/json/version");
  const ver = await verRes.json();
  const browserWs = createWs(ver.webSocketDebuggerUrl);
  await new Promise((r) => browserWs.ws.addEventListener("open", r));

  // 2. Setup Vendor A Session in main tab
  const tabsRes = await fetch("http://localhost:9222/json/list");
  const tabs = await tabsRes.json();
  const mainTab = tabs.find((t) => t.id === "3249ED4512B22991F8DFD393AA7DE7E5") || tabs.find((t) => t.type === "page" && t.url.includes("localhost:3000"));
  console.log("Connecting to Vendor tab:", mainTab.id, mainTab.url);
  const vendorClient = createWs(mainTab.webSocketDebuggerUrl);
  await new Promise((r) => vendorClient.ws.addEventListener("open", r));

  // Check Vendor A identity
  const vUser = await vendorClient.evalVal(
    "({ id: window.Clerk?.user?.id, email: window.Clerk?.user?.primaryEmailAddress?.emailAddress })"
  );
  console.log("\n[Auth] Vendor A tab identity:", vUser);
  if (vUser?.id !== VENDOR_A_CLERK_ID) {
    throw new Error(`Vendor A is not logged in as ${VENDOR_A_CLERK_ID}, got: ${JSON.stringify(vUser)}`);
  }

  // 3. Setup Buyer Session in isolated browser context
  console.log("\n[Auth] Initializing isolated Incognito browser context for Buyer...");
  const ctx = await browserWs.send("Target.createBrowserContext");

  // Get sign-in token for Buyer
  const tokenRes = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ user_id: BUYER_CLERK_ID })
  });
  const tokenData = await tokenRes.json();
  const buyerTicketUrl = `${tokenData.url}&redirect_url=${encodeURIComponent("http://localhost:3000/mart")}`;

  const buyerTarget = await browserWs.send("Target.createTarget", {
    url: buyerTicketUrl,
    browserContextId: ctx.browserContextId
  });

  const buyerClient = createWs(`ws://localhost:9222/devtools/page/${buyerTarget.targetId}`);
  await new Promise((r) => buyerClient.ws.addEventListener("open", r));

  console.log("Waiting for Buyer ticket sign-in and redirect...");
  let bUser = null;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    bUser = await buyerClient.evalVal(
      "({ loaded: window.Clerk?.loaded, id: window.Clerk?.user?.id, email: window.Clerk?.user?.primaryEmailAddress?.emailAddress, url: window.location.href })"
    );
    if (bUser?.id) {
      console.log(`Buyer authenticated at poll ${i}:`, bUser);
      break;
    }
  }

  console.log("[Auth] Buyer tab identity:", bUser);
  if (bUser?.id !== BUYER_CLERK_ID) {
    throw new Error(`Buyer failed to authenticate as ${BUYER_CLERK_ID}, got: ${JSON.stringify(bUser)}`);
  }

  // 4. Buyer uploads STL file on /mart and places order with Apex
  console.log("\n[Step 1] Buyer uploads STL on /mart...");
  await buyerClient.send("DOM.enable");
  const doc = await buyerClient.send("DOM.getDocument");
  const fileInput = await buyerClient.send("DOM.querySelector", {
    nodeId: doc.root.nodeId,
    selector: 'input[type="file"]'
  });

  if (!fileInput?.nodeId) {
    throw new Error("File input not found on /mart");
  }

  await buyerClient.send("DOM.setFileInputFiles", {
    nodeId: fileInput.nodeId,
    files: [SAMPLE_STL_PATH]
  });

  console.log("File selected. Waiting for geometric volume calculation & quote generation...");
  let quotesLoaded = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 800));
    const checkQuotes = await buyerClient.evalVal(`(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const orderBtns = btns.filter(b => b.innerText.includes("Order"));
      const bodyText = document.body.innerText;
      return {
        orderBtnsCount: orderBtns.length,
        hasApex: bodyText.includes("Apex Print Systems"),
        hasZenith: bodyText.includes("Zenith Prototyping Hub")
      };
    })()`);
    if (checkQuotes?.orderBtnsCount > 0 && checkQuotes?.hasApex) {
      console.log(`Quotes resolved at poll ${i}:`, checkQuotes);
      quotesLoaded = true;
      break;
    }
  }

  if (!quotesLoaded) {
    throw new Error("Quotes failed to render after upload");
  }

  console.log("Clicking 'Order' button for Apex Print Systems...");
  const orderClick = await buyerClient.evalVal(`(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const apexBtn = btns.find(b => {
      const card = b.closest("div.border");
      return card && card.innerText.includes("Apex Print Systems") && b.innerText.includes("Order");
    });
    if (!apexBtn) return { error: "Apex order button not found" };
    apexBtn.click();
    return { clicked: true, text: apexBtn.innerText };
  })()`);
  console.log("Order click result:", orderClick);

  // Wait for redirect to /dashboard/mart-orders
  console.log("Waiting for order creation & redirect to /dashboard/mart-orders...");
  let redirected = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 800));
    const pageState = await buyerClient.evalVal(`(() => {
      const errEl = document.querySelector(".border-rose-500\\\\/30") || document.querySelector('[role="alert"]');
      return {
        path: window.location.pathname,
        errText: errEl ? errEl.innerText : null
      };
    })()`);
    if (pageState?.errText) {
      console.log("UI error text displayed:", pageState.errText);
    }
    if (pageState?.path?.includes("/dashboard/mart-orders")) {
      redirected = true;
      break;
    }
  }

  if (!redirected) {
    await saveScreenshot(buyerClient.send, "lifecycle_error_state_buyer.png");
    throw new Error("Did not redirect to /dashboard/mart-orders after placing order");
  }
  await new Promise((r) => setTimeout(r, 1500));
  await saveScreenshot(buyerClient.send, "lifecycle_1_order_placed_buyer.png");

  // 5. Direct Supabase Query Verification: Transition 1 (Placed)
  console.log("\n[SQL Verification 1] Checking mart_orders row for placed order...");
  const { data: buyerOrdersPlaced, error: oErr } = await adminSupabase.rpc("get_mart_orders_for_user", {
    p_user_id: BUYER_USER_ID,
    p_role: "buyer"
  });

  if (oErr || !buyerOrdersPlaced || buyerOrdersPlaced.length === 0) {
    throw new Error(`Failed to find placed order in DB: ${oErr?.message}`);
  }

  const order = buyerOrdersPlaced[0];
  const orderId = order.id;
  console.log("Verified Placed Order in DB:", {
    id: order.id,
    buyer_user_id: order.buyer_user_id,
    provider_id: order.provider_id,
    price: order.price,
    status: order.status
  });

  if (order.status !== "placed") throw new Error(`Expected status 'placed', got '${order.status}'`);
  if (order.provider_id !== VENDOR_A_PROVIDER_ID) throw new Error("Order not assigned to Vendor A");

  // Verify email is HIDDEN to buyer while status is 'placed'
  console.log("Buyer view at 'placed' status (counterparty contact check):", {
    counterparty_name: order.counterparty_name,
    counterparty_email: order.counterparty_email
  });
  if (order.counterparty_email !== null) {
    throw new Error("SECURITY FAILURE: Counterparty email leaked before acceptance!");
  }

  // 6. Unauthorized Mutation Rejection Test 1: Buyer attempts vendor action ('accept')
  console.log("\n[Security Test 1] Buyer attempts to accept order (unauthorized mutation)...");
  const { error: buyerAcceptErr } = await adminSupabase.rpc("respond_to_mart_order", {
    p_user_id: BUYER_USER_ID,
    p_order_id: orderId,
    p_action: "accept"
  });
  console.log("Result of buyer accept mutation:", buyerAcceptErr?.message);
  if (!buyerAcceptErr || !buyerAcceptErr.message.includes("Only the vendor can accept an order")) {
    throw new Error("SECURITY FAILURE: Server failed to reject buyer accept attempt!");
  }
  console.log("✓ Server correctly rejected buyer's unauthorized mutation!");

  // 7. Unauthorized Mutation Rejection Test 2: Vendor B attempts to touch Vendor A's order
  console.log("\n[Security Test 2] Vendor B (Zenith) attempts to accept Vendor A's order...");
  const { error: vendorBAcceptErr } = await adminSupabase.rpc("respond_to_mart_order", {
    p_user_id: VENDOR_B_USER_ID,
    p_order_id: orderId,
    p_action: "accept"
  });
  console.log("Result of Vendor B accept mutation:", vendorBAcceptErr?.message);
  if (!vendorBAcceptErr || !vendorBAcceptErr.message.includes("Unauthorized: You are not a party to this order")) {
    throw new Error("SECURITY FAILURE: Server failed to reject Vendor B's attempt to touch Vendor A's order!");
  }
  console.log("✓ Server correctly rejected foreign vendor's unauthorized mutation!");

  // Confirm status is STILL placed
  const { data: statusCheck1 } = await adminSupabase.rpc("admin_get_mart_order", { p_order_id: orderId });
  if (statusCheck1.status !== "placed") throw new Error("Status was unexpectedly altered!");

  // 8. Vendor A accepts order through real UI on /dashboard/vendor
  console.log("\n[Step 2] Vendor A navigates to /dashboard/vendor and accepts order in UI...");
  await vendorClient.send("Page.navigate", { url: "http://localhost:3000/dashboard/vendor" });
  await new Promise((r) => setTimeout(r, 2500));

  const clickAccept = await vendorClient.evalVal(`(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const acceptBtn = btns.find(b => b.innerText.includes("Accept Order"));
    if (!acceptBtn) return { error: "Accept Order button not found" };
    acceptBtn.click();
    return { clicked: true };
  })()`);
  console.log("Vendor A click Accept:", clickAccept);

  // Poll for button transition to Start Printing
  let acceptedInUI = false;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const hasPrintBtn = await vendorClient.evalVal("document.body.innerText.includes('Start Printing')");
    if (hasPrintBtn) {
      acceptedInUI = true;
      break;
    }
  }
  if (!acceptedInUI) throw new Error("Vendor UI did not update to 'Start Printing'");
  await saveScreenshot(vendorClient.send, "lifecycle_2_vendor_accepted_order.png");

  // 9. SQL Verification 2: Accepted & Email Revealed to Buyer
  console.log("\n[SQL Verification 2] Checking status === 'accepted' in DB...");
  const { data: dbAccepted } = await adminSupabase.rpc("admin_get_mart_order", { p_order_id: orderId });
  console.log("DB status after accept:", dbAccepted);
  if (dbAccepted.status !== "accepted") throw new Error("Order status was not updated to 'accepted'");

  const { data: buyerQueryAccepted } = await adminSupabase.rpc("get_mart_orders_for_user", {
    p_user_id: BUYER_USER_ID,
    p_role: "buyer"
  });
  const myAcceptedOrder = buyerQueryAccepted.find((o) => o.id === orderId);
  console.log("Buyer view at 'accepted' status (counterparty contact check):", {
    counterparty_name: myAcceptedOrder?.counterparty_name,
    counterparty_email: myAcceptedOrder?.counterparty_email,
    counterparty_location: myAcceptedOrder?.counterparty_location
  });
  if (!myAcceptedOrder?.counterparty_email) {
    throw new Error("FAILURE: Vendor email should now be revealed to buyer!");
  }
  console.log("✓ Vendor email correctly revealed to buyer upon acceptance!");

  // Navigate Buyer to /dashboard/mart-orders/[id] and capture screenshot showing revealed email
  console.log("Buyer navigates to order details page to verify revealed email in UI...");
  await buyerClient.send("Page.navigate", { url: `http://localhost:3000/dashboard/mart-orders/${orderId}` });
  await new Promise((r) => setTimeout(r, 2500));
  await saveScreenshot(buyerClient.send, "lifecycle_3_buyer_sees_vendor_email.png");

  // 10. Vendor A starts printing in UI
  console.log("\n[Step 3] Vendor A starts printing in UI...");
  const clickPrint = await vendorClient.evalVal(`(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const printBtn = btns.find(b => b.innerText.includes("Start Printing"));
    if (!printBtn) return { error: "Start Printing button not found" };
    printBtn.click();
    return { clicked: true };
  })()`);
  console.log("Vendor A click Print:", clickPrint);

  // Poll for button transition to Mark Shipped
  let printingInUI = false;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const hasShipBtn = await vendorClient.evalVal("document.body.innerText.includes('Mark Shipped')");
    if (hasShipBtn) {
      printingInUI = true;
      break;
    }
  }
  if (!printingInUI) throw new Error("Vendor UI did not update to 'Mark Shipped'");
  await saveScreenshot(vendorClient.send, "lifecycle_4_vendor_printing.png");

  // SQL Verification 3: Printing
  const { data: dbPrinting } = await adminSupabase.rpc("admin_get_mart_order", { p_order_id: orderId });
  console.log("[SQL Verification 3] DB status after print:", dbPrinting);
  if (dbPrinting.status !== "printing") throw new Error("DB status is not 'printing'");

  // 11. Vendor A marks shipped in UI
  console.log("\n[Step 4] Vendor A marks shipped in UI...");
  const clickShip = await vendorClient.evalVal(`(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const shipBtn = btns.find(b => b.innerText.includes("Mark Shipped"));
    if (!shipBtn) return { error: "Mark Shipped button not found" };
    shipBtn.click();
    return { clicked: true };
  })()`);
  console.log("Vendor A click Ship:", clickShip);

  // Poll for button transition to Mark Delivered
  let shippedInUI = false;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const hasDeliverBtn = await vendorClient.evalVal("document.body.innerText.includes('Mark Delivered')");
    if (hasDeliverBtn) {
      shippedInUI = true;
      break;
    }
  }
  if (!shippedInUI) throw new Error("Vendor UI did not update to 'Mark Delivered'");
  await saveScreenshot(vendorClient.send, "lifecycle_5_vendor_shipped.png");

  // SQL Verification 4: Shipped
  const { data: dbShipped } = await adminSupabase.rpc("admin_get_mart_order", { p_order_id: orderId });
  console.log("[SQL Verification 4] DB status after ship:", dbShipped);
  if (dbShipped.status !== "shipped") throw new Error("DB status is not 'shipped'");

  // 12. Vendor A marks delivered in UI
  console.log("\n[Step 5] Vendor A marks delivered in UI...");
  const clickDeliver = await vendorClient.evalVal(`(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const deliverBtn = btns.find(b => b.innerText.includes("Mark Delivered"));
    if (!deliverBtn) return { error: "Mark Delivered button not found" };
    deliverBtn.click();
    return { clicked: true };
  })()`);
  console.log("Vendor A click Deliver:", clickDeliver);

  // Poll for vendor status text 'Delivered (Awaiting Buyer)'
  let deliveredInUI = false;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const hasDeliveredText = await vendorClient.evalVal("document.body.innerText.includes('Delivered (Awaiting Buyer)')");
    if (hasDeliveredText) {
      deliveredInUI = true;
      break;
    }
  }
  if (!deliveredInUI) throw new Error("Vendor UI did not update to 'Delivered (Awaiting Buyer)'");
  await saveScreenshot(vendorClient.send, "lifecycle_6_vendor_delivered.png");

  // SQL Verification 5: Delivered
  const { data: dbDelivered } = await adminSupabase.rpc("admin_get_mart_order", { p_order_id: orderId });
  console.log("[SQL Verification 5] DB status after deliver:", dbDelivered);
  if (dbDelivered.status !== "delivered") throw new Error("DB status is not 'delivered'");

  // 13. Security Test 3: Vendor attempts buyer completion
  console.log("\n[Security Test 3] Vendor attempts to mark order completed (buyer-only mutation)...");
  const { error: vendorCompleteErr } = await adminSupabase.rpc("respond_to_mart_order", {
    p_user_id: VENDOR_A_USER_ID,
    p_order_id: orderId,
    p_action: "complete"
  });
  console.log("Result of vendor complete mutation:", vendorCompleteErr?.message);
  if (!vendorCompleteErr || !vendorCompleteErr.message.includes("Only the buyer can mark an order completed")) {
    throw new Error("SECURITY FAILURE: Server failed to reject vendor complete attempt!");
  }
  console.log("✓ Server correctly rejected vendor's unauthorized completion attempt!");

  // 14. Buyer marks completed in real UI
  console.log("\n[Step 6] Buyer reloads order page and clicks 'Mark Completed' in UI...");
  await buyerClient.send("Page.reload");
  await new Promise((r) => setTimeout(r, 2500));

  const clickComplete = await buyerClient.evalVal(`(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const completeBtn = btns.find(b => b.innerText.includes("Mark Completed"));
    if (!completeBtn) return { error: "Mark Completed button not found" };
    completeBtn.click();
    return { clicked: true };
  })()`);
  console.log("Buyer click Complete:", clickComplete);

  // Poll for completion (spinner gone and Order Completed badge present)
  let completedInUI = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 800));
    const isCompleted = await buyerClient.evalVal(`(() => {
      const hasBadge = Array.from(document.querySelectorAll("span")).some(s => s.innerText.includes("Order Completed"));
      const isSpinning = Boolean(document.querySelector(".animate-spin"));
      return hasBadge && !isSpinning;
    })()`);
    if (isCompleted) {
      completedInUI = true;
      break;
    }
  }
  if (!completedInUI) throw new Error("Buyer UI did not update to 'Order Completed'");
  await saveScreenshot(buyerClient.send, "lifecycle_7_order_completed_buyer.png");

  // 15. Final SQL Verification 6: Completed
  console.log("\n[SQL Verification 6] Checking status === 'completed' in DB...");
  let dbCompleted = null;
  for (let i = 0; i < 10; i++) {
    const { data } = await adminSupabase.rpc("admin_get_mart_order", { p_order_id: orderId });
    if (data?.status === "completed") {
      dbCompleted = data;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log("DB status after completion:", dbCompleted);
  if (dbCompleted?.status !== "completed") throw new Error("DB status is not 'completed'");

  // Clean up Buyer context
  await browserWs.send("Target.closeTarget", { targetId: buyerTarget.targetId });
  await browserWs.send("Target.disposeBrowserContext", { browserContextId: ctx.browserContextId });
  browserWs.ws.close();
  vendorClient.ws.close();

  console.log("\n==========================================================");
  console.log("=== ALL TWO-IDENTITY LIFECYCLE STEPS & SECURITY TESTS ===");
  console.log("=== SUCCESSFULLY PASSED AND INDEPENDENTLY CONFIRMED!  ===");
  console.log("==========================================================");
}

main().catch((err) => {
  console.error("LIFECYCLE TEST FAILED:", err);
  process.exit(1);
});
