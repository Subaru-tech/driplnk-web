#!/usr/bin/env node
/**
 * Runs the rendering diagnostic + all three E2E suites against one base URL.
 * Stops at the first failing suite (each suite already exits non-zero on
 * failure). Streams each suite's output live.
 *
 *   node scripts/verify-all.mjs                       # dev on :3000
 *   node scripts/verify-all.mjs --base http://localhost:3100
 */

import { spawnSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3000";

const suites = [
  "diagnose-rendering.mjs",
  "verify-become-seller.mjs",
  "verify-seller-draft-preview.mjs",
  "verify-model-previews.mjs",
];

console.log(`\n▶ verify:all → ${BASE}`);

for (const suite of suites) {
  console.log(`\n━━━ ${suite} ━━━`);
  const { status } = spawnSync(process.execPath, [resolve(__dirname, suite), "--base", BASE], {
    stdio: "inherit",
  });
  if (status !== 0) {
    console.error(`\n❌ ${suite} failed — stopping (remaining suites skipped).`);
    process.exit(status ?? 1);
  }
}

console.log(`\n✅ all ${suites.length} suites passed against ${BASE}`);
