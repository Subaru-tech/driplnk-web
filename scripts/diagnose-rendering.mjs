#!/usr/bin/env node
// Rendering diagnostic: loads key pages headlessly, captures console errors,
// hydration warnings, failed requests, and screenshots.
import { chromium } from "playwright-core";

const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "http://localhost:3000";
const pages = ["/", "/models", "/login", "/freelance/apply", "/mart"];

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

for (const path of pages) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  let prefetchAborts = 0;
  const errors = [];
  const failed = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(`[${m.type()}] ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => errors.push(`[pageerror] ${String(e).slice(0, 300)}`));
  page.on("requestfailed", (r) => {
    // Aborted Link prefetches (?_rsc=) are normal in prod builds — classify
    // separately so they don't masquerade as real failures.
    if (r.failure()?.errorText === "net::ERR_ABORTED" && r.url().includes("_rsc=")) {
      prefetchAborts++;
      return;
    }
    failed.push(`${r.url().slice(0, 120)} → ${r.failure()?.errorText}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`${r.url().slice(0, 120)} → HTTP ${r.status()}`);
  });

  try {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2500);

    // Is CSS actually applied? Check a known utility class resolves to real styles.
    const cssProbe = await page.evaluate(() => {
      const el = document.querySelector("body");
      const cs = getComputedStyle(el);
      const bg = cs.backgroundColor;
      const color = cs.color;
      const font = cs.fontFamily;
      const stylesheetCount = document.styleSheets.length;
      return { bg, color, font: font.slice(0, 60), stylesheetCount };
    });

    // Hydration mismatch signature in DOM
    const html = await page.content();
    const hydrationNote = html.includes("hydration") || errors.some((e) => /hydrat/i.test(e));

    console.log(`\n=== ${path} ===`);
    console.log(`  stylesheets: ${cssProbe.stylesheetCount} | body bg: ${cssProbe.bg} | color: ${cssProbe.color} | font: ${cssProbe.font}`);
    if (hydrationNote) console.log("  ⚠️ hydration-related console output");
    if (errors.length) console.log(`  console (${errors.length}):\n    ${errors.slice(0, 8).join("\n    ")}`);
    else console.log("  console: clean");
    if (failed.length) console.log(`  failed requests (${failed.length}):\n    ${[...new Set(failed)].slice(0, 8).join("\n    ")}`);
    if (prefetchAborts) console.log(`  (info: ${prefetchAborts} aborted Link prefetches — normal in prod)`);
    const safe = path.replace(/\//g, "_") || "home";
    await page.screenshot({ path: `/tmp/render-${safe}.png`, fullPage: false });
    console.log(`  screenshot: /tmp/render-${safe}.png`);
  } catch (e) {
    console.log(`\n=== ${path} === FAILED: ${String(e).slice(0, 200)}`);
  }
  await ctx.close();
}
await browser.close();
