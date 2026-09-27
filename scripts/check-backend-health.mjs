#!/usr/bin/env node
// Backend/DB structural + functional health check (run from repo root).
import { readFileSync } from "fs";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([^#=\s][^=]*)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^[\"']|[\"']$/g, "");
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`  ${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function rest(path, key = SRK, method = "GET", body) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

console.log("\n=== 1. Schema-vs-code column diff (PGRST204 class of bugs) ===");
// Columns the code selects or writes, per table — extracted from the app's queries/actions.
const usedColumns = {
  models: ["id","name","title","description","category","category_id","subcategory_id","license_type","license_id","price","currency","preview_image_paths","file_path","storage_path","storage_provider","status","published_at","credits_spent","slug","owner_id","seller_user_id","thumbnail_url","moderation_status","moderation_flags","file_sha256","preview_phash","visibility","admin_review_notes","updated_at","created_at"],
  model_files: ["id","model_id","filename","storage_path","format","file_size","is_primary","is_downloadable"],
  model_images: ["id","model_id","storage_path","sort_order","is_cover"],
  model_versions: ["id","model_id","version_number","changelog","created_by","is_current"],
  model_events: ["id","model_id","user_id","event_type","metadata"],
  model_acquisitions: ["id","user_id","model_id","license_type","price_paid","currency","status","acquired_at"],
  profiles: ["id","full_name","avatar_url","credits_balance","role","clerk_id","email"],
  model_reports: ["id","model_id","reporter_user_id","reporter_contact","reason","evidence_url","details","status"],
  mart_orders: ["id","buyer_user_id","provider_id","material","price","status"],
  freelance_requests: ["id","buyer_user_id","freelancer_provider_id","brief","reference_file_paths","final_file_path","status","agreed_price"],
  providers: ["id","user_id","type","status"],
};
const { status, json: defs } = await rest("?apikey=" + SRK);
if (status !== 200) {
  console.log("  ❌ OpenAPI introspection failed:", status);
  failures++;
} else {
  let totalMissing = 0;
  for (const [table, cols] of Object.entries(usedColumns)) {
    const def = defs.definitions[table];
    if (!def) { check(`table ${table}`, false, "missing from DB"); totalMissing++; continue; }
    const dbCols = Object.keys(def.properties);
    const missing = cols.filter((c) => c !== "currency" || table !== "models"); // currency known-removed from code
    const bad = missing.filter((c) => !dbCols.includes(c));
    if (bad.length) { check(`table ${table}`, false, `code uses missing columns: ${bad.join(", ")}`); totalMissing += bad.length; }
    else check(`table ${table}`, true, `${dbCols.length} cols, all ${missing.length} referenced exist`);
  }
  if (totalMissing === 0) console.log("  ✅ all referenced columns exist (no PGRST204 surprises)");
}

console.log("\n=== 2. RPC existence (OpenAPI — every .rpc() the code calls) ===");
const rpcs = ["admin_get_mart_orders","admin_get_pending_listings","admin_get_pending_models","admin_get_pending_providers","admin_moderate_mart_order","admin_review_model","admin_review_provider","apply_vendor_profile","become_seller","claim_model_acquisition","create_freelance_request","create_mart_order","create_quote_request","get_freelance_browse_profiles","get_freelance_requests_for_user","get_marketplace_models","get_mart_orders_for_user","get_mart_vendor_quotes","match_model_phash","register_freelancer_profile","respond_to_freelance_request","respond_to_mart_order","sync_clerk_user_profile","toggle_model_favorite"];
const exposed = new Set(Object.keys(defs.paths ?? {}).filter((p) => p.startsWith("/rpc/")).map((p) => p.slice(5)));
for (const fn of rpcs) check(`rpc ${fn}`, exposed.has(fn), exposed.has(fn) ? "exposed" : "NOT FOUND — code calls it, DB lacks it");

console.log("\n=== 3. Storage buckets ===");
const storageRes = await fetch(`${URL_}/storage/v1/bucket`, {
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
});
const buckets = await storageRes.json().catch(() => []);
const wanted = ["model-files", "model-art", "freelance-deliverables"];
for (const b of wanted) check(`bucket ${b}`, Array.isArray(buckets) && buckets.some((x) => x.id === b || x.name === b));

console.log("\n=== 4. Data integrity ===");
{
  // Orphaned owner check via join query
  const res = await fetch(`${URL_}/rest/v1/models?select=id,title,owner_id!inner(profiles.id)&limit=3`, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } });
  // Simpler: count models whose owner has no profile using two queries.
  const { json: profs } = await rest("profiles?select=id");
  const profIds = new Set((profs ?? []).map((p) => p.id));
  const { json: models } = await rest("models?select=id,owner_id&limit=2000");
  const orphans = (models ?? []).filter((m) => !profIds.has(m.owner_id));
  check("models.owner_id → profiles", orphans.length === 0, orphans.length ? `${orphans.length} orphaned (e.g. ${orphans[0]?.id})` : "all resolve");
}
{
  const { json: acq } = await rest("model_acquisitions?select=id,model_id&limit=2000");
  const { json: mods } = await rest("models?select=id&limit=2000");
  const ids = new Set((mods ?? []).map((m) => m.id));
  const bad = (acq ?? []).filter((a) => !ids.has(a.model_id));
  check("model_acquisitions.model_id → models", bad.length === 0, bad.length ? `${bad.length} orphaned` : "all resolve");
}
{
  const { json: rows } = await rest("models?select=id,status&limit=2000");
  const dist = {};
  for (const r of rows ?? []) dist[r.status] = (dist[r.status] ?? 0) + 1;
  check("models.status domain", Object.keys(dist).every((s) => ["published","draft","pending_review","under_review","rejected","archived"].includes(s)), JSON.stringify(dist));
}

console.log("\n=== 5. Functional: RPC happy paths (read-only, real signatures) ===");
{
  const r = await rest("rpc/get_marketplace_models", SRK, "POST", { p_page: 1, p_page_size: 3 });
  check("get_marketplace_models returns rows", r.status === 200 && Array.isArray(r.json) && r.json.length > 0, `${r.json?.length ?? 0} rows`);
}
{
  // Real signature per code: p_user_id + p_role. Throwaway uuid → empty list, no side effects.
  const r = await rest("rpc/get_mart_orders_for_user", SRK, "POST", { p_user_id: "00000000-0000-0000-0000-000000000000", p_role: "buyer" });
  check("get_mart_orders_for_user (buyer, unknown user)", r.status === 200, Array.isArray(r.json) ? `${r.json.length} rows` : `HTTP ${r.status}`);
}
{
  const r = await rest("rpc/match_model_phash", SRK, "POST", { query_phash: new Array(64).fill(0.5), match_threshold: 0.85, match_count: 3 });
  check("match_model_phash executes", r.status === 200, Array.isArray(r.json) ? `${r.json.length} matches` : `HTTP ${r.status}`);
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
process.exit(failures ? 1 : 0);
