# DripLnk Platform — Comprehensive Feature & Architecture Status

**Generated On:** September 12, 2026  
**Codebase:** `Subaru-tech/driplnkk-website`  
**Stack:** Next.js 16.3.1 (App Router) · React 19.2.8 · Tailwind CSS v4 · Three.js 0.185.1 · Clerk Authentication · Supabase (PostgreSQL + RLS + Storage)

---

## 1. Executive Summary & Core Architecture

DripLnk is an integrated 3D manufacturing, CAD marketplace, and freelance platform designed with a high-performance CAD/precision engineering visual language. The architecture is organized into three decoupled, secure layers:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             Next.js 16 App Router                                │
│  ┌───────────────────────┬─────────────────────────┬──────────────────────────┐  │
│  │   Public Marketing    │   Post-Login Dashboard  │   Seller & Admin Hubs    │  │
│  │ (/models, /mart, etc) │ (/dashboard, /library)  │ (/seller, /admin)        │  │
│  └───────────────────────┴─────────────────────────┴──────────────────────────┘  │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ Server Actions & Queries
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│              driplnk-web-backend (server-only Isolated Boundary)                │
│  ┌───────────────────────┬─────────────────────────┬──────────────────────────┐  │
│  │ Clerk Auth & Sessions │  DB Queries (Resilient) │ Server Actions (Upload,  │  │
│  │ (Shadow Sync Bridge)  │  (30+ Data Access Fns)  │ Mart, Freelance, Admin)  │  │
│  └───────────────────────┴─────────────────────────┴──────────────────────────┘  │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ RLS / Service-Role RPCs
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│                   Supabase PostgreSQL (Database & Storage Engine)                 │
│  ┌───────────────────────┬─────────────────────────┬──────────────────────────┐  │
│  │  28 Normalized Tables │ 15+ Security Definer    │  6 Encrypted / Public    │  │
│  │ (Models, Mart, Orgs)  │ RPCs (Strict Grants)    │  Storage Buckets         │  │
│  └───────────────────────┴─────────────────────────┴──────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Features Status

### 2.1 Public Marketing & Discovery Suite

| Feature / Page | Route | Key Components | Implementation Details | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Landing & Hero Experience** | `/` | `CinematicHero`, `IntroSequence`, `PrintCanvas`, `PillarCard`, `Ticker` | Interactive Three.js CAD wireframe animation, scroll-driven CSS timelines, dynamic CAD drafting brackets, layer wipe effects, and waitlist integration. | **Production Ready** |
| **3D Model Marketplace** | `/models` | `ModelsHeader`, `ModelsFilters`, `MarketplaceModelCard`, `ModelsPagination` | Faceted search, hierarchical category filtering (13 root categories + subcategories), license filtering (Standard, CC-BY, Commercial, Personal), price sorting, tag-based search, responsive card grid. | **Production Ready** |
| **Model Detail & Interactive 3D Viewer** | `/models/[id]` | `ModelDetailViewer`, `ModelViewer`, `ModelAcquirePanel`, `ModelFavoriteButton` | Three.js WebGL orbit viewer with wireframe toggle, auto-rotation, CAD dimensions, multi-format file kit preview (STL, STEP, 3MF, OBJ), image gallery carousel, instant free claim modal, social favorites toggle. | **Production Ready** |
| **Mart On-Demand 3D Printing** | `/mart` | `MartQuoteCalculator`, `PrintCanvas` | Real-time client-side STL geometry parser, tetrahedral volume divergence calculator, material densities (PLA, PETG, ABS, Resin, Nylon-CF), curved-surface factor multiplier, live multi-vendor pricing comparison, and direct order placement. | **Production Ready** |
| **Freelance CAD Designer Directory** | `/freelance` | `FreelanceBrowser` | Public browsing directory for vetted CAD engineers and 3D sculptors, search by name/bio, filter by skill tags (CAD, Slicing, Topology, Generative Design), hourly vs fixed rate filters. | **Production Ready** |
| **Freelancer Portfolio & Hire Modal** | `/freelance/[providerId]` | `FreelancerProfileView`, `HireModal` | Public designer profile, skills badge list, portfolio showcase, direct hiring modal with project brief input, agreed budget, and multi-file reference upload dropzone. | **Production Ready** |
| **Freelancer Onboarding Application** | `/freelance/apply` | `FreelanceApplyForm` | Multi-step designer onboarding: display name, portfolio links, skills tag selection, rate type selection, base rate, and immediate provider registration. | **Production Ready** |
| **Vendor Manufacturing Application** | `/vendor/apply` | `VendorApplyForm` | Onboarding application for 3D printing service providers: business details, factory location, material capabilities, capacity notes, and submission to admin review. | **Production Ready** |
| **LeaFF OS Product Showcase** | `/leaff-os` | `LeaffOsBridgeButton`, `AssetSlot` | Interactive OS presentation with custom protocol bridge buttons (`leaff://`), hardware acceleration highlights, feature grid, and download entry points. | **Production Ready** |
| **LeaFF CAD Companion App** | `/app` | `SectionHeading`, `AssetSlot`, `CtaBand` | Marketing page showcasing cloud syncing between browser, desktop suite, and mobile companions. | **Production Ready** |
| **Interactive Download Hub** | `/download` | `DownloadHub` | Dynamic OS detection (macOS Apple Silicon/Intel, Windows x64/ARM64, Linux .deb/.AppImage), version changelogs, SHA256 checksum verification copy buttons, architecture tabs, and installation documentation. | **Production Ready** |
| **Interactive Partner Portal** | `/partner` | `PartnerPortal` | Dynamic partner ecosystem stats, real-time revenue/commission tier calculator, partner program FAQ, and lead submission form. | **Production Ready** |
| **Company & Informational Pages** | `/about`, `/contact`, `/terms`, `/privacy` | `ContactForm`, `LegalPlaceholder` | Honest database-connected contact form (`contact_messages`), waitlist insertion (`waitlist`), and structured legal outlines. | **Production Ready** |

---

### 2.2 Authentication & User Onboarding

| Feature | Routes / Files | Implementation Details | Status |
| :--- | :--- | :--- | :--- |
| **Dual Authentication System** | `/login`, `/signup`, `/sign-in`, `/sign-up`, `/sso-callback` | Uses Clerk SDK (`useSignIn`, `useSignUp`) as primary auth provider with automatic fallback to native Supabase email/password auth. Supports Google OAuth and email verification codes. | **Production Ready** |
| **Role-Based Home Resolution** | `app/(auth)/actions.ts` (`resolveHome`) | Inspects user's authoritative `profiles.role` on the server and intelligently routes them: Creators to `/dashboard`, Sellers to `/seller`, Admins to `/admin`. | **Production Ready** |
| **Session Refresh & Proxy** | `proxy.ts` (Next.js 16 Proxy) | Intercepts requests, runs Clerk middleware authentication, and keeps Supabase session cookies synchronized in a single unified pipeline. | **Production Ready** |

---

### 2.3 Creator Dashboard (`/dashboard`)

| Feature | Route | Components | Implementation Details | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Creator Overview** | `/dashboard` | `DashboardShell`, `StatCard`, `BalanceCard`, `ModelCard`, `OrderRow` | Real-time stats: Credits balance, active models, active Mart orders, recent CAD uploads, quick-action shortcuts. | **Production Ready** |
| **My Models & Studio** | `/dashboard/models` | `CreatorUploadWizard`, `UploadModelButton`, `ModelsToolbar` | Comprehensive 3-step CAD wizard: STL/STEP dropzone upload, client-side Three.js mesh inspection, auto-bounding box & triangle count extraction, title, description, category, license selection, pricing, thumbnail generation, draft saving, and instant publishing. | **Production Ready** |
| **My Library** | `/dashboard/library` | `AcquiredModelCard`, `LibraryCard`, `ModelViewer` | Displays acquired models and purchased CAD assets. Integrated client download generation with secure entitlement checking, interactive Three.js 3D inspection modal, and re-order triggers. | **Production Ready** |
| **Mart Orders Tracking** | `/dashboard/mart-orders`, `/dashboard/mart-orders/[id]` | `OrderRow`, `OrderTimeline`, `BuyerMartOrderActions` | Comprehensive buyer manufacturing order tracker: multi-stage visual timeline (`placed` → `accepted` → `printing` → `shipped` → `delivered`), cancellation flow, order details with material and assigned vendor notes. | **Production Ready** |
| **Client Freelance Requests** | `/dashboard/freelance-requests` | `BuyerRequestsClient` | Client tracker for outsourced CAD projects: status pills, agreed quotes, reference files, direct download of deliverables delivered by the freelancer. | **Production Ready** |
| **Freelancer Designer Portal** | `/dashboard/freelancer` | `FreelancerJobsClient` | Designer workbench: profile management, incoming client requests, accept/reject controls, file delivery uploader, status advancement to `in_progress` and `delivered`. | **Production Ready** |
| **Vendor Manufacturing Portal** | `/dashboard/vendor` | `VendorOrderActions`, `BalanceCard` | 3D printing hub: active manufacturing queues, update production stage (`accepted`, `printing`, `shipped`), material pricing rules configuration per gram and minimum order price. | **Production Ready** |
| **Billing & Credits** | `/dashboard/billing` | `BalanceCard`, `CreditBuyModal`, `LedgerTable` | Credit balance breakdown, credit purchase modal with pre-set tiers, paginated credit ledger transaction history. | **UI Complete** *(Razorpay Gateway stubbed)* |
| **Account & Security Settings** | `/dashboard/account` | `ProfileSection`, `SessionsSection`, `DangerZone`, `SignOutButton` | Profile name and avatar editing, active session inspection with Clerk API revocation, account deletion cascade. | **Production Ready** |

---

### 2.4 Seller Storefront Suite (`/seller`)

| Feature | Route | Components | Implementation Details | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Seller Overview** | `/seller` | `StatCard`, `ListingRow`, `StartSelling` | Storefront earnings, total units sold, published listing counts, recent sales breakdown. | **Production Ready** |
| **Listing Management** | `/seller/listings`, `/seller/listings/[id]` | `ListingEditor`, `UploadListingButton` | Mart listing editor: title, price in INR, tags, description, model file upload, thumbnail replacement, publish flow. | **Production Ready** |
| **Sales Analytics** | `/seller/sales` | `Card`, `StatusPill` | Order-by-order sales log with gross revenue, platform cut, and net seller payout. | **Production Ready** |
| **Payouts Management** | `/seller/payouts` | `Card`, `EmptyState` | UPI payout tracking, pending balances, and disbursement history. | **Production Ready** |
| **Seller Profile** | `/seller/account` | `Card`, `Input` | Studio name, public bio, and UPI payment destination. | **Production Ready** |

---

### 2.5 Admin Control Center (`/admin`)

| Feature | Route | Components | Implementation Details | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Marketplace Review Queue** | `/admin/listings` | `ModelReviewActions`, `ListingReviewActions` | Guarded by `role === 'admin'`. Dual review tabs for 3D CAD Models and Mart Listings. Inspect CAD files, preview metadata, approve for marketplace publication, or reject with notes. | **Production Ready** |
| **Mart Order Fulfillment Control** | `/admin/mart-orders` | `OrderFulfillmentControl` | Filter orders by status (`placed`, `printing`, `shipped`, etc.), assign 3D printing vendors, attach vendor production notes, and force status updates. | **Production Ready** |

---

## 3. Backend Architecture & Features Status

The backend layer is fully encapsulated within `driplnk-web-backend/` and guarded with Next.js `server-only` to guarantee zero client bundle leakage.

### 3.1 Authentication & User Resolution (`driplnk-web-backend/auth/`)

- **`clerk.ts`**:
  - `getUnifiedUser()`: Unified user resolver that transparently normalizes Clerk user sessions and Supabase native JWT sessions into a single identity object.
  - `syncClerkProfile()`: Calls the `sync_clerk_user_profile` database RPC to ensure an internal `public.profiles` row and matching shadow `auth.users` UUID exist for foreign key integrity.
  - `getClerkUser()`, `deleteClerkUser()`: Backend REST management.
- **`sessions.ts`**:
  - `getUserSessions()`: Lists active browser devices/sessions via Clerk Backend API.
  - `revokeUserSession(sessionId)`: Revokes remote sessions.

---

### 3.2 Data Access Layer (`driplnk-web-backend/db/queries.ts`)

All database queries implement graceful fallback patterns (`backendReady: boolean` flag) so that unconfigured or cold environments render clean empty states rather than throwing runtime errors:

| Function | Area | Purpose |
| :--- | :--- | :--- |
| `getProfile()` | Auth / Account | Resolves user profile with credit balance and role. |
| `getModels()`, `getModelCount()` | Creator Studio | Fetches creator's own 3D CAD files with sorting and search. |
| `getCreatorStudioModels()` | Creator Studio | Fetches drafts, reviews, and published models for the creator dashboard. |
| `getMarketplaceModels()` | Marketplace | Executes high-performance catalog browsing RPC with facets, search, and pagination. |
| `getMarketplaceModelById()` | Marketplace | Retrieves single model detail with file kits, images, and licensing. |
| `isModelAcquired()`, `getUserAcquiredModels()` | Library | Entitlement queries for user's library and download authorizations. |
| `getMarketplaceCategoryCounts()`, `getCategoriesHierarchy()` | Categories | Dynamic category counters and hierarchical parent-child trees. |
| `getLicensesList()` | Licensing | Fetches marketplace license definitions and terms. |
| `getModelVersions()`, `getModelFiles()` | File Management | Fetches multi-format files (.stl, .step, etc.) and version history. |
| `isModelFavorited()` | Wishlist | Social proof / bookmark check. |
| `getMartOrders()`, `getMartOrder()` | Mart | Customer 3D print orders with tracking status. |
| `getVendorOrders()` | Vendor | Manufacturing orders routed to printing vendors. |
| `getFreelanceBrowseProfiles()`, `getFreelancerProfileById()` | Freelance | Public talent search and detailed designer profile query. |
| `getMyFreelanceProvider()`, `getBuyerFreelanceRequests()`, `getFreelancerIncomingRequests()` | Freelance | Lifecycle queries for buyer-designer project workflows. |
| `getSellerProfile()`, `getListings()`, `getSales()`, `getPayouts()` | Seller | Storefront stats, listings, and financial ledger. |
| `getAdminPendingListings()`, `getAdminPendingModels()`, `getAdminMartOrders()` | Admin | Moderation and fulfillment management queries. |
| `getLedgerPage()` | Billing | Paginated credit ledger queries. |

---

### 3.3 Server Actions Layer (`driplnk-web-backend/actions/`)

All actions run exclusively on the server with caller verification, parameter sanitization, and database transactions:

| Action File | Exported Functions | Description |
| :--- | :--- | :--- |
| **`upload.ts`** | `getUploadSession`<br>`recordUploadedModel`<br>`publishCreatorModelListing`<br>`saveModelDraft`<br>`updateModelThumbnail`<br>`recordUploadedListing`<br>`deleteUploadedModel` | Manages direct storage upload grants, model record creation, automated v1.0.0 version creation, multi-format file kit mapping, thumbnail updating, and draft/publishing lifecycles. |
| **`library.ts`** | `claimFreeModel`<br>`claimFreeListing`<br>`getModelDownloadUrl`<br>`toggleModelFavoriteAction` | Handles zero-cost acquisitions, atomic library insertion, secure signed URL generation with database entitlement verification, and favorite toggling. |
| **`mart.ts`** | `calculateMeshQuotes`<br>`createMartOrderAction` | Server-side binary/ASCII STL volume verification, material mass calculation, vendor pricing match, and atomic print order creation. |
| **`freelance.ts`** | `applyFreelancer`<br>`submitFreelanceRequest`<br>`respondToFreelanceRequest`<br>`getFreelanceFileDownloadUrl` | Registers freelancer provider rows, creates client hire requests with reference files, handles status progression (`accepted`, `in_progress`, `delivered`, `completed`), and grants signed download URLs for deliverables. |
| **`vendor.ts`** | `applyVendor`<br>`getMyVendorProvider`<br>`respondToMartOrderAction` | Registers 3D printing vendors with default material rules, and enables vendor stage progression (`printing`, `shipped`). |
| **`admin.ts`** | `updateModelStatusAdmin`<br>`updateListingStatusAdmin`<br>`updateMartOrderAdmin` | Admin review actions to approve/reject models, and assign vendors or update stages for Mart orders. |
| **`account.ts`** | `updateUserProfile`<br>`deleteUserAccount` | Modifies user profiles and performs cascading deletion of user data and Clerk accounts. |
| **`seller.ts`** | `becomeSeller` | Upgrades a creator account to a seller storefront. |

---

### 3.4 3D Mesh Engine & Geometry Utility (`mesh-calc.ts`)

- **Tetrahedral Divergence Slicing Engine**: Computes exact signed volume of STL meshes using the divergence theorem:
  $$V = \frac{1}{6} \sum \mathbf{v}_1 \cdot (\mathbf{v}_2 \times \mathbf{v}_3)$$
- **Format Support**: Handles both binary and ASCII STL formats.
- **Physical Plausibility & Manifold Checking**: Detects inverted normals, non-manifold boundaries, and confirms volume is within bounding box limits ($V \le V_{bbox} \times 1.05$).
- **Material Mass Densities**:
  - PLA: $1.24\text{ g/cm}^3$
  - PETG: $1.27\text{ g/cm}^3$
  - ABS: $1.05\text{ g/cm}^3$
  - Resin: $1.18\text{ g/cm}^3$
  - Nylon-CF: $1.15\text{ g/cm}^3$
- **Curved Surface & Geometry Multipliers**: Computes bounding box dimensions ($\Delta x, \Delta y, \Delta z$) and surface complexity metrics to output accurate real-world print pricing.

---

## 4. Database Structure & Schema

The database runs on PostgreSQL (Supabase) and is governed by 6 incremental, idempotent migrations in `supabase/migrations/`:

### 4.1 Complete Tables Catalog (28 Tables)

```
                                  [auth.users] (Supabase / Shadow Users)
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
                  [public.profiles]            [public.providers]
                   (User Accounts)           (Vendors / Freelancers)
                         │                             │
        ┌────────────────┼───────────────┐             ├──────────────────────────┐
        ▼                ▼               ▼             ▼                          ▼
  [public.models] [model_acquisitions] [credit_ledger] [freelancer_profiles] [vendor_profiles]
        │                                              │                          │
   ┌────┴──────────────────────────┐                   ▼                          ▼
   ▼                               ▼           [freelance_requests]    [vendor_pricing_rules]
[model_files]              [model_versions]                                       │
   │                               │                                              ▼
   ▼                               ▼                                       [quote_requests]
[model_images]              [model_tags]                                          │
   │                               │                                              ▼
   ▼                               ▼                                       [mart_orders]
[categories]                  [licenses]
```

#### Detailed Table Specifications:

| Table Name | Primary Key | Foreign Keys | Key Columns | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`profiles`** | `id` (UUID) | None | `clerk_id`, `full_name`, `avatar_url`, `role` (`creator`, `seller`, `admin`), `credits_balance` | Primary user identity records, synchronized with Clerk. |
| **`categories`** | `id` (UUID) | `parent_id` → `categories(id)` | `name`, `slug` (unique), `description`, `icon`, `sort_order` | Hierarchical 3D model taxonomy (Mechanical, Robotics, Electronics, etc.). |
| **`licenses`** | `id` (UUID) | None | `name`, `slug` (unique), `description`, `allows_commercial`, `allows_remix`, `requires_attribution` | First-class marketplace 3D model licensing definitions. |
| **`tags`** | `id` (UUID) | None | `name` (unique), `slug` (unique) | Normalized tags for model categorization. |
| **`model_tags`** | `id` (UUID) | `model_id` → `models(id)`<br>`tag_id` → `tags(id)` | Unique `(model_id, tag_id)` pair | Many-to-many model tag relationships. |
| **`models`** | `id` (UUID) | `owner_id` → `profiles(id)`<br>`seller_user_id` → `profiles(id)`<br>`category_id` → `categories(id)`<br>`license_id` → `licenses(id)` | `title`, `slug` (unique), `description`, `price`, `status` (`draft`, `pending_review`, `published`, `rejected`, `archived`), `visibility`, `thumbnail_url`, `preview_image_paths`, `file_path`, `storage_path`, `published_at` | Primary 3D model entity for studio and marketplace. |
| **`model_versions`**| `id` (UUID) | `model_id` → `models(id)`<br>`created_by` → `profiles(id)` | `version_number` (e.g. `v1.0.0`), `changelog`, `is_current` | Version history tracking for CAD revisions. |
| **`model_files`** | `id` (UUID) | `model_id` → `models(id)`<br>`version_id` → `model_versions(id)` | `filename`, `storage_path`, `format` (`stl`, `step`, `stp`, `3mf`, `obj`, `zip`, `pdf`), `file_size`, `is_primary`, `is_downloadable`, `metadata` (JSONB) | Multi-format CAD package files for each model. |
| **`model_images`** | `id` (UUID) | `model_id` → `models(id)` | `storage_path`, `thumbnail_url`, `alt_text`, `sort_order`, `is_cover` | Multi-image visual gallery and renders. |
| **`model_favorites`**| `id` (UUID) | `user_id` → `profiles(id)`<br>`model_id` → `models(id)` | Unique `(user_id, model_id)` pair | Social bookmarks and wishlist tracking. |
| **`model_events`** | `id` (UUID) | `model_id` → `models(id)`<br>`user_id` → `profiles(id)` | `event_type` (`view`, `download`, `acquired`, `favorite`), `metadata` (JSONB) | Telemetry and platform analytics. |
| **`model_acquisitions`** | `id` (UUID) | `user_id` → `profiles(id)`<br>`model_id` → `models(id)`<br>`order_id` → `mart_orders(id)` | `license_type`, `price_paid`, `currency`, `status` (`active`, `revoked`), `acquired_at` | Library entitlement record authorizing CAD downloads. |
| **`providers`** | `id` (UUID) | `user_id` → `auth.users(id)` | `type` (`vendor`, `seller`, `freelancer`), `status` (`pending`, `approved`, `rejected`) | Shared polymorphic identity for service providers. |
| **`freelancer_profiles`** | `provider_id` (UUID) | `provider_id` → `providers(id)` | `display_name`, `bio`, `skills` (text[]), `portfolio_urls` (text[]), `rate_type` (`hourly`, `fixed`), `base_rate` | Public and dashboard freelancer details. |
| **`freelance_requests`** | `id` (UUID) | `buyer_user_id` → `auth.users(id)`<br>`freelancer_provider_id` → `providers(id)` | `brief`, `reference_file_paths` (text[]), `agreed_price`, `status` (`requested`, `accepted`, `in_progress`, `delivered`, `completed`, `cancelled`), `final_file_path` | CAD hiring contract and delivery lifecycle. |
| **`vendor_profiles`** | `provider_id` (UUID) | `provider_id` → `providers(id)` | `business_name`, `location`, `materials_supported` (text[]), `capacity_notes` | 3D printing manufacturing shop profile. |
| **`vendor_pricing_rules`** | `id` (UUID) | `provider_id` → `providers(id)` | `material`, `price_per_gram`, `min_order_price`, `active` | Proprietary manufacturing pricing algorithms (never publicly readable). |
| **`quote_requests`** | `id` (UUID) | `user_id` → `auth.users(id)` | `file_path`, `material`, `weight_g`, `status` (`pending`, `weighed`, `failed`) | Uploaded STL geometry submitted for slicing quote. |
| **`mart_orders`** | `id` (UUID) | `quote_request_id` → `quote_requests(id)`<br>`buyer_user_id` → `auth.users(id)`<br>`provider_id` → `providers(id)` | `price`, `material`, `status` (`placed`, `accepted`, `printing`, `shipped`, `delivered`, `completed`, `cancelled`), `assigned_vendor`, `vendor_notes` | Physical 3D printing manufacturing orders. |
| **`seller_profiles`** | `id` (UUID) | `user_id` → `profiles(id)` | `studio_name`, `bio`, `payout_upi_id` | Seller storefront settings and payout info. |
| **`listings`** | `id` (UUID) | `seller_id` → `seller_profiles(id)` | `title`, `slug`, `description`, `price_inr`, `status` (`draft`, `pending_approval`, `published`, `rejected`), `thumbnail_url`, `file_path` | Legacy Mart product listing table. |
| **`sales`** | `id` (UUID) | `listing_id` → `listings(id)`<br>`seller_id` → `seller_profiles(id)`<br>`buyer_id` → `profiles(id)`<br>`order_id` → `mart_orders(id)` | `amount_inr`, `net_seller_inr` | Seller marketplace transaction logs. |
| **`payouts`** | `id` (UUID) | `seller_id` → `seller_profiles(id)` | `amount_inr`, `status` (`pending`, `processed`, `failed`), `destination_upi` | Financial disbursement logs for sellers. |
| **`library_items`**| `id` (UUID) | `user_id` → `profiles(id)`<br>`listing_id` → `listings(id)` | `purchased_at` | Legacy library ownership table. |
| **`credit_ledger`**| `id` (UUID) | `user_id` → `profiles(id)` | `amount`, `balance_after`, `description`, `reference_type` | Immutable accounting ledger for user credits. |
| **`waitlist`** | `id` (UUID) | None | `email` (unique) | Landing page newsletter / early access waitlist. |
| **`contact_messages`** | `id` (UUID) | None | `name`, `email`, `message` | Contact form inquiries from marketing pages. |

---

### 4.2 Stored Procedures & Functions (RPCs)

All stored procedures are defined with `SECURITY DEFINER`, strict `search_path = public, auth, pg_temp`, and have execution privileges revoked from `public`/`anon`/`authenticated` where data mutation or authorization is involved:

| RPC Function | Access Control | Responsibility |
| :--- | :--- | :--- |
| `get_marketplace_models(...)` | `anon`, `authenticated`, `service_role` | High-performance full-text and faceted search for published 3D models with pagination. |
| `get_marketplace_model_by_id(uuid)` | `anon`, `authenticated`, `service_role` | Detailed model lookup joining files, gallery images, and licensing. |
| `get_freelance_browse_profiles(...)` | `anon`, `authenticated`, `service_role` | Public directory browsing of approved freelance CAD engineers. |
| `get_freelancer_profile_by_id(uuid)` | `anon`, `authenticated`, `service_role` | Public portfolio retrieval for a specific designer. |
| `get_mart_vendor_quotes(...)` | `anon`, `authenticated`, `service_role` | Calculates dynamic manufacturing quotes from active vendor pricing rules. |
| `sync_clerk_user_profile(...)` | `service_role` strictly | Synchronizes Clerk identities into `profiles` and shadow `auth.users`. |
| `claim_model_acquisition(uuid, uuid)` | `service_role` strictly | Atomically acquires free 3D models and registers library ownership. |
| `can_user_access_model_file(uuid, uuid, uuid)`| `service_role` strictly | Verifies whether a user is the author or holds an active acquisition for a CAD file download. |
| `get_user_model_acquisitions(uuid)` | `service_role` strictly | Returns complete list of models in a user's library with multi-format downloads. |
| `toggle_model_favorite(uuid, uuid)` | `service_role` strictly | Toggles model bookmark and records analytics event. |
| `create_mart_order(...)` | `service_role` strictly | Validates quote and initializes customer print manufacturing order. |
| `respond_to_mart_order(...)` | `service_role` strictly | Vendor and buyer state transitions for manufacturing orders. |
| `register_freelancer_profile(...)` | `service_role` strictly | Atomic provider and freelancer profile setup. |
| `create_freelance_request(...)` | `service_role` strictly | Inserts client brief and associates reference documents. |
| `respond_to_freelance_request(...)` | `service_role` strictly | Handles quote acceptance, delivery upload, and milestone completion. |
| `admin_get_mart_orders(text)` | `service_role` strictly | Admin aggregation of all manufacturing orders with buyer details. |
| `admin_update_mart_order(...)` | `service_role` strictly | Admin vendor assignment and manufacturing order override. |
| `admin_review_model(uuid, text, text)` | `service_role` strictly | Approves or rejects submitted CAD models for the public marketplace. |
| `admin_get_pending_models()` | `service_role` strictly | Admin queue of models waiting for review. |
| `can_upload_to_storage_folder(text)` | `anon`, `authenticated`, `service_role` | Validates caller permissions against storage folder prefixes. |
| `become_seller(text)` | `authenticated`, `service_role` | Onboards creator to a seller profile. |

---

### 4.3 Supabase Storage Buckets

| Bucket Name | Privacy | Allowed MIME / Formats | Access Policy & Flow |
| :--- | :--- | :--- | :--- |
| **`models`** | Private | `.stl`, `.step`, `.stp`, `.3mf`, `.obj`, `.zip`, `.pdf`, `.png`, `.jpg` | Author can upload into folder `{user_id}/*`. Downloads require signed URLs authorized by `can_user_access_model_file`. |
| **`listings`** | Private | `.stl`, `.step`, `.3mf`, `.zip`, `.png`, `.jpg` | Mart seller CAD files and listing thumbnails. |
| **`avatars`** | Public | Images (`.png`, `.jpg`, `.webp`) | Publicly readable; authenticated user can upload their own profile avatar. |
| **`freelance-references`** | Private | All document & 3D formats | Uploaded by clients during project creation. Readable only by client and hired freelancer. |
| **`freelance-deliverables`**| Private | CAD models, renders, ZIPs | Uploaded by freelancer upon project completion. Readable only by client and freelancer. |
| **`mart-quotes`** | Private | `.stl`, `.step`, `.3mf` | Uploaded during the Mart quote estimation process for volumetric slicing. |

---

## 5. Overall Feature Completeness Matrix

| Domain | Feature | Frontend Status | Backend Status | Database Status | Overall Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Identity** | Clerk + Supabase Auth | Complete | Complete | Complete | **100% Operational** |
| **Identity** | Multi-Role Routing (Creator / Seller / Admin) | Complete | Complete | Complete | **100% Operational** |
| **Marketplace** | 3D Models Catalog & Search | Complete | Complete | Complete | **100% Operational** |
| **Marketplace** | Model Detail & Three.js 3D Viewer | Complete | Complete | Complete | **100% Operational** |
| **Marketplace** | Free Claim & Entitled Downloads | Complete | Complete | Complete | **100% Operational** |
| **Marketplace** | Multi-File Kits (STL, STEP, 3MF, etc.) | Complete | Complete | Complete | **100% Operational** |
| **Marketplace** | Model Favorites / Wishlist | Complete | Complete | Complete | **100% Operational** |
| **Studio** | Creator 3-Step CAD Upload Wizard | Complete | Complete | Complete | **100% Operational** |
| **Studio** | CAD Drafts & Marketplace Publishing | Complete | Complete | Complete | **100% Operational** |
| **My Library** | Library Model Management & Inspection | Complete | Complete | Complete | **100% Operational** |
| **Manufacturing** | Mart On-Demand Print Quoting | Complete | Complete | Complete | **100% Operational** |
| **Manufacturing** | 3D Mesh Slicing & Density Math | Complete | Complete | Complete | **100% Operational** |
| **Manufacturing** | Print Order Tracking & Timeline | Complete | Complete | Complete | **100% Operational** |
| **Manufacturing** | Vendor Manufacturing Portal | Complete | Complete | Complete | **100% Operational** |
| **Freelance** | CAD Designer Directory & Portfolio | Complete | Complete | Complete | **100% Operational** |
| **Freelance** | Client Hire Flow & Deliverables Tracker | Complete | Complete | Complete | **100% Operational** |
| **Freelance** | Freelancer Project Management Portal | Complete | Complete | Complete | **100% Operational** |
| **Seller** | Storefront & Listings Management | Complete | Complete | Complete | **100% Operational** |
| **Seller** | Sales Analytics & UPI Payouts UI | Complete | Complete | Complete | **100% Operational** |
| **Admin** | Marketplace Review & Moderation Queue | Complete | Complete | Complete | **100% Operational** |
| **Admin** | Mart Orders Vendor Dispatcher | Complete | Complete | Complete | **100% Operational** |
| **Marketing** | Interactive Download Hub (LeaFF OS) | Complete | Complete | Complete | **100% Operational** |
| **Marketing** | Interactive Partner Portal | Complete | Complete | Complete | **100% Operational** |
| **Monetization** | Razorpay / Stripe Payment Checkout | UI Modal Ready | Stubbed Action | Schema Ready | **Pending Gateway Setup** |

---

## 6. Environment & Configuration Checklist

To run the complete platform locally or in production, configure the following keys in `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG... # Strictly server-only

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_... # Strictly server-only

# Optional Payment Gateway (Pending Integration)
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

---

## 7. Immediate Next Steps / Roadmap

1. **Payment Gateway Integration (Primary Blocker for Full Launch)**:
   - Connect Razorpay / Stripe to the escrow state machine (`order_payments`, `transition_order_payment_state`) and checkout routes for paid CAD model purchases, wallet reloads, and Mart print orders.
2. **Automated 3D Render & Preview Worker (Specification & Security Invariants)**:
   - Add a background worker / Supabase Edge Function to render isometric PNG previews of uploaded `.step`, `.stl`, and `.3mf` files.
   - **MANDATORY SECURITY INVARIANTS FOR 3MF ARCHIVE DECOMPRESSION**:
     - **Zip-Slip Traversal Prevention**: Inspect every entry header (`entry.name`) before decompression; strictly reject any archive containing `../`, absolute paths, null bytes, or paths resolving outside the isolated scratch directory.
     - **Zip-Bomb DoS Prevention**: Enforce strict extraction ceilings before decompressing:
       - Max total uncompressed payload: 100 MB.
       - Max compression ratio ceiling: $10:1$ (reject if `uncompressed_size / compressed_size > 10`).
       - Max total archive entry count: 250 entries.
     - **Allowlist-Only Target Extraction**: Never extract arbitrary files. Only decompress recognized 3MF OPC targets: `[Content_Types].xml`, `_rels/.rels`, and `3D/3dmodel.model`. Discard all auxiliary files and executable scripts.
3. **Out-of-Band Vendor Dispatch Credentials**:
   - Provision live Gupshup or Interakt credentials to activate the WhatsApp/SMS fallback pipeline in `vendor-order-notification`.
4. **ClamAV Live Daemon Provisioning**:
   - Supply `CLAMAV_HOST` and `CLAMAV_PORT` to connect the already-deployed `model-virus-scanner` Edge Function to a live ClamAV cluster.
