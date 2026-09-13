/**
 * RLS regression probes — the exploit proofs from the 2026-09-13 security audit,
 * kept as executable tests so a future migration can't silently re-open them.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... REF=<project-ref> node supabase/tests/rls_regression.mjs
 *
 * Requires: SUPABASE_ACCESS_TOKEN (Management API — runs SQL as postgres),
 *           REF (project ref).
 * Optional: TEST_USER_ID / VICTIM_MODEL_ID override the fixture rows; by
 *           default the script discovers a non-admin user and a paid
 *           published model on its own.
 *
 * Every probe runs inside BEGIN...ROLLBACK so nothing persists, and every
 * session is SET ROLE authenticated/anon with synthetic JWT claims — exactly
 * what an attacker's Supabase session looks like to Postgres.
 */

const REF = process.env.REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!REF || !TOKEN) {
  console.error("Usage: SUPABASE_ACCESS_TOKEN=sbp_... REF=<ref> node supabase/tests/rls_regression.mjs");
  process.exit(2);
}

const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function sql(query) {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await res.json();
  if (!res.ok || (body && body.message && body.message.startsWith("Failed to run"))) {
    const err = new Error(body.message || `HTTP ${res.status}`);
    err.isSqlError = true;
    err.body = body;
    throw err;
  }
  return body;
}

let passed = 0;
let failed = 0;

/**
 * A probe asserts that a client-session statement either SUCCEEDS or fails
 * with an RLS/permission error. `expect: "error"` is the security posture —
 * the statement is an exploit, and it must be rejected.
 */
async function probe(name, { role, claims, statements, expect }) {
  try {
    const wrapped = `begin; set local role ${role}; set local request.jwt.claims = '${claims}'; ${statements} rollback;`;
    await sql(wrapped);
    if (expect === "error") {
      failed++;
      console.log(`FAIL  ${name} — statement SUCCEEDED but must be rejected`);
    } else {
      passed++;
      console.log(`ok    ${name}`);
    }
  } catch (err) {
    if (expect === "error" && err.isSqlError) {
      passed++;
      console.log(`ok    ${name} (rejected: ${String(err.message).slice(0, 80)})`);
    } else {
      failed++;
      console.log(`FAIL  ${name} — ${String(err.message).slice(0, 140)}`);
    }
  }
}

async function main() {
  // ---- Fixtures -----------------------------------------------------------
  const [userRow] = await sql(
    "select id from public.profiles where role <> 'admin' order by created_at limit 1"
  );
  if (!userRow) throw new Error("No non-admin profile found to use as test subject");
  const USER = userRow.id;

  const [modelRow] = await sql(
    "select id from public.models where status='published' and price > 0 order by created_at desc limit 1"
  );
  const VICTIM_MODEL = modelRow?.id;

  const [vendorRow] = await sql(
    "select p.id, p.user_id from public.providers p join public.vendor_profiles vp on vp.provider_id=p.id where p.type='vendor' and p.status='approved' limit 1"
  );

  const claims = JSON.stringify({ sub: USER, role: "authenticated" });
  const anonClaims = "{}";

  console.log(`Probing as user ${USER}\n`);

  // ---- CRITICAL 1: vendor self-approval -----------------------------------
  await probe("C1: user cannot self-insert an APPROVED provider row", {
    role: "authenticated",
    claims,
    statements: `insert into public.providers (user_id, type, status) values ('${USER}','vendor','approved');`,
    expect: "error",
  });

  await probe("C1b: user cannot update own provider row to approved", {
    role: "authenticated",
    claims,
    statements: `
      insert into public.providers (user_id, type, status) values ('${USER}','vendor','pending');
      update public.providers set status='approved' where user_id='${USER}';
    `,
    expect: "error",
  });

  await probe("C1c: legitimate pending application still allowed", {
    role: "authenticated",
    claims,
    statements: `insert into public.providers (user_id, type, status) values ('${USER}','vendor','pending');`,
    expect: "success",
  });

  // ---- CRITICAL 2: paid-model acquisition bypass ---------------------------
  if (VICTIM_MODEL) {
    await probe("C2: user cannot self-insert an acquisition for a PAID model", {
      role: "authenticated",
      claims,
      statements: `insert into public.model_acquisitions (user_id, model_id, license_type, price_paid, status) values ('${USER}','${VICTIM_MODEL}','standard',0,'active');`,
      expect: "error",
    });
  } else {
    console.log("skip  C2 — no paid published model present");
  }

  // ---- CRITICAL 3: identity-less storage helper ----------------------------
  if (vendorRow && vendorRow.user_id !== USER) {
    // EXECUTE was revoked from client roles after the audit, so a user session
    // cannot even call it.
    await probe("C3: client session cannot EXECUTE can_upload_to_storage_folder", {
      role: "authenticated",
      claims,
      statements: `select public.can_upload_to_storage_folder('${vendorRow.user_id}');`,
      expect: "error",
    });
    // Even from the server side the rewritten body is identity-safe: it
    // compares the folder to auth.uid(), which is NULL without user claims.
    const rows = await sql(
      `select public.can_upload_to_storage_folder('${vendorRow.user_id}') as v`
    );
    if (rows[0]?.v === false) {
      passed++;
      console.log("ok    C3b: helper returns false for another user's folder id");
    } else {
      failed++;
      console.log(`FAIL  C3b: helper returned ${JSON.stringify(rows[0]?.v)} for another user's folder`);
    }
  }

  // ---- HIGH 4: profile PII is not public -----------------------------------
  await probe("H4: anon cannot read any profile rows (PII closed)", {
    role: "anon",
    claims: anonClaims,
    statements: `select count(*) from public.profiles;`,
    expect: "success", // the query itself runs; the count is asserted below
  });
  // NOTE: the query API returns the LAST statement's result set, so the
  // SELECT must come last — a trailing ROLLBACK would return []. The SELECT
  // is read-only, so an implicit commit (if any) persists nothing.
  const anonRows = await sql(
    `begin; set local role anon; set local request.jwt.claims = '{}'; select (select count(*) from public.profiles) as n;`
  );
  if (Number(anonRows[0]?.n) === 0) {
    passed++;
    console.log("ok    H4b: anon sees 0 profile rows");
  } else {
    failed++;
    console.log(`FAIL  H4b: anon sees ${anonRows[0]?.n} profile rows`);
  }

  // ---- HIGH 6: self-publishing bypass ---------------------------------------
  await probe("H6: owner cannot set own model status to published", {
    role: "authenticated",
    claims,
    statements: `update public.models set status='published' where owner_id='${USER}' and status in ('draft','pending_review','rejected');`,
    expect: "error",
  });

  // ---- HIGH 5: contact form bounds ------------------------------------------
  await probe("H5: oversized contact message rejected by policy", {
    role: "anon",
    claims: anonClaims,
    statements: `insert into public.contact_messages (name, email, message) values ('x','a@b.co', repeat('a', 5001));`,
    expect: "error",
  });

  // ---- MEDIUM 7: RLS no longer errors on revoked helpers ---------------------
  await probe("M7: authenticated can read own profile without EXECUTE errors", {
    role: "authenticated",
    claims,
    statements: `select id, full_name from public.profiles where id = '${USER}';`,
    expect: "success",
  });

  await probe("M7b: anon catalog read (published models) still works", {
    role: "anon",
    claims: anonClaims,
    statements: `select count(*) from public.models where status='published';`,
    expect: "success",
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Runner error:", err.message);
  process.exit(2);
});
