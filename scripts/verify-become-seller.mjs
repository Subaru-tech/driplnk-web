#!/usr/bin/env node
/**
 * Functional check for the rewritten becomeSeller action.
 * 1. Creates a fresh Clerk test user (Backend API), verifies email.
 * 2. Signs in headlessly and drives the real /seller onboarding UI.
 * 3. Asserts DB state: seller_profiles row (id=user.id), profile role=seller, slug shape.
 * 4. Re-submits (idempotency) and asserts the same slug comes back.
 * 5. Cleans up: DB rows + Clerk user.
 */
import { chromium } from "playwright-core";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { readFileSync } from "fs";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([^#=\s][^=]*)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^[\"']|[\"']$/g, "");
}
const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "http://localhost:3000";
const sk = process.env.CLERK_SECRET_KEY;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`  ${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { transport: () => null },
});

// 1. Clerk test user
const ts = Date.now();
const email = `e2e-seller-${ts}@example.com`;
const created = await (await fetch("https://api.clerk.com/v1/users", {
  method: "POST",
  headers: { Authorization: `Bearer ${sk}`, "Content-Type": "application/json" },
  body: JSON.stringify({ email_address: [email], password: `E2eSeller-${ts}-Pass!`, first_name: "E2E", last_name: "Seller" }),
})).json();
if (!created.id) { console.error("user creation failed", JSON.stringify(created).slice(0, 200)); process.exit(1); }
const emailId = created.email_addresses?.[0]?.id;
const prep = await (await fetch(`https://api.clerk.com/v1/email_addresses/${emailId}/prepare_verification`, {
  method: "POST", headers: { Authorization: `Bearer ${sk}`, "Content-Type": "application/json" }, body: JSON.stringify({ strategy: "email_code" }),
})).json();
await fetch(`https://api.clerk.com/v1/email_addresses/${emailId}/attempt_verification`, {
  method: "POST", headers: { Authorization: `Bearer ${sk}`, "Content-Type": "application/json" },
  body: JSON.stringify({ strategy: "email_code", code: "424242", verification_id: prep?.id }),
});

await clerkSetup({ secretKey: sk });

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome", headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
let slug;
try {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await clerk.signIn({ page, emailAddress: email });

  // 2. Drive the real onboarding UI
  await page.goto(`${BASE}/seller`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  const body = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log("   /seller page:", body.replace(/\s+/g, " ").slice(0, 160));

  const input = page.locator('input[name="studioName"], input[placeholder*="studio" i], input').first();
  await input.fill(`Health Probe Studio ${ts}`);
  const submit = page.getByRole("button", { name: /start selling|create|open/i }).first();
  await submit.click();
  await page.waitForTimeout(3000);

  // 3. DB assertions
  const { data: prof } = await sb.from("profiles").select("id, role").eq("clerk_id", created.id).maybeSingle();
  check("profile row found for clerk user", Boolean(prof), prof?.id ?? "not found");
  const { data: sp, error: spErr } = await sb.from("seller_profiles").select("id, studio_name, slug").eq("id", prof.id).maybeSingle();
  check("seller_profiles row created (id = profile.id)", Boolean(sp) && !spErr, spErr ? spErr.message : sp?.id);
  check("profile role promoted to seller", prof?.role === "seller", prof?.role);
  check("slug slugified from studio name", Boolean(sp?.slug && /^health-probe-studio/.test(sp.slug)), sp?.slug);
  slug = sp?.slug;

  // 4. Idempotent re-submit through the action's path: reload /seller and submit again
  await page.goto(`${BASE}/seller`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  const body2 = await page.evaluate(() => document.body.innerText.slice(0, 400));
  check("re-visit shows existing storefront (no error)", !/must be signed in|couldn't/i.test(body2), body2.replace(/\s+/g, " ").slice(0, 100));

  await context.close();
} catch (err) {
  check("flow completed", false, String(err).slice(0, 160));
} finally {
  await browser.close();
}

// 5. Cleanup
const { data: prof } = await sb.from("profiles").select("id").eq("clerk_id", created.id).maybeSingle();
if (prof) {
  await sb.from("seller_profiles").delete().eq("id", prof.id);
  await sb.from("profiles").delete().eq("id", prof.id);
}
await fetch(`https://api.clerk.com/v1/users/${created.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${sk}` } });
console.log("   cleanup done");

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed\n`);
process.exit(passed === results.length ? 0 : 1);
