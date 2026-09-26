#!/usr/bin/env node
/**
 * E2E: seller draft upload → interactive 3D preview.
 *
 * 1. Creates a fresh Clerk test user (Backend API) and signs in headlessly
 *    using @clerk/testing's dev-session token.
 * 2. Walks the /dashboard/models/upload wizard with a real STL file.
 * 3. Saves as draft → opens Creator Studio → asserts the dashboard card
 *    preview (same-origin /api/models/[id]/file stream) reaches the WebGL
 *    "ready" state.
 * 4. Verifies an anonymous visitor gets 404 for the draft file.
 * 5. Cleans up: deletes the draft model row + B2 object + Clerk user.
 */

import { chromium } from "playwright-core";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { readFileSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

for (const line of readFileSync(resolve(__dirname, "../.env.local"), "utf8").split("\n")) {
  const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "http://localhost:3000";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// ── 0. Test STL: fresh bytes each run (unique hash → no duplicate rejection) ──
const stlUrl =
  "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/stl/binary/pr2_head_tilt.stl";
const stlRes = await fetch(stlUrl);
if (!stlRes.ok) {
  console.error("Failed to download test STL:", stlRes.status);
  process.exit(1);
}
let stlBytes = Buffer.from(await stlRes.arrayBuffer());
// Corrupt two bytes inside the (unused) header comment — keeps it a valid
// binary STL while making the SHA-256 unique per run.
const stamp = Buffer.from(` e2e-${Date.now()} `, "ascii");
stamp.copy(stlBytes, 10);
const STL_PATH = resolve("/tmp", `e2e-draft-${Date.now()}.stl`);
const fs = await import("fs");
fs.writeFileSync(STL_PATH, stlBytes);

// ── 1. Create the Clerk test user ────────────────────────────────────────────
const sk = process.env.CLERK_SECRET_KEY;
const ts = Date.now();
const email = `e2e-draft-${ts}@example.com`;
const createRes = await fetch("https://api.clerk.com/v1/users", {
  method: "POST",
  headers: { Authorization: `Bearer ${sk}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    email_address: [email],
    password: `E2eDraft-${ts}-Pass!`,
    first_name: "E2E",
    last_name: "DraftPreview",
    unsafe_metadata: { e2e_test: true, ts },
  }),
});
const created = await createRes.json();
if (!created.id) {
  console.error("Clerk user creation failed:", JSON.stringify(created).slice(0, 300));
  process.exit(1);
}
const clerkUserId = created.id;
console.log(`\n🧪 Clerk test user: ${email} (${clerkUserId})\n`);

// Verify the email (required for sign-in tokens). Dev instances accept code 424242.
const emailId = created.email_addresses?.[0]?.id;
if (emailId) {
  const prep = await fetch(`https://api.clerk.com/v1/email_addresses/${emailId}/prepare_verification`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sk}`, "Content-Type": "application/json" },
    body: JSON.stringify({ strategy: "email_code" }),
  });
  const prepJson = await prep.json().catch(() => null);
  // The prepare response IS the verification object: { object: "verification_otp", id: "ver_...", status: "unverified" }
  const verificationId = prepJson?.id ?? null;

  const ver = await fetch(`https://api.clerk.com/v1/email_addresses/${emailId}/attempt_verification`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sk}`, "Content-Type": "application/json" },
    body: JSON.stringify({ strategy: "email_code", code: "424242", verification_id: verificationId }),
  });
  const verJson = await ver.json().catch(() => null);
  const verified = verJson?.verified || verJson?.verification?.status === "verified";
  console.log(`   email verified: ${verified ? "yes" : JSON.stringify(verJson).slice(0, 150)}`);
}

// ── 2. Browser: sign in, walk the wizard, verify preview ─────────────────────
let modelId = null;
let b2Path = null;
const consoleErrors = [];

// Resolves the Frontend API URL from the publishable key and mints a
// dev-instance testing token (bypasses bot protection on FAPI calls).
await clerkSetup({ secretKey: sk });

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

try {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();
  page.on("pageerror", (err) => consoleErrors.push(String(err).slice(0, 200)));

  // clerk.signIn (email overload) requires a prior navigation to a page that
  // loads Clerk; it then mints a ticket via the Backend API and activates the
  // session — no manual sign-in-token fetch needed.
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await clerk.signIn({ page, emailAddress: email });

  // Session is live if the protected studio page doesn't bounce to sign-in.
  await page.goto(`${BASE}/dashboard/models`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const signedIn = !/sign-?in|\/login/.test(page.url());
  if (!signedIn) {
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300));
    check("Ticket sign-in establishes session", false, `still on ${page.url()} — ${bodyText.replace(/\s+/g, " ").slice(0, 150)}`);
  } else {
    check("Ticket sign-in establishes session", true, page.url());
  }

  // Wizard
  await page.goto(`${BASE}/dashboard/models/upload`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);

  // Step 1 — attach the real STL
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(STL_PATH);
  await page.waitForTimeout(1500); // duplicate-hash check + toast
  const continueBtn = page.getByRole("button", { name: /continue to model details/i });
  await continueBtn.click();

  // Step 2 — title/description/category are prefilled; continue
  await page.getByRole("button", { name: /continue to specifications/i }).click();
  await page.waitForTimeout(300);

  // Step 3 — materials prefilled; continue
  await page.getByRole("button", { name: /continue to license & price/i }).click();
  await page.waitForTimeout(300);

  // Step 4 — rights/terms default checked; continue
  await page.getByRole("button", { name: /continue to validation/i }).click();
  await page.waitForTimeout(300);

  // Step 5 — save as draft (uploads bytes to B2 via /api/upload/model first)
  const [uploadResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload/model") && r.request().method() === "POST", { timeout: 60000 }),
    page.getByRole("button", { name: /save draft/i }).click(),
  ]);
  const uploadJson = await uploadResp.json().catch(() => null);
  check(
    "STL uploaded via /api/upload/model",
    uploadResp.ok() && uploadJson?.success && !!uploadJson?.storagePath,
    uploadJson?.storagePath || `HTTP ${uploadResp.status()}`
  );
  b2Path = uploadJson?.storagePath || null;

  // Wait for draft-saved toast → back to studio
  await page.waitForTimeout(2500);

  // ── 3. Dashboard: find the draft card and open its 3D preview ──────────────
  await page.goto(`${BASE}/dashboard/models`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);

  // Grab the draft model id from the page's RSC payload (React Server Component data).
  // Draft rows render an Edit link (upload?id=…), published rows a /models/… link.
  modelId = await page.evaluate(() => {
    const html = document.documentElement.innerHTML;
    const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
    const m = html.match(new RegExp(`models/upload\\?id=${uuid}|models/${uuid}`, "g"));
    if (!m) return null;
    return (m[m.length - 1].match(uuid) || [])[0] || null;
  });
  check("Draft row visible in Creator Studio", Boolean(modelId), modelId || "no model link found");

  if (modelId) {
    // Authorize + resolve the preview through the same-origin proxy
    const previewUrlResp = await page.evaluate(async (id) => {
      const r = await fetch(`/api/models/${id}/preview-url`);
      return { status: r.status, body: await r.json().catch(() => null) };
    }, modelId);
    check(
      "preview-url resolves for owner (draft)",
      previewUrlResp.status === 200 && !!previewUrlResp.body?.url,
      `HTTP ${previewUrlResp.status}`
    );

    // The file stream itself
    const fileResp = await page.evaluate(async (id) => {
      const r = await fetch(`/api/models/${id}/file`);
      return { status: r.status, size: (await r.arrayBuffer()).byteLength, type: r.headers.get("content-type") };
    }, modelId);
    check(
      "file stream returns STL bytes for owner (draft)",
      fileResp.status === 200 && fileResp.size > 1000 && /stl|octet/.test(fileResp.type || ""),
      `${fileResp.status} ${fileResp.type} ${fileResp.size}B`
    );

    // UI-level: open the dashboard card's 3D preview modal and wait for WebGL.
    // The Preview-in-3D button lives on ModelCard, rendered by the overview
    // page's recent-models row (the studio table has no preview button).
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    const eyeButtons = page.locator('button[title="Preview in 3D"]');
    const eyeCount = await eyeButtons.count();
    if (eyeCount > 0) {
      // The newest card may sit outside the horizontal scroll row's viewport;
      // force skips Playwright's actionability checks.
      await eyeButtons.first().click({ force: true, timeout: 15000 });
      try {
        await page.waitForSelector("canvas", { timeout: 60000, state: "attached" });
        const verdictHandle = await page.waitForFunction(
          () => {
            const t = document.body.innerText;
            if (t.includes("Couldn't render this file")) return "error-render";
            if (t.includes("Couldn't fetch")) return "error-fetch";
            if (t.includes("Drag to orbit · Scroll to zoom")) return "ready";
            return null;
          },
          { timeout: 60000 }
        );
        const verdict = await verdictHandle.jsonValue();
        check("Interactive WebGL preview reaches ready state", verdict === "ready", String(verdict));
        if (verdict !== "ready") {
          await page.screenshot({ path: "/tmp/e2e-preview-fail.png" }).catch(() => {});
        }
      } catch (e) {
        check("Interactive WebGL preview reaches ready state", false, String(e).slice(0, 120));
        await page.screenshot({ path: "/tmp/e2e-preview-fail.png" }).catch(() => {});
      }
    } else {
      check("Interactive WebGL preview reaches ready state", false, "no Preview-in-3D button on card");
      await page.screenshot({ path: "/tmp/e2e-preview-fail.png" }).catch(() => {});
    }
  }

  // ── 4. Negative: anonymous visitor cannot fetch the draft file ──────────────
  if (modelId) {
    // Fresh cookie-free context — the signed-in context's cookies would leak
    // into a shared request client.
    const anon = await browser.newContext();
    const anonResp = await anon.request.get(`${BASE}/api/models/${modelId}/file`);
    check("Anonymous blocked from draft file (404)", anonResp.status() === 404, `HTTP ${anonResp.status()}`);
    await anon.close();
  }

  await page.screenshot({ path: "/tmp/e2e-final-state.png" }).catch(() => {});
  await context.close();
} catch (err) {
  check("E2E flow completed without exception", false, String(err).slice(0, 200));
  console.log("Console errors:", consoleErrors.slice(0, 5).join(" | "));
} finally {
  await browser.close();
}

// ── 5. Cleanup: DB row, B2 object, Clerk user ────────────────────────────────
try {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    realtime: { transport: () => null },
  });

  if (modelId) {
    await supabase.from("model_files").delete().eq("model_id", modelId);
    await supabase.from("models").delete().eq("id", modelId);
  }
  if (b2Path) {
    const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({
      endpoint: process.env.B2_S3_ENDPOINT,
      region: process.env.B2_REGION,
      credentials: {
        accessKeyId: process.env.B2_APPLICATION_KEY_ID,
        secretAccessKey: process.env.B2_APPLICATION_KEY,
      },
      forcePathStyle: true,
    });
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.B2_BUCKET_NAME, Key: b2Path }));
  }

  const delRes = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${sk}` },
  });
  const delJson = await delRes.json().catch(() => null);
  check(
    "Cleanup (DB row + B2 object + Clerk user)",
    Boolean(delJson?.deleted),
    delJson?.deleted ? "all removed" : JSON.stringify(delJson).slice(0, 120)
  );
} catch (err) {
  check("Cleanup", false, String(err).slice(0, 150));
}

try { fs.unlinkSync(STL_PATH); } catch {}

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed\n`);
process.exit(passed === results.length ? 0 : 1);
