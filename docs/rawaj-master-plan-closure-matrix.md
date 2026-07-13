# RAWAJ Master Execution Phases — Closure Matrix

Baseline: `7c451222605c79f4453a5bdede2efc7fb0608301`  
Captured: 2026-07-13  
Scope: repository truth only. Production-only dependencies remain explicitly separate.

## Status definitions

- **Closed** — implemented on `main` and protected by permanent regression coverage or a proven governed contract.
- **Closed with Production dependency** — repository implementation is complete, but one or more source-controlled migrations still require explicit Production verification/application.
- **Partially closed** — substantial implementation exists, but the original phase included broader capabilities that are not fully present.
- **Not closed** — no sufficient implementation evidence exists on current `main`.

## Phase-by-phase closure

### Phase 1 — Database Integrity & Migration Truth

**Status: Closed**

Evidence:
- PR #210 established the canonical migration ledger and collision prevention.
- PR #211 extracted and reconciled Production schema truth.
- PR #300 corrected the remaining ledger inconsistency by moving the obsolete UUID classifieds foundation to `superseded`.
- Permanent migration-ledger validation runs in Quality Gate.

Production note:
- Repository migration presence is not treated as proof of Production application.
- No historical migration should be replayed or renamed based on filename alone.

### Phase 2 — Critical Data-Loss & URL Correctness Fixes

**Status: Closed**

Evidence:
- Edit listing hydration preserves `subcategoryId` from the persisted listing.
- Subcategory clearing occurs only when category changes intentionally.
- Invalid taxonomy/filter states are guarded by the existing listings filter and taxonomy contracts.
- Permanent listing-system and listings-filter regressions pass in Quality Gate.

### Phase 3 — Listings Pagination & Result Scalability

**Status: Closed**

Evidence:
- Public listing reads use stable cursor pagination and deterministic ordering.
- Result continuation is represented by `nextCursor` rather than a fixed `.limit(60)` ceiling.
- Search/filter URL state and result loading remain protected by Search & Filters V1/V2 and listing-system contracts.

### Phase 4 — Canonical Deep Taxonomy Write Path

**Status: Closed with Production dependency**

Evidence:
- PR #301 added `listing_taxonomy_assignments`.
- Added deterministic legacy backfill and synchronization from `category_id/subcategory_id`.
- Added governed owner RPC for explicit active-leaf assignment.
- Preserved all legacy category/subcategory fields, URLs, filters, and compatibility reads.

Production dependency:
- `202607130001_canonical_listing_taxonomy_assignments.sql` must be explicitly reviewed and applied/verified in Supabase Production.

### Phase 5 — Add Listing Taxonomy & Data Architecture

**Status: Closed with Production dependency**

Evidence:
- PR #302 added arbitrary-depth taxonomy drill-down to Listing Studio.
- Final leaf selection resolves inherited legacy category/subcategory compatibility.
- Autosave and final draft creation preserve `_taxonomy_node_id` as a rollout-safe fallback.
- Canonical assignment uses the governed Phase 4 RPC when available.
- Quality Gate and Browser Smoke passed before merge.

Production dependency:
- Canonical relation becomes authoritative after the Phase 4 migration is applied.

### Phase 6 — Edit Listing Preservation & Taxonomy Compatibility

**Status: Closed with Production dependency**

Evidence:
- PR #303 reads canonical taxonomy assignment for owners.
- Falls back to `_taxonomy_node_id` for rollout and legacy continuity.
- Uses the same deep taxonomy selector as Add Listing.
- Preserves the selected leaf through save and resubmit.
- Existing legacy category/subcategory editing remains available when canonical taxonomy data is unavailable.
- Quality Gate and Browser Smoke passed before merge.

Production dependency:
- Canonical read/write requires the Phase 4 migration on Production.

### Phase 7 — Moderation Integrity & Review Versioning

**Status: Closed**

Evidence:
- Governed moderation lifecycle and stale-safe review contracts were implemented across earlier reconciliation migrations and listing moderation RPCs.
- Current-main admin security and permission-separation regression gate added in PR #249.
- Listing moderation, report moderation, verification moderation, promotion moderation, stale guards, and audit logging are covered by permanent contracts.
- Pending-review listings remain non-editable in owner surfaces.

### Phase 8 — Search Engine & Arabic Normalization

**Status: Partially closed**

Implemented:
- Search & Filters V1/V2.
- URL-backed search, recent queries, keyboard focus, query clearing, category/location/contextual filtering.
- Current search contracts pass.

Remaining original-scope gap:
- No repository evidence proves a complete Arabic linguistic normalization engine covering hamza/alef folding, diacritics, tatweel, aliases, typo tolerance, and a dedicated FTS/trigram relevance layer across all listing search fields.

Conclusion:
- Search UX and filter correctness are closed.
- The full advanced Arabic retrieval engine from the original phase is not fully closed.

### Phase 9 — Filters & Saved Search Correctness

**Status: Closed**

Evidence:
- PR #257 introduced URL-backed search/filter state and apply/dismiss semantics for mobile filter sheets.
- PR #266 strengthened recovery, recent queries, safe-area behavior, and narrow-device density.
- Saved searches and alerts are governed by existing APIs and notification delivery contracts.
- Search & Filters V1/V2, listings filters, and saved-search alert contracts pass permanently.

### Phase 10 — Favorites, Messaging & Notifications Correctness

**Status: Closed**

Evidence:
- Atomic favorite mutations are governed through `202607100001_atomic_favorite_mutations.sql`.
- Conversation block/report idempotency and bypass prevention migrations are present and governed.
- Communication Center V2 implemented in PR #263.
- Notifications reliability repaired in PR #279.
- Activity center implemented in PR #206.
- Permanent favorites, chat workspace, communication center, notification, and listing-system regressions pass.

### Phase 11 — Add Listing Resilience & Image Pipeline

**Status: Closed for current product contract**

Evidence:
- Autosave, stale cleanup, draft continuity, six-image cap, duplicate filtering, per-image upload states, retry, removal, ordering, and object URL cleanup exist.
- PR #205 closed Add/Edit image parity and failed-upload retention.
- PR #272 added persistent image ordering.
- Listing Studio V2/V3 and listing-studio image parity contracts pass.

Original-scope limitation:
- The repository does not prove a full server-side responsive-variant/thumbnail generation pipeline or EXIF transformation service. Current product contract relies on the existing validated upload path.

### Phase 12 — Syria Location Architecture

**Status: Closed**

Evidence:
- Canonical Syria location taxonomy foundation, compatibility, hardening, backfill, aliases, and search-region migrations are present.
- CanonicalLocationSelector is used in listing creation/editing.
- Legacy governorate/district compatibility remains supported.
- Location classification and presentation contracts pass permanently.

### Phase 13 — Performance & Data Fetch Architecture

**Status: Closed for launch scope**

Evidence:
- Home SSR: PR #241.
- Offers SSR: PR #243.
- Public reference request deduplication and primary-image signing reduction: PR #275.
- Dynamic sitemap pagination and bounded discovery: PR #244.
- Public column allowlists and removal of wildcard public reads: PR #239.
- Production build and Browser Smoke pass on current main.

### Phase 14 — Code Architecture & Regression Safety

**Status: Closed for current architecture**

Evidence:
- API modules are split under `src/lib/api/*` with compatibility exports through `classifieds-api.ts`.
- Shared taxonomy, location, listing lifecycle, image, messaging, verification, promotion, admin, and security modules exist.
- Permanent Quality Gate runs migration checks, lint, domain contracts, typecheck, listing-system regression, and production build.
- Browser Smoke covers public and signed-out critical journeys.
- Production Acceptance infrastructure exists for authenticated read-only journeys.

### Phase 15 — Security, Privacy & Storage Hardening

**Status: Closed with operational dependencies**

Evidence:
- Public data allowlists and JSON-LD escaping: PR #239.
- Security headers, CSP, HSTS, framing and cache hardening: PR #276.
- Admin permission regression gate: PR #249.
- Private verification documents: PR #209.
- Android cleartext/backup/deep-link hardening: PR #280.
- Signing secret protection: PR #286.
- Storage paths and media contracts are owner-scoped and regression protected.

Operational dependencies:
- Source-controlled storage/schema migrations must still be verified as applied in Production where noted in their PRs.
- Dashboard-only Auth configuration remains outside repository proof.

### Phase 16 — SEO Foundation

**Status: Closed**

Evidence:
- Production-safe canonical base and robots/sitemap foundation: PR #207.
- Dynamic listing/seller sitemap: PR #244.
- Indexable category and governorate landing pages: PR #281.
- Social metadata and private-route noindex rules: PR #278.
- Production launch smoke checks robots, sitemap, public, legal, support, discovery, and not-found routes: PR #282.
- SEO discovery contracts pass permanently.

### Phase 17 — Semantic SEO & AI Discoverability

**Status: Partially closed**

Implemented:
- Organization, WebSite, SearchAction, BreadcrumbList, listing offer availability, canonical links, and safe JSON-LD serialization.
- Semantic SEO contract passes.

Remaining original-scope gap:
- Listing structured data is intentionally conservative. The repository does not yet provide complete type-specific schema for every listing family such as vehicles, real estate, jobs, and services.
- Semantic taxonomy URLs exist for category/governorate landing pages, but arbitrary deep taxonomy landing pages are not yet proven indexable.

### Phase 18 — Mobile UX Hardening

**Status: Closed**

Evidence:
- Spatial App Shell and floating Bottom Dock: PR #254.
- Viewport, keyboard inset, safe-area, sticky action, and spacing ownership: PR #292.
- Responsive header hardening: PR #293.
- Bottom Dock semantics, focus, unread labels, and touch targets: PR #294.
- Search/filter bottom-sheet behavior: PR #257 and #266.
- Browser Smoke checks mobile overflow and critical routes.
- Permanent Spatial App Shell, design foundation, search/filter, desktop, and browser contracts pass.

### Phase 19 — Visual System Simplification & Premium Marketplace Polish

**Status: Closed for current design direction**

Evidence:
- Design System V2: PR #252.
- Marketplace Core V2: PR #253.
- Spatial App Shell: PR #254.
- Home Discovery V3: PR #255.
- Adaptive listing cards: PR #256.
- Search/filters, listing detail, Listing Studio, seller storefront, auth/account, communication, desktop, page-container, and account-surface passes were merged through PRs #257–#299.
- Canonical page rhythm is now applied across core marketplace and secondary account surfaces.

### Phase 20 — Verification System V2

**Status: Closed with Production dependency**

Evidence:
- PR #209 added private `verification-documents` storage.
- Evidence is request-bound and owner-path scoped.
- Requests are created through a governed RPC after object ownership/existence checks.
- Linked evidence cannot be deleted by the owner.
- Authorized reviewers receive temporary signed evidence access.
- Direct public evidence exposure is prohibited.
- Verification Documents V2 regression runs permanently in Quality Gate.

Production dependency:
- `202607100011_verification_documents_v2.sql` must be verified as applied in Supabase Production.
- Camera capture exists only through the browser/device file input contract; no fake liveness or automated identity claim is made.

### Phase 21 — Marketplace Growth Capabilities

**Status: Partially closed**

Implemented:
- Similar listings and saved-search-backed alerts.
- Seller reviews, traits, responses, eligibility, and reporting.
- Listing reservations.
- Verified price-drop offers.
- Managed ad placements and campaigns.
- Promotion requests and moderation notifications.
- Vercel Analytics integration.
- Removable launch demo inventory and media tooling.

Remaining original-scope gaps:
- No complete duplicate-listing detection engine.
- No full spam-risk scoring pipeline.
- No production-grade personalized recommendation engine.
- No formal marketplace monetization ledger/billing system.
- No comprehensive seller reputation score beyond verified state, ratings, reviews, and available listing/account signals.

## Closure summary

- **Closed:** 14 phases.
- **Closed with Production/operational dependency:** 5 phases.
- **Partially closed:** 3 phases.
- **Not closed:** 0 phases.

The three partially closed phases are:
1. Phase 8 — advanced Arabic search normalization and relevance.
2. Phase 17 — type-specific semantic SEO and deep taxonomy indexability.
3. Phase 21 — advanced growth intelligence, duplicate/spam detection, recommendations, and monetization.

## Required Production actions

The following repository work must not be described as live until explicitly verified in Supabase Production:

1. Apply/verify `202607130001_canonical_listing_taxonomy_assignments.sql`.
2. Verify `202607100011_verification_documents_v2.sql`.
3. Reconcile any other migration whose ledger state is still `unknown` before relying on its feature in Production.
4. Verify dashboard-only Auth settings separately from PostgreSQL schema evidence.

## Next implementation order

1. Close Phase 8 with a source-backed Arabic search normalization and relevance contract.
2. Close Phase 17 with honest type-specific structured data and indexable deep taxonomy landing pages.
3. Close Phase 21 in separate product slices: duplicate/spam detection, seller reputation, recommendations, analytics attribution, then monetization.

No phase should be reopened based only on its title. A new implementation PR requires a demonstrated current-main gap, a bounded contract, regression coverage, and explicit Production boundaries.
