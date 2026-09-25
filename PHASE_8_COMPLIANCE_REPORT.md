# Phase 8 / 8b / 9 — Legal, Trust & Compliance + Security Loose Ends

**Date:** September 13, 2026
**Branch:** V1
**Verdict:** Code-complete. Legal content is **DRAFT-PENDING-LAWYER-REVIEW** — not verified-done. Several DoD items require live environment access (deployed URLs, Lighthouse run, real Clerk login, applied migrations) and are marked explicitly below.

---

## 1. Legal pages (all DRAFT — flagged, not final)

| Page | Route | Status |
| :--- | :--- | :--- |
| Terms of Service | `/terms` | Draft — pending lawyer review |
| Privacy Policy (DPDP-aligned) | `/privacy` | Draft — pending lawyer review |
| Refund & Cancellation Policy | `/refund-policy` | Draft — pending lawyer review |
| Cookie Policy | `/cookies` | Draft — pending lawyer review |

Every page renders through `components/marketing/legal-doc.tsx`, which displays a
**non-removable "Draft — pending lawyer review" banner** until an advocate/CA signs
off and the placeholders are replaced.

Coverage:
- **Terms:** marketplace liability caps, user content/IP ownership + licensing terms,
  IT Rules 2021 §prohibited-content list (verbatim-aligned categories), account
  termination grounds + notice, escrow mechanics, governing law `[JURISDICTION]` placeholder.
- **Privacy:** full data inventory (Clerk auth data, uploads, mart/freelance
  transactions, contact form, waitlist emails, logs), purpose limitation, consent
  records section, processor list, retention table, DPDP rights incl. nomination,
  named Grievance Officer with 72h/15-day timelines.
- **Refund/Cancellation:** stage-based cancellation windows (placed → accepted →
  printing → shipped), reprint/refund remedies with photo evidence rules, freelance
  escrow cancellation + rejection windows, digital-goods non-refundability with
  exceptions, drafted **before Razorpay is live** as required.
- **Cookie Policy:** essential vs analytics vs marketing, banner behavior doc.

## 2. Cookie consent — block-until-accept (implemented)

- `components/marketing/cookie-consent.tsx` — banner with **Accept all /
  Essential only / Customise**; per-category checkboxes; no pre-ticked boxes;
  persists to localStorage + logs server-side.
- **Blocking invariant:** no analytics/marketing provider exists in the codebase
  (verified: zero `gtag|Analytics|Script` integrations). The gate is
  `hasConsent()` (client) / `isNonEssentialCookieAllowed()` (server, `lib/consent.ts`)
  which returns `false` until explicit accept. Any future provider MUST check the
  gate before loading — the DoD screenshot (DevTools: no non-essential cookies
  before accept) is trivially satisfiable today because nothing non-essential loads.
- Footer **Cookie settings** button re-opens the banner (`cookie-settings-button.tsx`).

## 3. Explicit consent checkboxes (not pre-checked, timestamped)

- `components/marketing/consent-checkbox.tsx` — links to real `/privacy` + `/terms`,
  `required`, never pre-checked.
- Wired into: **signup** (both Clerk and Supabase forms), **contact form**,
  **waitlist form**.
- Server-side double enforcement: `app/actions.ts` rejects submissions with
  `formData.get("consent") !== "on"`; `app/consent-actions.ts` writes
  `consent_records` rows (type, granted, policy_version, timestamp).
- **DB migration:** `supabase/migrations/20260913100000_consent_records.sql` —
  append-only table (no client UPDATE/DELETE grants), insert-only RLS, rate limit.
  ⚠️ **Not yet applied to the live DB** (no Supabase CLI locally) — run
  `supabase db push` or apply via dashboard before deploy.

## 4. Footer / About business details

- `lib/site.ts` — single source of truth: `[LEGAL_ENTITY_NAME]`,
  `[REGISTERED_OFFICE_ADDRESS]`, `[GRIEVANCE_OFFICER_NAME]`, GSTIN `null`
  (stated as "GST registration pending" on About).
- Footer now renders entity + address + email + Grievance Officer block, plus
  Refund/Cookie Policy links.
- About page has a "Business details" section with grievance timelines.
- ⚠️ **All values are placeholders** — you must supply real details (user task item 1:
  "using real business details supplied by the user" — none were provided; nothing was invented).

## 5. Marketing copy audit (done)

Removed/softened unsupported claims:
| Before | After |
| :--- | :--- |
| "guaranteed upfront pricing" (mart calculator, mart meta, landing card) | "upfront pricing" / "quoted rate" |
| "Guaranteed Price" column header | "Quoted Price" |
| "Best Value" badge | "Lowest quote" (factually true — it's the sorted minimum) |
| "Reprint Guarantee: ±0.08mm" | "Reprint remedy … see the Refund Policy" |
| "guaranteed weekly payouts" (partner portal) | "payouts on a weekly settlement cycle" |
| "money-back guarantees on physical tolerances" | "reprint and refund remedies when a part misses its stated tolerance" |
| "verified tolerances … pristine surface finishes" | "individually reviewed … calibration test coupon" |
| "Print-ready tolerance guarantee" (freelance) | "Manufacturing-focused vetting" |
| "Funds stay in secure escrow" | "Funds are held in escrow" |
| "instant vendor quoting across SLA, FDM, SLS, or CNC" | "vendor quoting across supported FDM and resin (SLA/MSLA) materials" — SLS/CNC are not actually offered |

Testimonials: **none exist** anywhere (searched `testimonial|what our users|loved by` — 0 hits). Nothing to remove.

Images: **no `public/` directory exists** — every visual is a procedural Three.js
render or a lucide icon. No third-party/copyrighted imagery is in use. Avatar
images (user-supplied) got proper alt text.

## 6. Accessibility baseline

Static audit performed (cannot run Lighthouse without a deployed/browsed env):
- Icon-only buttons: all 50 checked via `aria-label` grep — every icon-only
  control has one (nav open/close, password toggle, favorite, remove-file,
  modal close, etc.). Fixed: freelancer avatar `alt=""` → descriptive alt.
- Form labels: all inputs route through `Field`/`Input` with associated
  `<label htmlFor>`; search inputs have `aria-label`; errors use `role="alert"`
  + `aria-live`.
- Headings: exactly one `<h1>` per audited page (`/models` via ModelsHeader,
  `/models/[id]`, `/mart` via Hero, `/freelance` via Hero, landing via CinematicHero).
- Contrast: the design system already notes and avoids the one AA-missing pairing
  (`faint-on-raised` — see `components/ui/input.tsx` comment).
- ⚠️ **Automated axe/Lighthouse pass still required** on the 5 live pages — paste
  the before/after reports once deployed (DoD explicitly wants the actual report).

## 7. Phase 8b — security loose ends

### 7.1 Realtime channel authorization (was NOT enforced — now added)
- No `realtime.messages` policy existed; the edge function broadcasts to
  `vendor-orders:<provider_id>` and broadcast channels are not RLS-filtered by
  default → any user could subscribe to another vendor's channel.
- **Migration `20260913110000`** adds a `realtime.messages` SELECT policy
  scoping `vendor-orders:%` topics to the owning vendor user, plus `REVOKE SELECT FROM anon`.
- **Probe P8-RT** added to `supabase/tests/rls_regression.mjs` (seeds a message
  as service role, reads as attacker → must see 0 rows).
- ⚠️ Live two-JWT subscribe test still to run post-deploy (procedure documented
  in the migration header).

### 7.2 MFA for admin role (runbook — manual step)
- Clerk instance security settings cannot be set from code.
- **`docs/runbooks/admin-mfa-enforcement.md`** — exact Dashboard/CLI steps,
  app-level gate snippet (`requireAdmin` + session MFA-claim check), and a
  5-item verification checklist incl. real-login test.
- ⚠️ Verification requires a real login — not yet performed.

### 7.3 SLA/accept race (was racy — fixed + tests)
- Race confirmed: both `respond_to_mart_order` and `check_mart_order_sla` read
  status without `FOR UPDATE` → concurrent accept + SLA sweep could
  double-assign. `transition_order_payment_state` had the same pattern.
- **Migration `20260913120000`**: `SELECT … FOR UPDATE` row locks in all three
  functions; accept guard widened to `placed|pending_vendor_response`;
  buyer cancel allowed pre-accept.
- **`supabase/tests/sla_accept_race.mjs`**: 3 assertions — accept-wins,
  stale-accept-rejected, lock-serialization proof.
- ⚠️ Requires `SUPABASE_ACCESS_TOKEN` + `REF` to run against live DB.

### 7.4 Workflow permissions (fixed)
- `.github/workflows/rls-regression.yml` now has `permissions: contents: read`
  (was unspecified → default write token). Actions used are official only
  (`actions/checkout@v4`, `actions/setup-node@v4`).

### 7.5 npm audit + Dependabot (fixed)
- `npm audit` before: **1 critical** (next RCE ×2), **2 high** (sharp/libheif, js-yaml).
- After `npm audit fix` + `next@16.3.5`: **`found 0 vulnerabilities`**.
- `.github/dependabot.yml` added (npm + github-actions, weekly, grouped minor/patch).

## 8. Phase 9 (SEO — quick wins shipped)

- `app/sitemap.ts` (16 public routes), `app/robots.ts` (auth/dashboard/admin/api
  disallowed), `metadataBase` + canonical alternates in `app/layout.tsx`,
  OG/Twitter cards, `app/opengraph-image.tsx` (generated, no binary asset),
  Organization + WebSite JSON-LD, per-model **Product** schema with INR price.
- Set `NEXT_PUBLIC_SITE_URL` in production env for correct absolute URLs.
- ⚠️ Search Console verification is a manual post-deploy step.

## 9. Honest gaps (blocking "verified-done")

1. **Lawyer/CA review** of all four legal documents — content is draft-only.
2. **Real business details** — entity, address, Grievance Officer name, GSTIN
   status are placeholders in `lib/site.ts` (user chose "Not decided/Not ready").
3. **Migrations not applied** — `20260913100000`, `20260913110000`, `20260913120000`
   need `supabase db push` (no Supabase CLI on this machine).
4. **Lighthouse/axe before-after reports** — need deployed URLs + real run.
5. **MFA enable + real login test** — per runbook §4.
6. **Live two-JWT Realtime subscribe rejection test** — post-deploy.
7. **Consent-banner blocking screenshot** — trivially satisfied today (no
   analytics SDK exists to load), capture it from the deployed site for the DoD.

## 10. Verification performed in this session

- `npx tsc --noEmit` → clean.
- `npm run lint` → 0 errors (107 pre-existing warnings).
- `npm run build` (next 16.3.5) → ✓ compiled, 20/20 pages, incl. all new routes
  (`/terms`, `/privacy`, `/refund-policy`, `/cookies`, `/sitemap.xml`,
  `/robots.txt`, `/opengraph-image`).
- `npm audit` → 0 vulnerabilities.
