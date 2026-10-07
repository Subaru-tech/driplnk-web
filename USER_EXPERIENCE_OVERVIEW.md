# DripLnk — Complete User Experience (UX) Overview

> **Platform:** DripLnk (`driplnk-web`)  
> **Production Deployment:** [driplinkk-website.vercel.app](https://driplinkk-website.vercel.app)  
> **Stack:** Next.js 16 (App Router + Turbopack), React 19, Supabase (PostgreSQL + RLS), Clerk Auth, Three.js (WebGL), Backblaze B2  
> **Last Updated:** 2026-09-28  

---

## Table of Contents
1. [Executive Summary & Core Philosophy](#1-executive-summary--core-philosophy)
2. [Primary User Personas & Journey Maps](#2-primary-user-personas--journey-maps)
3. [Global Platform Map & Route Hierarchy](#3-global-platform-map--route-hierarchy)
4. [Deep-Dive Page Walkthroughs](#4-deep-dive-page-walkthroughs)
   - [4.1 Public Discovery & Marketing Surfaces](#41-public-discovery--marketing-surfaces)
   - [4.2 Authentication & Profile Initialization](#42-authentication--profile-initialization)
   - [4.3 Consumer & Creator Dashboard](#43-consumer--creator-dashboard)
   - [4.4 CAD Specialist Network (Freelance Hub & Studio)](#44-cad-specialist-network-freelance-hub--studio)
   - [4.5 Manufacturing Partner Hub (Mart Print Farm Network)](#45-manufacturing-partner-hub-mart-print-farm-network)
   - [4.6 Seller Storefront & Listing Operations](#46-seller-storefront--listing-operations)
   - [4.7 Administrative Queue & Governance](#47-administrative-queue--governance)
5. [Key UX & Technical Subsystems](#5-key-ux--technical-subsystems)
6. [Design Tokens, Typography & Aesthetics](#6-design-tokens-typography--aesthetics)
7. [UX Assessment, Edge Cases Handled & Roadmap](#7-ux-assessment-edge-cases-handled--roadmap)

---

## 1. Executive Summary & Core Philosophy

DripLnk bridges the fragmented journey between CAD geometry and tangible manufactured parts. Traditional 3D ecosystems force engineers and makers into siloed tools: asset marketplaces (Thingiverse, Printables) focus only on hobbyist meshes, freelance platforms (Upwork, Fiverr) lack manufacturing comprehension, and on-demand print services (Shapeways, Xometry) provide opaque pricing with no direct design collaboration.

DripLnk unifies this ecosystem into three interconnected pillars under the guiding principle:
> *"Engineer Your Next 3D Print. Design it once. Own it forever."*

```
                           ┌───────────────────────────────┐
                           │      DripLnk Platform         │
                           └──────────────┬────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        ▼                                 ▼                                 ▼
┌──────────────────┐            ┌───────────────────┐            ┌──────────────────┐
│  CAD Marketplace │            │    DripLnk Mart   │            │   CAD Specialist  │
│  Verified Models │ ─────────> │ On-Demand 3D Print│ <───────── │     Network      │
│  STL / STEP / 3MF│            │ Multi-Farm Routing│            │ Milestone Escrow │
└──────────────────┘            └───────────────────┘            └──────────────────┘
```

1. **Digital CAD Marketplace:** High-fidelity, engineering-grade 3D models with interactive WebGL preview, slice-verified geometry, and instant download/licensing.
2. **DripLnk Mart (Print-as-a-Service):** Instant automated manufacturing quotes calculated directly from uploaded mesh geometry, routed to certified local print farm hubs.
3. **CAD Specialist Network:** Vetted mechanical engineers and parametric CAD modelers available for custom enclosures, mechanism design, and tolerance fits with escrow-backed milestones.

### Ecosystem Hierarchy & Platform Convergence

The platform establishes a unified product hierarchy rather than operating as disconnected tools:

$$\text{DripLnk Website / Web Platform} \longrightarrow \text{User Identity + CAD Marketplace + Mart Manufacturing + Freelance + Vendor/Admin} \longrightarrow \text{LeaFF OS Desktop App}$$

- **DripLnk Web Platform:** The central hub handling unified user identity (Clerk + Supabase shadow sync), public discovery, commercial licensing, on-demand manufacturing dispatch (Mart), freelance contracts, and vendor/admin governance.
- **LeaFF OS Desktop App:** The local creation, parametric modeling, and slice-verification engine. 

The desktop app and web platform converge on the same unified identity, cloud model repository, and manufacturing backend rather than existing as two independent products.

---

## 2. Primary User Personas & Journey Maps

### Persona A: The Hardware Maker / Buyer
* **Goal:** Source or commission a functional part, verify its geometry, and order physical prototypes.
* **Journey:**
  1. Lands on Home (`/`) or Models (`/models`).
  2. Filters by category (`Mechanical`, `Robotics`, `Enclosures`) or searches keywords.
  3. Opens model page (`/models/[id]`), rotates/zooms the 3D WebGL viewer, inspects dimensions and slicing specs.
  4. Clicks **"Get a Mart Quote"** to instantly transition the digital asset into physical manufacturing.
  5. Selects material (`PLA`, `PETG`, `ABS`, `Resin`) and infill density; views instant transparent pricing.
  6. Places order; tracks real-time fulfillment status (`placed` → `accepted` → `printing` → `shipped` → `delivered`) on `/dashboard/mart-orders`.

### Persona B: The 3D Designer / Seller
* **Goal:** Monetize CAD designs with clear licensing and automated royalty distribution.
* **Journey:**
  1. Signs up via Google SSO or email.
  2. Opens `/dashboard/models/upload` or deep-links directly from LeaFF OS desktop app (`leaffos://new`).
  3. Uploads primary model files (`.stl`, `.step`, `.3mf`) and screenshots; sets license and pricing (Free or ₹ INR).
  4. Manages inventory, downloads, and revenue inside the **Seller Hub** (`/seller`).

### Persona C: The Vetted CAD Specialist (Freelancer)
* **Goal:** Receive paid modeling inquiries, negotiate milestone rates, and deliver slice-verified CAD files.
* **Journey:**
  1. Applies via `/freelance/apply` completing the 5-step application: personal background, CAD proficiencies (`SolidWorks`, `Fusion 360`, `LeaFF OS`), rate expectations, and portfolio links.
  2. Monitors application status via real-time banners on `/dashboard` (`Pending Review` / `Changes Requested`).
  3. Upon manual admin review and approval, role is unlocked:
     - Profile appears on public `/freelance` directory with **Verified Trust Badge**.
     - Gains full access to **Specialist Studio** (`/dashboard/freelancer`).
  4. Accepts client briefs, provides estimates, and uploads deliverables to release escrow funds.

### Persona D: The Manufacturing Partner (Print Farm Vendor)
* **Goal:** Receive steady production orders matching their 3D printer fleet, materials, and regional capacity.
* **Journey:**
  1. Applies via `/vendor/apply`: submits business details, printer fleet breakdown (technologies, count, build volume), supported materials, and monthly capacity.
  2. Undergoes manual founder/admin vetting (no auto-approvals).
  3. Upon approval:
     - Unlocks **Vendor Hub** (`/dashboard/vendor`).
     - Configures payout destination via the isolated **Payout & Settlement Account** card (NEFT/RTGS bank account with IFSC check, or instant UPI ID).
  4. Reviews assigned print jobs, claims orders within the 45-minute SLA, advances production stages, and receives direct disbursements.

### Persona E: The Admin / Operations Moderator
* **Goal:** Protect platform integrity, enforce CAD quality, prevent counterfeit uploads, and maintain high print fulfillment standards.
* **Journey:**
  1. Authenticates as an admin (`profiles.role = 'admin'`).
  2. Reviews pending specialist and vendor applications on `/admin/listings`.
  3. Examines machine specs, portfolio links, and background; executes `Approve`, `Request Changes` (with reviewer notes), or `Reject`.
  4. Manages Mart order routing and vendor reassignment on `/admin/mart-orders`.

---

## 3. Global Platform Map & Route Hierarchy

The platform features **23 primary user-facing route entries** (spanning 44 dedicated App Router views including deep-linked sub-paths and modals), segmented into four authorization tiers:

| Route | View / Component | Access Tier | Primary Function |
|---|---|---|---|
| `/` | `HomePage` | Public | Hero proposition, product pillars, live stats, LeaFF OS deep-link |
| `/models` | `ModelsMarketplacePage` | Public | 21+ item CAD catalog, search, category pills, thumbnail cards |
| `/models/[id]` | `ModelDetailPage` | Public | Interactive WebGL 3D viewer, CAD specs, 1-click Mart quote |
| `/mart` | `MartPage` | Public | 3D print quote calculator, material guides, partner CTA |
| `/freelance` | `FreelancePage` | Public | Vetted specialist directory, skill filters, hire CTAs |
| `/freelance/[providerId]` | `FreelancerDetailPage` | Public | Specialist profile, portfolio, starting rates, hire modal |
| `/partner` | `PartnerPage` | Public | Dual-track portal for CAD Specialists and Print Hubs |
| `/about` | `AboutPage` | Public | Brand narrative, engineering philosophy, problem statement |
| `/contact` | `ContactPage` | Public | Support inquiry form, technical sales channels |
| `/terms` | `LegalDoc` (`terms/page.tsx`) | Public | Terms of service, platform rights, licensing terms |
| `/privacy` | `LegalDoc` (`privacy/page.tsx`) | Public | Privacy policy, data handling, tracking declarations |
| `/login` | Clerk Auth Shell (`(auth)/login`) | Auth | Google SSO, credential sign-in, session recovery |
| `/signup` | Clerk Auth Shell (`(auth)/signup`) | Auth | Google SSO, credential registration, terms acceptance |
| `/freelance/apply` | `ApplyForm` | Authenticated | 5-step CAD Specialist onboarding & status viewer |
| `/vendor/apply` | `VendorApplyForm` | Authenticated | Manufacturing partner application & fleet spec form |
| `/dashboard` | `OverviewPage` | Authenticated | Central command: stats, role shortcuts, active jobs, models |
| `/dashboard/models` | `ModelsPage` | Authenticated | Creator Studio: drafts, published files, download analytics |
| `/dashboard/mart-orders` | `MartOrdersPage` | Authenticated | Order tracking table, status pills, delivery timelines |
| `/dashboard/freelancer` | `FreelancerDashboardPage`| Specialist (Gated) | Incoming client briefs, active contracts, file uploaders |
| `/dashboard/vendor` | `VendorDashboardPage` | Vendor (Gated) | Print farm workbench, order lifecycle, Payout Settings |
| `/seller` | `SellerPage` | Seller | Storefront setup, listing management, sales breakdown |
| `/admin/listings` | `AdminQueueView` | Admin (Gated) | Multi-tab verification queue (Specialists, Vendors, Models) |
| `/admin/mart-orders` | `AdminMartOrdersPage` | Admin (Gated) | Manual order reallocation, SLA override, screening for prohibited items |

> **Note on Route Granularity:** In addition to the 23 primary routes above, the Next.js App Router tree includes specialized child routes and utility views (e.g. `/dashboard/library`, `/dashboard/account`, `/dashboard/billing`, `/dashboard/models/upload`, `/admin`, `/seller/payouts`, `/seller/sales`, `/seller/listings`, and legal policies `/refund-policy`, `/cookies`). The full application comprises 44 route handlers and page views.

---

## 4. Deep-Dive Page Walkthroughs

### 4.1 Public Discovery & Marketing Surfaces

#### Home (`/`)
* **First Impression:** High-contrast, dark-mode engineering canvas with subtle ambient cyan accents (`var(--accent)`). Modern sans-serif typography paired with monospaced metadata badges.
* **Top Fold:** Punchy headline (*"Engineer Your Next 3D Print"*), primary desktop link (`Open LeaFF OS`), and secondary links to browse models or start selling.
* **Scrolled Body:** Three distinct cards highlighting the platform pillars (Creator Marketplace, Mart Print Network, CAD Specialist Network). Real-time statistics counters showcase active community milestones.

#### Models Marketplace (`/models`)
* **Discovery Toolbar:** Real-time client-side search input paired with horizontal category pills: *All, Mechanical, Robotics, Electronics, Tools, Enclosures, Wearables*.
* **Catalog Grid:** 3-column responsive card layout. Each card displays:
  - 3D-rendered WebP geometry thumbnail.
  - Price indicator (`Free` badge or `₹` amount).
  - Model title, author attribution, and format tags (`STL`, `STEP`, `3MF`).
* **Interaction:** Hovering cards reveals subtle border lighting (`var(--line-strong)`) and micro-elevations.

#### Model Detail & WebGL Inspection (`/models/[id]`)
* **Interactive 3D Stage:** Embedded Three.js WebGL canvas allowing full 360° orbit, smooth pinch/scroll zooming, and directional lighting inspection.
* **Metadata Rail:** File weight, bounding dimensions ($X \times Y \times Z$ mm), polygon count, license terms (`CC-BY-SA`, `Commercial`), and creator credentials.
* **Conversion Funnel:** Two prominent action buttons:
  - **Open in LeaFF OS:** Deep-links directly to the native parametric editor.
  - **Get a Mart Quote:** Auto-populates the model's geometry into the print order pipeline.

#### Freelance Hub & Directory (`/freelance`)
* **Curated Specialist Cohort:** Displays verified specialists approved by administration.
* **Filtering Engine:** Filter by rate structure (*All, Hourly, Fixed Milestone*) and technical expertise (*SolidWorks, Fusion 360, LeaFF OS, Snap-fit, Tolerances ±0.05mm*).
* **Specialist Card:** Displays designer avatar, name, verified trust badge, starting rate, concise bio, and primary skill badges with direct link to profile.

---

### 4.2 Authentication & Profile Initialization

#### Sign In & Sign Up (`/login`, `/signup`)
* **Powered by Clerk Auth:** Seamless modal integration supporting one-tap Google OAuth and traditional email/password credentials with real-time password strength verification.
* **Terms Acceptance:** Embedded checkbox linking to Terms of Service and Privacy Policy before registration completes.
* **Shadow Database Sync:** On successful authentication, webhooks/server clients ensure a corresponding record is initialized in Supabase `profiles` with unique UUID.

#### CAD Specialist Application (`/freelance/apply`)
* **5-Step Stepper Flow:**
  1. *Personal Details:* Full name, professional bio, portfolio links (GitHub, ArtStation, OnShape).
  2. *CAD Expertise:* Primary software proficiencies, parametric modeling experience.
  3. *Rate Expectations:* Hourly rate in INR or fixed-milestone pricing.
  4. *Specialization Track:* Mechanism design, consumer electronics enclosures, or tolerance fitting.
  5. *Review & Submission:* Live completeness tracker ensuring all criteria are fulfilled.
* **Post-Submission State:** Automatically flips into a live status banner (*"Application Under Review"*), preventing duplicate submissions via database constraints.

#### Manufacturing Partner Application (`/vendor/apply`)
* **Fleet Capacity Form:** Collects legal business name, physical facility location, supported technologies (FDM, SLA, SLS), materials stock (PLA, PETG, ABS, Nylon, Resin), machine build volumes, and monthly part capacity.
* **Security Guard:** Bank and UPI payment credentials are deliberately excluded from this initial application to prevent PII exposure to moderation teams.

---

### 4.3 Consumer & Creator Dashboard

#### Central Command (`/dashboard`)
* **Dynamic Role Banners:**
  - *Pending Applicants:* Displays an amber alert detailing review status with a link to review or edit.
  - *Approved CAD Specialists:* Displays a green verified badge: *"Verified CAD Specialist • Studio and hire briefs active → Open Studio"*.
  - *Approved Manufacturing Partners:* Displays: *"Certified Manufacturing Partner • Print farm routing active → Open Vendor Hub"*.
* **Stat Row:** Live telemetry showing credit balances, total designs created, and active physical print orders.
* **Zero-State Experience:** If an account has zero models, an actionable **"Start with LeaFF OS"** onboarding card leads the view, eliminating empty visual space.
* **Recent Models & Orders:** Horizontal preview gallery of user assets and compact status list of physical print orders.

#### Creator Studio (`/dashboard/models`)
* **Inventory Management:** Tabbed views dividing models into *Drafts*, *Under Review*, *Published*, and *Acquired Library*.
* **Analytics Bar:** Track download counters, page impressions, and cumulative royalties.

#### Mart Order Tracking (`/dashboard/mart-orders`)
* **Lifecycle Timeline:** Step-by-step progress tracking for physical 3D print orders.
* **Fulfillment Data:** Displays assigned manufacturer, material specs, tracked package tracking numbers, and verified delivery receipts.

---

### 4.4 CAD Specialist Network (Freelance Hub & Studio)

#### Specialist Studio (`/dashboard/freelancer`)
* **Server-Side Access Gate:** Directly protected; non-approved applicants hit an explanatory gate prompting completion of vetting.
* **Workbench Tabs:**
  - *Incoming Briefs:* Review client RFQs with attached reference sketches, target deadlines, and budgets.
  - *Active Contracts:* Manage milestone deliverables with milestone-locked escrow guarantees.
  - *Deliverable Uploader:* Upload verified STEP/STL files directly to the client's project repository.
* **Profile Completeness Widget:** Guides the specialist on updating skills and rates to maximize matching score.

---

### 4.5 Manufacturing Partner Hub (Mart Print Farm Network)

#### Vendor Hub (`/dashboard/vendor`)
* **Operational Control Center:** Designed for high-volume print farm operators.
* **Performance Telemetry:** Active print queue count, total fulfilled orders, and gross order value (INR).
* **Incoming Job Claims:** Orders are dispatched with a 45-minute SLA timer. Vendors can view part volume, required material, and slicing tolerances before accepting.
* **Production Lifecycle State Machine:** Buttons allow operators to advance order status:
  $$\text{Placed} \longrightarrow \text{Accepted} \longrightarrow \text{Printing} \longrightarrow \text{Shipped} \longrightarrow \text{Delivered}$$

#### Post-Approval Payout & Settlement UI (`VendorPayoutCard`)
* **Strict Post-Approval Access:** Rendered exclusively for vendors with `status === 'approved'`.
* **Disbursement Rails:**
  - *Direct Bank Transfer:* Beneficiary name, account number with double-entry confirmation, and 11-character Indian IFSC validation (`/^[A-Z]{4}0[A-Z0-9]{6}$/`).
  - *Instant UPI:* Validates UPI Virtual Payment Addresses (`@okhdfcbank`, `@paytm`, `@upi`).
* **Over-the-Shoulder Privacy:** Once registered, account numbers are masked (`•••• •••• •••• 4512`) to prevent unauthorized viewing in busy workshop environments.
* **Architectural Isolation:** Saved to the dedicated `vendor_payout_details` partition protected by owner-only Row-Level Security.

---

### 4.6 Seller Storefront & Listing Operations

#### Seller Dashboard (`/seller`)
* **Storefront Customization:** Studio name, brand biography, and visual avatar/banner branding.
* **Sales Analytics & Listings:** Monitor conversion rates on paid digital CAD downloads and manage version releases (`v1.0`, `v1.1` changelogs).

---

### 4.7 Administrative Queue & Governance

#### Admin Queue (`/admin/listings`)
* **Role Verification:** Guarded by `ensureAdmin()` verifying `profiles.role = 'admin'` at the server level.
* **Verification Queues:**
  - *Freelancer Applications:* Evaluate specialist portfolios, software proficiency, and rate sanity.
  - *Vendor Applications:* Inspect print farm machinery, build volume envelopes, and location.
  - *Model Reviews & Moderation:* Validate copyright ownership and screen for prohibited items.
* **Action Suite:**
  - `Approve`: Promotes provider status to `approved`, immediately unlocking routes and directory listings.
  - `Request Changes`: Triggers modal to supply structured feedback (notes stored in `admin_notes`).
  - `Reject`: Closes application with formal notification.

---

## 5. Key UX & Technical Subsystems

### 1. WebGL 3D Geometry Viewer
Built with Three.js, utilizing custom ambient and directional lighting shaders tailored for CAD inspection:
- Normalizes bounding boxes automatically to keep models centered regardless of coordinate origin.
- Smooth orbit controls with inertia damping.
- Zero layout shift during mesh compilation.

### 2. Manual Two-Sided Trust Architecture
To prevent fraud and maintain print reliability, auto-approvals are strictly barred:
```
[User Submits Form]
         │
         ▼
[Status: 'pending'] ─── (Direct locked route access blocked)
         │
         ▼
[Admin Review Queue]
         │
   ┌─────┴─────────────────────────┐
   ▼                               ▼
[Request Changes]             [Approve]
   │                               │
   ▼                               ▼
[Status: 'changes_requested']   [Status: 'approved']
(User edits & resubmits)       (Unlocks Studio & Directory)
```

### 3. Isolated Payout Architecture
Bank and UPI credentials are never stored in application submission tables. They are isolated in `public.vendor_payout_details` with strict RLS policies ensuring only the account owner and authorized service-role workers can disburse funds.

### 4. Responsive Mobile Bottom Navigation
On mobile screens ($< 768\text{px}$), the interface transitions to an ergonomic native app style bottom tab bar (`NAV_ITEMS`) utilizing concise short labels (`Overview`, `Models`, `Orders`, `Jobs`, `Vendor`) ensuring one-thumb navigation.

---

## 6. Design Tokens, Typography & Aesthetics

DripLnk adheres to a strict dark-mode design system:

| Token | Value / Purpose | Visual Impact |
|---|---|---|
| `--canvas` | `#08090a` | Deep obsidian backdrop preventing eye fatigue |
| `--surface` | `#111315` | Elevated container backdrop for cards and sidebars |
| `--line` | `rgba(255, 255, 255, 0.08)` | Subtle hairline borders defining visual hierarchy |
| `--accent` | `#00e5ff` (Electric Cyan) | Primary interactive actions, trust badges, verified states |
| `--accent-2` | `#7c3aed` (Deep Violet) | Secondary creative badges, freelance tracks |
| Typography | Inter / Geist / Monospace | Precision technical aesthetic with monospaced data tables |

---

## 7. UX Assessment, Edge Cases Handled & Roadmap

### Edge Cases Handled
1. **Zero-Model Accounts:** Overview automatically swaps the zero-value stat counter with the actionable "Start with LeaFF OS" onboarding card.
2. **PostgREST Schema Mismatches:** Application actions feature automatic fallback handlers (`PGRST202` catch) to ensure smooth operation across migration rollouts.
3. **Over-the-Shoulder Privacy:** Bank account numbers and payment details are masked upon storage.
4. **Duplicate Spam Prevention:** Unique database constraints (`UNIQUE(user_id, type)`) prevent multiple concurrent applications.

### Recommended Next Horizons
1. **Transactional Email Triggers:** Connect `lib/email.ts` to status change hooks (`approved`, `changes_requested`) so applicants receive real-time inbox notifications.
2. **Desktop App Web Fallback:** Provide interactive browser fallback guidance when a user without LeaFF OS clicks `leaffos://` protocol links.
3. **GST Validation Integration:** Add real-time Indian GSTIN checksum verification prior to automated tax invoice generation.

---

*Authored for the DripLnk Engineering & Product Team · September 2026*
