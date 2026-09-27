#!/usr/bin/env node
/**
 * Generates clean WebP 3D thumbnails for all published marketplace models
 * by loading each model in headless Chrome, capturing the rendered canvas,
 * saving the file to public/thumbnails/<slug>.webp, and updating the database
 * rows (thumbnail_url and preview_image_paths).
 */

import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

for (const line of readFileSync(resolve(__dirname, "../.env.local"), "utf8").split("\n")) {
  const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "https://driplinkk-website.vercel.app";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: () => null } }
);

const { data: models, error } = await supabase
  .from("models")
  .select("id, title, slug, storage_path")
  .eq("status", "published")
  .order("title");

if (error || !models?.length) {
  console.error("Failed to load models:", error?.message || "No models");
  process.exit(1);
}

console.log(`\n📸 Generating thumbnails for ${models.length} models on ${BASE}...\n`);
mkdirSync(resolve(__dirname, "../public/thumbnails"), { recursive: true });

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

const page = await browser.newPage({ viewport: { width: 1000, height: 750 } });

let successCount = 0;
let failCount = 0;

for (let i = 0; i < models.length; i++) {
  const model = models[i];
  const url = `${BASE}/models/${model.id}`;
  const slug = model.slug || model.id;
  const outPath = resolve(__dirname, `../public/thumbnails/${slug}.webp`);
  const publicUrl = `/thumbnails/${slug}.webp`;

  process.stdout.write(`[${i + 1}/${models.length}] ${model.title}... `);

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 35000 });
    await page.waitForSelector("canvas", { timeout: 20000 });
    // Wait for Three.js scene setup and rendering
    await page.waitForTimeout(2500);

    // Strip out non-canvas overlays (toolbars, hint badges, cookie banners)
    await page.evaluate(() => {
      document.querySelectorAll(".absolute, .fixed, [class*='cookie'], [role='region']").forEach((el) => {
        const canvas = document.querySelector("canvas");
        if (canvas && !el.contains(canvas) && !canvas.contains(el)) {
          el.remove();
        }
      });
    });

    const canvas = await page.$("canvas");
    if (!canvas) throw new Error("Canvas element not found");

    const buf = await canvas.screenshot({ type: "webp", quality: 88 });
    writeFileSync(outPath, buf);

    // Update Supabase
    const { error: updateErr } = await supabase
      .from("models")
      .update({
        thumbnail_url: publicUrl,
        preview_image_paths: [publicUrl],
      })
      .eq("id", model.id);

    if (updateErr) {
      console.warn(`(DB update error: ${updateErr.message})`);
    }

    console.log(`✓ (${(buf.length / 1024).toFixed(1)} KB)`);
    successCount++;
  } catch (err) {
    console.log(`✗ ${err.message}`);
    failCount++;
  }
}

await browser.close();

console.log(`\n🎉 Completed: ${successCount} captured, ${failCount} failed.\n`);
