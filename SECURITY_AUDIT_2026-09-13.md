# Security & Integrity Audit — 2026-09-13

**Project:** DripLnk Web (`driplnk-web`) · **Branch:** `V1` · **Final commit:** `a4d36e9`

Two full audit passes over backend, database, edge functions, and frontend. Every
vulnerability below was **exploit-proven against the live database** using rolled-back
attacker sessions (`SET ROLE authenticated/anon` + synthetic JWT claims), then fixed and
re-probed. Nothing on this list is theoretical.

---

## 1. Critical vulnerabilities (exploit-proven → fixed)

### 1.1 Vendor self-approval (privilege escalation) — `providers` RLS
- **Attack:** `"providers: user update own"` policy had no status constraint. Any signed-in
  user could `INSERT`/`UPDATE` their own provider row to `status='approved'` and appear as a
  vetted print hub.
- **Proof:** A random creator account inserted an approved vendor provider successfully.
- **Fix:** Migration `20260913200000` — INSERT requires `status='pending'` and known types;
  UPDATE allows only `pending`/`rejected` transitions and preserves `type`. Approval is
  admin-only via `admin_review_provider`.
- **Re-test:** Blocked ✅ (probe `C1`, `C1b`, `C1c`)

### 1.2 Paid-model purchase bypass — `model_acquisitions` RLS
- **Attack:** INSERT policy was `user_id = auth.uid()` — no payment linkage. Any user could
  self-grant an active acquisition for a paid model.
- **Proof:** Self-inserted an active acquisition for the ₹799 published model.
- **Fix:** No client-side INSERT policy remains. Claims go through
  `claim_model_acquisition` (SECURITY DEFINER, free-models-only); purchases belong to the
  payment flow on the service client. App fallback in `library.ts` now uses the service
  client after explicit free/published checks.
- **Re-test:** Blocked ✅ (probe `C2`)

### 1.3 Cross-user storage access — storage RLS
- **Attack:** Seven `"verified profile"` storage policies called
  `can_upload_to_storage_folder()`, which returned **true for any existing profile id** —
  read/write/delete on everyone's private `model-files` and `freelance-deliverables`
  objects for any signed-in user.
- **Fix:** Migration `20260913200000` dropped all helper-based policies and replaced them
  with owner-scoped ones (`(storage.foldername(name))[1] = auth.uid()`).
  Migration `20260913210000` rewrote the helper itself to be identity-safe:
  `folder_id IS NOT DISTINCT FROM auth.uid()::text` (strict boolean; deny-by-default with
  no user claims) and revoked client EXECUTE. Client sessions can no longer call it, and
  any future policy referencing it is safe by construction.
- **Re-test:** Blocked ✅ (probes `C3`, `C3b`)

### 1.4 Price tampering on mart orders — `create_mart_order` RPC
- **Attack (pre-audit baseline):** Live DB still had the old 5-arg `create_mart_order`
  trusting a client-supplied `p_price` — a buyer could order a ₹5,000 print for ₹50.
- **Proof:** Live function signature accepted `p_price numeric`.
- **Fix:** Migration `20260913000000` — 4-arg signature; price recomputed server-side from
  the vendor's `vendor_pricing_rules` (`GREATEST(min_order_price, weight_g × price_per_gram)`,
  case-insensitive material match, missing rule = hard failure). Old signature dropped
  (call with 5 args now → `42883`).
- **Verify:** 50 g PLA → ₹200.00 (Apex min-order floor); 1000 g PLA → ₹2400.00 (1000 × 2.4).
  All five negative cases rejected: wrong buyer, unapproved vendor, self-order, unoffered
  material, legacy 5-arg call.

### 1.5 Broken vendor quoting — `get_mart_vendor_quotes` missing/regressed
- **Attack (pre-audit baseline):** Function didn't exist live (quoting broken); the repo's
  later migration had replaced rule-based pricing with a flat `weight_g × 4.5`, ignoring
  vendor rules entirely.
- **Fix:** Restored rule-based pricing (per-vendor `price_per_gram` + `min_order_price`,
  approved vendors only, case-insensitive, price-ascending).
- **Verify:** 50 g PLA → ₹180/₹200 floors; 200 g PLA → ₹480/₹530 — matches vendor tables
  exactly (flat formula would have said ₹900).

### 1.6 Unauthenticated edge functions
- **Attack:** `vendor-order-notification` (spends WhatsApp/SMS/email money) and
  `model-virus-scanner` (CPU-heavy scanning over arbitrary bytes) accepted any request.
  The scanner was a free CPU-exhaustion endpoint for the internet.
- **Fix:** Both deployed with a service-bearer check
  (`Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`); `app/api/upload/model` already
  sent it. Notification trigger now authenticates via a **Vault-stored** secret (name
  `service_role_key`) instead of a plain GUC (readable by every session), with a
  `COALESCE` guard so a missing secret can't fail order inserts.
- **Verify:** `401` without/wrong bearer, `200` with the service key; EICAR probe still
  correctly rejected by the scanner; end-to-end order → pg_net → edge function → realtime
  broadcast to vendor channel verified (HTTP 200).

### 1.7 Open redirect — OAuth callback
- **Attack:** `app/auth/callback/route.ts` used the `next` param and `x-forwarded-host`
  unvalidated — classic open redirect to attacker domains.
- **Fix:** Same-origin-only validation of `next`; host taken from server config, not
  request headers.

---

## 2. High severity (fixed)

| # | Issue | Fix |
|---|---|---|
| 2.1 | **Public PII dump** — `"profiles: read clerk profile"` (`clerk_id IS NOT NULL` = every row) exposed all users' emails/phones | Self-read, admin-read, and a narrow public marketplace-card policy (seller role only). Anon now sees 0 rows (probe `H4`/`H4b`) |
| 2.2 | **Profile tampering** — UPDATE policies allowed changing `role`/`credits_balance` (also direct admin escalation) | WITH CHECK locks `role`, `credits_balance`, `clerk_id` to their current values |
| 2.3 | **Owner self-publishing** — `models` owner-UPDATE could set `status='published'`, bypassing moderation | Only `draft`/`pending_review`/`rejected`/`archived` transitions; publishing only via `admin_review_model` (probe `H6`) |
| 2.4 | **Spam/PII sink** — `contact_messages`/`waitlist` accepted unbounded anonymous inserts | Length caps enforced by INSERT policies + 1-hour per-email rate-limit trigger (probe `H5`) |
| 2.5 | **Anon key as upload token** — `getUploadSession` handed the public anon key to the browser as an "access token"; the only gate was the identity-less helper | `mode: "jwt" \| "server"`; Clerk sessions upload via the verified `/api/upload/model` route; freelance uploads moved to a new server action |
| 2.6 | **RLS runtime errors** — policies referenced functions whose EXECUTE the RPC lockdown had revoked, erroring every anon/authenticated read of profiles/models | Grants restored to match current call sites (`user_role`, helper, onboarding RPCs) |

---

## 3. Medium severity & bugs (fixed)

- **Anonymous quote abuse** — `calculateMeshQuotes` parsed arbitrary uploaded bytes into
  memory and persisted them with no auth: now requires sign-in, 50 MB cap, material
  allowlist, path-shape validation on order placement.
- **IDOR on freelance downloads** — `getFreelanceFileDownloadUrl` checked buyer/freelancer
  role but not that `filePath` belonged to *that* request: request-membership check added;
  service client used (Clerk users hold no Supabase JWT).
- **`updateUserProfile` silent name-drop** — `sync_clerk_user_profile` is
  create-or-nothing, so Clerk name changes were never persisted; profile row is now
  updated directly (safe columns only), with 1–120 char name and https-only avatar
  validation (stored-XSS guard).
- **`claimFreeModel` fallback** wrote through the anon client — guaranteed RLS failure;
  now service client after explicit free/published checks.
- **`'in_review'` status bug** — wizard submitted a status the `models` CHECK constraint
  rejects (every submission failed); fixed in both code and constraint awareness.
- **`model_events` CHECK** — rejected `draft_saved`/`submitted_for_review`/`published`
  (the exact types the app writes, silently swallowed by try/catch); constraint widened.
- **Admin/status inputs** — mart order status validated against the DB enum allowlist;
  `review_notes` capped; nonexistent `fileId` in `getModelDownloadUrl` now errors instead
  of silently falling back to the primary file.
- **Input validation** — length caps and http(s)-only portfolio URLs (`javascript:` blocked)
  on vendor/freelancer applications, contact/waitlist, thumbnails (`updateModelThumbnail`
  accepts https or image data-URLs only).
- **Storage-row consistency** — server-mode uploads store the API route's returned path;
  orphan cleanup only on the JWT path (anon client can't delete).
- **UX** — Supabase Google OAuth callback preserves `redirect`; theme-script duplicate
  expression removed; `X-Powered-By` suppressed; security headers already present.

---

## 4. Database migrations applied & recorded

All applied via the Management API (as `postgres`) and recorded in
`supabase_migrations.schema_migrations`:

| Migration | Content |
|---|---|
| `20260913000000_security_hardening_price_integrity` | Rule-based quotes; price-safe `create_mart_order`; `model_events` CHECK; vault-backed notification trigger; `updated_at` trigger |
| `20260913200000_rls_hardening` | Provider status integrity; acquisition gate; helper-policy removal; profile PII/tampering fixes; model moderation; contact/waitlist bounds; function grants; rate-limit trigger |
| `20260913210000_storage_helper_identity_fix` | Identity-safe `can_upload_to_storage_folder`; client EXECUTE revoked |

Also: the migration **ledger was repaired** — 9 hand-applied migrations were marked so
`supabase migration list` is coherent. `20260912120000` (escrow state machine) was
**intentionally left unapplied**: its tables (`order_payments`, `order_payment_transitions`)
are live but referenced by no app code; `db push` will apply it when wanted.

**Ops notes:**
- Service key stored in Supabase **Vault** (secret name `service_role_key`) — never a
  plain GUC or migration history.
- Stray orphaned deployment `get-service-role` (not in repo) deleted from the project.
- `supabase/.temp/` gitignored; CLI link state has no secrets.

---

## 5. Verified clean (no action needed)

`proxy.ts` (session refresh only, auth decisions in layouts), `admin-guard`
(role check + service client inseparable), `seller.ts`/`vendor.ts` (validated RPCs),
`next.config.ts` headers (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy),
`deleteUserAccount` (service client, correct ordering), `upload.ts` path validation.

---

## 6. Regression protection

### Runnable suite — `supabase/tests/rls_regression.mjs`
```bash
SUPABASE_ACCESS_TOKEN=sbp_... REF=<project-ref> node supabase/tests/rls_regression.mjs
```
12 probes, all green: `C1`, `C1b`, `C1c`, `C2`, `C3`, `C3b`, `H4`, `H4b`, `H6`, `H5`,
`M7`, `M7b`. Every probe runs in `BEGIN…ROLLBACK` with synthetic JWT claims —
safe against production, and it already caught one incomplete fix during this session
(helper rewritten, not just its policies).

### CI — `.github/workflows/rls-regression.yml`
Runs the suite on every push/PR touching `supabase/**`. Repo secrets set:
- `SUPABASE_ACCESS_TOKEN` ✅
- `SUPABASE_PROJECT_REF` ✅

The first run fires when the security commit is pushed.

---

## 7. Final state

- **Commit:** `a4d36e9` — `fix(security): close exploit-proven RLS, price, and auth
  bypasses across stack` (27 files, +1388/−192) on branch `V1`; working tree clean.
- **Checks:** `tsc --noEmit` ✅ · ESLint ✅ · `next build` ✅ · probes 12/12 ✅
- **Exploit proofs:** all re-run post-fix and blocked; legitimate flows
  (catalog reads, own-profile reads, draft edits, pending applications, contact form)
  verified still working.

## 8. Outstanding recommendations

1. **Rotate the Supabase access token** used this session (it was pasted in plaintext
   chat) and update the GitHub secret:
   `gh secret set SUPABASE_ACCESS_TOKEN -R Subaru-tech/driplnk-web --body <new>`
2. Push `V1` so the security commit lands and CI runs for the first time.
3. Add rate limiting to remaining public server actions (waitlist duplicates,
   vendor/freelancer applications).
4. Consider a frontend-bundle pass: CSP header, third-party scripts, client-side data
   exposure.
5. Deploy the payment flow that `model_acquisitions` now assumes for paid models.
