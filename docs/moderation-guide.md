# DripLnk Content Moderation Guide

This guide defines standard operating procedures for reviewing content flagged in the **Admin Moderation Queue** (`/admin/listings`).

---

## 1. Safety & Legal Posture

Under India's **Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021** and international export control regimes (including ITAR/EAR Category I), DripLnk prohibits the upload, distribution, and manufacturing of 3D printable firearms, firearm components, and conversion devices.

Our automated moderation pipeline enforces a **flag-not-reject** first-pass filter on model metadata (titles, descriptions, tags) and an **exact-match SHA-256 duplicate rejection** on uploaded CAD files. Models flagged by the blocklist are held in `weapon_review` and will not be published to `/models` or sent to Mart vendors until an administrator reviews them.

---

## 2. Moderation Queue Statuses

| Status | Trigger | Description | Action Required |
|---|---|---|---|
| `weapon_review` | Automated Keyword Blocklist | Title, description, or tags matched terms on `lib/weapon-blocklist.ts`. | Inspect CAD preview and metadata. Confirm if item is a prohibited weapon component or an innocent false positive (e.g. camera trigger, cylindrical container). |
| `report_review` | User / Community Report | A user submitted a "Report this design" notice citing stolen design, copyright infringement, weapon part, or counterfeit. | Verify evidence link (Printables, Thingiverse, original creator portfolio) and description. |
| `duplicate_review` | Perceptual Visual Similarity | 64-dim DCT perceptual hash matched existing catalog models above similarity threshold. | Compare render preview with flagged existing model. |
| `cleared` | Admin Cleared | An admin determined the model is compliant. | None. Model proceeds to standard catalog status. |

---

## 3. Decision Procedures

### Case A: Weapon / Firearm Part Review (`weapon_review`)

1. **Check the matched terms** shown in the admin queue (e.g. `receiver`, `sear`, `suppressor`).
2. **Examine the 3D model geometry**:
   - **Prohibited**:
     - Functional receivers, frames, lower/upper receivers (e.g. AR-15, Glock, P80).
     - Internal firing/action mechanisms (auto sears, drop-in auto sears, disconnectors, giggle switches, forced reset triggers).
     - Suppressors, silencers, baffles, solvent trap adapters.
     - Magazine bodies or high-capacity drum assemblies intended for lethal firearms.
     - Ammunition dies, bullet molds, or improvised firearm files (e.g. FGC-9, pipe guns).
   - **Permitted (False Positives)**:
     - Camera triggers, cable triggers, switch brackets for electronics.
     - Cylindrical storage containers, wine barrels, decorative barrels.
     - Nerf / Airsoft cosmetic shells clearly marked and non-convertible to live ammunition.
     - Sci-Fi / Fantasy cosplay props with solid (non-functional) barrels and no mechanical action.
3. **Take Action**:
   - **Compliant**: Click **Clear**. The model is cleared for standard marketplace review or publication.
   - **Violation**: Click **Unpublish**. Enter a reason (e.g. *"Violates platform firearm safety policy — functional receiver geometry"*). The model will be archived and blocked from marketplace listing and Mart printing.

### Case B: Stolen Design / Copyright Infringement (`report_review`)

1. **Inspect the evidence URL** provided in the report.
2. Verify timestamp of the external upload vs. the DripLnk listing.
3. Check the original creator's license (e.g. CC-BY-NC forbids commercial resale).
4. **Resolution SLA**: Complete investigation and take action within **72 hours** of report receipt.
5. **Take Action**:
   - If genuine infringement: Click **Unpublish**. Enter resolution notes with reference to original source.
   - If frivolous or unverified: Click **Clear** (or dismiss report).

---

## 4. Response & SLA Guidelines

- **Firearm / Explosive / Safety reports**: Review within **24 hours**.
- **Copyright & Stolen design reports**: Review within **72 hours**.
- **Repeat Infringers**: Creators with 2 or more confirmed copyright or weapon violations are subject to account suspension under Section 7 of the Terms of Service.

---

## 5. Visual Similarity & pgvector Tuning

Perceptual image hashes are stored as 64-dimensional float vectors (`models.preview_phash`). 
- Default cosine similarity match threshold: `0.85` (cosine distance `< 0.15`).
- Visual hashing flags potential duplicate renders for human inspection; it does **not** auto-delete models.
- Review false-positive rates after first 100 uploads to recalibrate threshold if necessary.

---

## 6. Known Scope & Moderation Coverage Boundaries

1. **Mart Instant Quoter (Direct-Print Pathway)**:
   - Evaluates file path and metadata server-side on both the application action and database RPC layers.
   - Any order matching regulated firearm or weapon terms is held in `pending_moderation` (`weapon_review`).
   - Notification triggers suppress vendor dispatch entirely until an administrator explicitly clears the order.

2. **Marketplace Catalog Listings**:
   - Creator listings are scanned on publish and held in `pending_review` (`weapon_review`) if flagged.

3. **Freelance Custom CAD Deliverables (Known Boundary)**:
   - Deliverables commissioned through the Freelance workspace represent private design consultations between an independent designer and a commissioning client.
   - Unlike the Mart pathway (which automatically dispatches physical manufacturing instructions to external vendors and starts SLA clocks), freelance file exchanges do not trigger automated physical manufacturing.
   - Content moderation for freelance work is currently enforced through the user reporting flow (`report_review`) and community guidelines rather than automated upload gates.
