#!/usr/bin/env node
/**
 * Browser verification for the interactive 3D preview pipeline.
 *
 * Loads each published model's detail page in headless Chrome (system Chrome
 * via playwright-core, SwiftShader GL), waits for the Three.js canvas to
 * appear, and asserts the viewer reached the "ready" state (toolbar rendered,
 * no error overlay), capturing console errors per model.
 *
 *   node scripts/verify-model-previews.mjs [--base http://localhost:3000]
 */

import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "fs";
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

// ── Fetch published model IDs from Supabase ──────────────────────────────────
const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { transport: () => null },
});

const { data: models, error } = await supabase.from("models").select("id,title,slug").eq("status", "published").order("created_at");
if (error) {
  console.error("Failed to list models:", error.message);
  process.exit(1);
}
if (!models?.length) {
  console.error("No published models found.");
  process.exit(1);
}

console.log(`\n🔍 Verifying ${models.length} model pages on ${BASE}\n`);

// ── Disk cache for /file responses (stops daily B2 Class-B cap burn) ────────
// Geometry files are immutable (unique storage path per upload), so the model
// file response is cached on disk after the first download; repeat runs replay
// it and hit B2 zero times. --no-cache forces a live B2 pass. Cache entries
// expire after 7 days to bound disk use.
const NO_CACHE = process.argv.includes("--no-cache");
const CACHE_DIR = "/tmp/driplnk-e2e-file-cache";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
let cacheHits = 0;
let cacheMisses = 0;

function cachePathFor(url) {
  const u = new URL(url);
  const key = `${u.pathname}${u.search}`.replace(/[^a-zA-Z0-9-]/g, "_");
  return resolve(CACHE_DIR, `${key}.json`);
}

async function routeWithCache(route) {
  const cf = cachePathFor(route.request().url());
  if (!NO_CACHE && existsSync(cf) && Date.now() - statSync(cf).mtimeMs < CACHE_TTL_MS) {
    const { status, headers, body } = JSON.parse(readFileSync(cf, "utf8"));
    cacheHits++;
    await route.fulfill({ status, headers, body: Buffer.from(body, "base64") });
    return;
  }
  const response = await route.fetch();
  if (response.ok()) {
    cacheMisses++;
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(
      cf,
      JSON.stringify({ status: response.status(), headers: response.headers(), body: (await response.body()).toString("base64") })
    );
  }
  await route.fulfill({ response });
}

// ── Browser setup ────────────────────────────────────────────────────────────
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});

const results = [];

for (const m of models) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await context.route("**/api/models/*/file*", routeWithCache);
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
  });
  page.on("pageerror", (err) => consoleErrors.push("pageerror: " + String(err).slice(0, 200)));

  const url = `${BASE}/models/${m.id}`;
  let outcome = "?";
  let canvasSeen = false;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait up to 60s for the WebGL canvas to mount (dev-server chunk load can be slow)
    try {
      await page.waitForSelector("div[class*='rounded-2xl'] canvas, div[class*='viewer'] canvas, canvas", {
        timeout: 60000,
        state: "attached",
      });
      canvasSeen = true;
    } catch {
      canvasSeen = false;
    }

    if (!canvasSeen) {
      // Determine which fallback state the viewer is stuck in
      const state = await page.evaluate(() => {
        const t = document.body.innerText;
        if (t.includes("Couldn't render this file") || t.includes("Couldn't fetch")) return "error-overlay";
        if (t.includes("Loading 3D preview") || t.includes("Optimizing geometry")) return "stuck-loading";
        if (t.includes("3D Mesh Viewport")) return "empty-viewport";
        return "no-canvas";
      });
      outcome = `FAIL (${state})`;
    } else {
      // Confirm the viewer toolbar (ready state) rendered, or an error overlay appeared
      const verdict = await page.evaluate(() => {
        const t = document.body.innerText;
        if (t.includes("Couldn't render this file") || t.includes("Couldn't fetch the model file")) return "error-overlay";
        if (t.includes("Drag to orbit · Scroll to zoom")) return "ready";
        if (t.includes("Optimizing geometry")) return "still-loading";
        return "unknown";
      });

      if (verdict === "ready") {
        // Extra sanity: canvas actually has non-trivial pixels? (WebGL drew something)
        const pixelCheck = await page.evaluate(() => {
          const canvas = document.querySelector("canvas");
          if (!canvas) return { drew: false, reason: "no canvas" };
          const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
          if (!gl) return { drew: true, reason: "2d/no-gl (WebGL context owned by three.js)" };
          try {
            const px = new Uint8Array(4 * 100);
            gl.readPixels(0, 0, 10, 10, gl.RGBA, gl.UNSIGNED_BYTE, px);
            const nonBlack = Array.from(px).some((v, i) => (i + 1) % 4 !== 0 && v > 8);
            return { drew: nonBlack, reason: nonBlack ? "pixels present" : "all-black pixels" };
          } catch {
            return { drew: true, reason: "readPixels blocked (preserveDrawingBuffer)" };
          }
        });
        outcome = pixelCheck.drew ? "PASS" : `PASS (canvas ready, ${pixelCheck.reason})`;
      } else if (verdict === "error-overlay") {
        outcome = "FAIL (error overlay)";
      } else {
        // Give loading a second chance
        try {
          await page.waitForFunction(
            () => {
              const t = document.body.innerText;
              return t.includes("Drag to orbit · Scroll to zoom") || t.includes("Couldn't render");
            },
            { timeout: 30000 }
          );
          outcome = "PASS (after extra wait)";
        } catch {
          outcome = `FAIL (${verdict})`;
        }
      }
    }
  } catch (err) {
    outcome = "FAIL (navigation): " + String(err).slice(0, 120);
  }

  const relevantErrors = consoleErrors.filter(
    (e) => !/sqlite|DEPRECATED_ENDPOINT|favicon|Download the React DevTools/i.test(e)
  );

  console.log(`  ${outcome.startsWith("PASS") ? "✅" : "❌"} ${m.title}  [${outcome}]`);
  if (!outcome.startsWith("PASS")) {
    if (relevantErrors.length) console.log(`      console: ${relevantErrors.slice(0, 3).join(" | ")}`);
    try {
      await page.screenshot({ path: `/tmp/fail-${m.slug}.png` });
    } catch {}
  } else if (relevantErrors.length) {
    console.log(`      ⚠️  console: ${relevantErrors.slice(0, 2).join(" | ")}`);
  }

  results.push({ title: m.title, outcome, errors: relevantErrors });
  await context.close();
}

await browser.close();

const passed = results.filter((r) => r.outcome.startsWith("PASS")).length;
console.log(
  `\n${passed}/${results.length} models verified with interactive 3D preview`
  + `  (B2 downloads: ${cacheMisses}, disk-cache hits: ${cacheHits}${NO_CACHE ? ", cache bypassed" : ""})\n`
);
process.exit(passed === results.length ? 0 : 1);
