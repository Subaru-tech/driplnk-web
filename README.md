# DripLnk Website

Public marketing site + auth + post-login dashboard, built to the DripLnk UI/UX spec.

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Supabase.

## Running it

```bash
npm install && npm run dev
```

Copy `.env.example` to `.env.local` and fill in your Supabase keys. **Without them the app
runs in "backend not connected" mode**: every dashboard panel renders its real empty state,
a banner says so explicitly, and auth is inert. No sample data is ever substituted — see
"The no-fabricated-data rule" below.

## Two kinds of account

One account. Everyone signs up the same way; selling is opted into later.

| | Creator | Seller |
| --- | --- | --- |
| Who | Uses LeaFF OS / the app, generates models, orders prints | Uploads models to sell on the Mart |
| Lands on | `/dashboard` | `/seller` |
| Becomes real | at sign-up | when they open a storefront at `/seller` |

Credentials are **email + password**, nothing else. Nobody is asked which side they're on:
the server reads `profiles.role` after the password succeeds and routes to `/dashboard` or
`/seller`. `/dashboard` has no role check at all — a seller is also a customer, with a
library and orders of their own. `/seller` has no gate either; an account without a
storefront is simply offered one.

## Backend

Schema, RLS, storage buckets and the sign-up role trigger live in a **separate folder**,
`../driplnkk-backend`. Nothing but the two public keys is kept in this repo — the
service-role key never appears here. See that folder's `README.md` for deployment and
`docs/auth-flow.md` for how the two-role login is enforced server-side.

## Layout

```
app/
  (marketing)/     Home, LeaFF OS, Models (marketplace), Mart, App, About, Contact, Terms, Privacy
                   models/[slug]  public model page — buy or send to Mart
  (auth)/          Login, Signup, Password reset, actions.ts (role resolution)
  dashboard/       Creator shell + Overview, Models, Library, Mart Orders, Billing, Account
  seller/          Seller shell + Overview, Listings, Sales, Payouts, Account
                   listings/[id]  listing editor + publish flow
  actions.ts       Server actions for the waitlist + contact forms
components/
  ui/              Button, Card, Input, Modal, Toast, StatusPill, EmptyState, Skeleton, Spinner
  marketing/       Nav, Footer, Hero, PillarCard, HowItWorks, WaitlistForm, CtaBand, …
  auth/            AuthCard, LoginForm, SignupForm, PasswordRequirements
  seller/          ListingRow, ListingEditor, StartSelling, UploadListingButton
  dashboard/       Shell, StatCard, ModelCard, OrderRow, LedgerTable, CreditBuyModal, …
lib/
  roles.ts           The two account types and where each one lands
  marketplace.ts     Categories, licences, sorts, publish blockers
  account.ts         Server-side role read (profiles.role is authoritative)
  supabase.ts        Browser client + config (single source of truth for env)
  supabase-server.ts Server client (cookie-bound) + getCurrentUser
  queries.ts         All dashboard reads
  types.ts           The shapes the UI is written against
  format.ts          Date / currency / credit formatters
proxy.ts           Supabase session refresh (Next 16 renamed middleware → proxy)
```

## Design tokens

`app/globals.css` holds the spec's tokens under their spec names (`--bg-primary`,
`--text-secondary`, …), mapped to readable Tailwind utilities in the `@theme` block —
`bg-canvas`, `bg-surface`, `bg-raised`, `text-fg`, `text-muted`, `text-faint`,
`border-line`, plus `accent` and the status colours. The comment beside each mapping gives
the spec name.

Dark is the default. Light is an opt-in toggle stored in `localStorage` and applied before
first paint by `components/theme-script.tsx`; it is deliberately **not** driven by
`prefers-color-scheme`.

Spacing keeps Tailwind's 4px step rather than redefining it, and the spec's 8px base is
enforced by convention: **use even steps only** (`p-2` 8px, `p-4` 16px, `p-6` 24px,
`p-8` 32px, `p-12` 48px, `p-16` 64px). Redefining `--spacing` to 8px would have silently
doubled every `h-*`/`w-*` in the codebase.

## Scroll motion

The vocabulary is "print head + CAD annotation" rather than generic fade-up, to stay on the
spec's technical/CAD-adjacent side:

| Effect | Where | Driven by |
| --- | --- | --- |
| Progress rail filling left→right | under the sticky nav | CSS `scroll(root)` timeline |
| Hero focus-pull (copy drifts + dims, mesh swells) | Home + product heroes | CSS `view()` timeline |
| Layer wipe — content grows bottom-up like a print | pillar/feature/flow cards | IntersectionObserver + CSS transition |
| Scan line traversing the heading rule | every `SectionHeading` | CSS keyframes on reveal |
| Drafting brackets drawing onto corners | cards | CSS pseudo-elements on reveal |
| Step connector drawing itself | How it works | CSS `view()` timeline |

The continuous effects use CSS scroll timelines, so **no scroll listener runs on the main
thread**. They're gated behind `@supports (animation-timeline: scroll())`; without support
the layout is simply static, and both rails default to empty rather than stuck at 100%.

Three safety properties, each verified by selector matching rather than assumed:

1. The hidden pre-reveal state is scoped to `[data-js]`, stamped by the inline theme script.
   With scripting off, **0** elements are hidden.
2. `Reveal` shows content immediately if `IntersectionObserver` is unavailable.
3. Under `prefers-reduced-motion` the hidden state is switched **off entirely**, not merely
   shortened — a scroll-linked animation can't "finish early", so shortening it would leave
   content permanently invisible.

## The no-fabricated-data rule

Every dashboard panel is wired to a real Supabase query from day one. Before the backend
exists those queries return empty and the UI shows its real empty state. Specifically:

- Unknown numbers render an em dash, never `0`. A `0` only ever means the backend returned 0.
- The waitlist and contact forms report honestly when they can't reach a backend instead of
  returning a fake success.
- Legal pages render their section outline and a "not yet drafted" warning rather than
  invented clauses.
- Product pages use a labelled `AssetSlot` frame where a real screenshot/recording goes,
  rather than a mocked-up fake.

## What Track 2 needs to provide

Tables the UI already queries (see `lib/types.ts` for exact fields):

| Table | Used by |
| --- | --- |
| `profiles` (incl. `role`) | credit chip, Overview, Billing, Account, both layout guards |
| `seller_profiles` | seller shell, storefront, payouts |
| `listings` / `sales` / `payouts` | seller Overview, Listings, Sales, Payouts |
| `library_items` | My Library, and the storage policy that authorises downloads |
| `models` | Overview, My Models |
| `mart_orders` | Overview, Mart Orders, order detail |
| `credit_ledger` | Billing ledger (paginated, 20/page) |
| `waitlist` | marketing waitlist form |
| `contact_messages` | contact form |

Endpoints still to build, each currently failing honestly with a toast:

- `POST /api/billing/checkout` → returns `{ redirectUrl }` for Razorpay.
- `DELETE /api/account` → account deletion (needs the service-role key).
- Session listing for Account → Active sessions. `supabase-js` has no client-side
  "list my sessions" call, so this needs a server route; the section renders its empty
  state until then.

Also add an `avatars` storage bucket for profile pictures.

## Verified

- `npm run build` and `npx eslint .` both clean.
- All 16 routes return 200.
- No horizontal overflow at 320 / 375 / 768 / 1024 / 1280 px on any page.
- Sidebar 240px at ≥1024px, bottom tab bar below it, 56px top bar at every width.
- Contrast (WCAG AA): `#9AA3AB` on `#0B0D0F` = **7.60:1**, as spec §8 asked to confirm.
  Full audit of every token pair in both themes was run; see the caveat below.

## Known gaps

- **`--text-tertiary` fails AA as body text.** `#5C666E` is 3.32:1 on `--bg-primary` and
  2.80:1 on `--bg-tertiary`. It's used for `text-xs` meta (dates, hints), which WCAG treats
  as normal text needing 4.5:1. The token is left at its spec value — it's a design
  decision, not a bug to fix unilaterally. `#7A8892` clears AA on every surface if you want
  it fixed.
- Founder names/bios on About, the `hello@driplnk.in` address, and the social URLs are
  marked placeholders in code.
- `/login/reset` was added because §4.1 puts a "Forgot password?" link on the login card,
  though the page isn't in the §2 site map.
