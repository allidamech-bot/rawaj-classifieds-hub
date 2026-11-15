# RAWAJ — Batch 1 live frontend acceptance audit

**Date:** 2026-11-15 (Europe/Istanbul). **Target:** `https://rawa-j.com`.
**Observed production build:** `615a16733d243869ef9fe1db470562ca496d8fdc` (from `rawaj-build-commit`).
**Scope:** read-only browser checks on deployed pages and static source/CI review. No login, data mutation, backend change, or production deployment.

## Verdict

**NOT ACCEPTED AS A FINISHED FRONTEND.** A merged design PR is evidence of code integration, **not** evidence of visual and functional acceptance. P1 contrast failures and text clipping were reproduced in the live DOM, including Arabic RTL and English LTR. This record supersedes any shorthand categorizing B1/B2/B3.1/B3.3 as visually finished.

## Verified P1 defects (live production)

| ID | Route / element | Reproduction and measured evidence | Likely owner / remediation | Acceptance |
| --- | --- | --- | --- | --- |
| P1-01 | `/categories` search input | At 390px AR and 320px EN, computed text `rgb(245,240,233)` on parent `rgb(255,250,243)` (approximately **1.1:1** contrast). Type into the category search to reproduce. Its placeholder has an unrelated dark rule. | `src/routes/categories.tsx` and the retired broad form-control selector in `src/rawaj-chromatic-premium-system-v17.css`. The V8 route correction already specifies dark text, but V17's high-specificity `!important` rule wins. Remove inappropriate V17 ownership from the *actual* categories route rather than appending a new fallback patch. | Typed text and placeholder each remain >=4.5:1 contrast on actual search surface in AR/EN at 320/390/1440px; typing/filtering still works. |
| P1-02 | `/support` advice chips under “Details that help support” | At 390px AR and 320px EN, text `rgb(19,39,36)` on background `rgb(23,27,36)` (approximately **1.1:1**). Affected DOM elements are text-owning `div.rounded-xl.bg-muted-surface`. Reproduced at desktop 1440px too. | `src/routes/support.tsx` `SupportDetail` plus incompatible legacy `--muted-surface` / utility styling. Establish matching foreground/background in the component/approved trust system; do not weaken the audit. | All support guidance rows pass >=4.5:1 in both languages/mobile/desktop. |
| P1-03 | `/listings` card prices | One `strong.rawaj-adaptive-card__price` renders `scrollWidth=183`, `clientWidth=115`, and `overflow:hidden; white-space:nowrap` at 390px. At least eight listing cards on page exhibit visible price clipping. At 1440px, another recorded price was `scrollWidth=208` vs `clientWidth=174`. | `src/launch-readiness-visual-polish.css` forces ellipsis on price; card layout in `src/adaptive-listing-cards.css` and `src/listings-results.css`. Fix presentation within the shared price/card owner so complete price and negotiability remain readable; avoid global overrides. | No hidden numeric amounts or important price qualifiers at 320/390/430/1440px; wrapping/reflow as needed, RTL/LTR. |

**Source-level proof:** Chrome DevTools CSS matched-rule inspection on `/categories` found V8's desired `color: var(--rawaj-identity-ink)!important` overridden by V17's `color: #f5f0e9!important` on the input. `src/rawaj-chromatic-premium-system-v17.css` currently applies dark form control styling to almost every route except a limited list. The production screenshot and computed styles independently confirm the conflict.

## Further visual defects / hypotheses requiring acceptance (do not mark resolved)

| ID | Surface | Observation and required follow-up |
| --- | --- | --- |
| P2-01 | Homepage `/` | Narrow mobile screenshot has crowded hero/title and partially displayed featured carousel cards. Determine intentional carousel clipping vs unintended readability defect with actual screenshots at 320/390/430. |
| P2-02 | Homepage, categories, listings | Some listing fallback media use charcoal/black backgrounds with saturated pink icons inconsistent with the approved petrol/ivory UI. Trace the placeholder owner rather than replacing product photos or images. |
| P2-03 | Listing detail `/listings/$id` | Visual capture shows an overlaid quick-action strip near specifications/gallery and tight controls. Verify sticky actions do not cover critical content and gallery remains operable. |
| P2-04 | Seller storefront `/seller/$id` | Public VBM GLOBAL store opened with listings; one image area looked blank/white in screenshot. Actual assets did load (images reported nonzero natural widths), so distinguish intentional asset blankness, lazy loading, and CSS media crop before fixing. |
| P2-05 | `/more` and related account surfaces | The Arabic route displayed the English word `Boost` and a noticeably different dark dock from the homepage; audit localization, shared chrome and token ownership. |
| P2-06 | Public site-wide | Browser `theme-color` differs by route: `#073836` on home/categories/listings/add-listing, `#242529` on support/chats/notifications/admin/account and `#fcfaf7` on My Store. Determine intentional page modes vs accidental legacy configuration, then standardize approved browser/PWA surfaces. |
| P2-07 | `/category/$slug` | Visual QA fixture `/category/vehicles` displayed 404 live. Route loader explicitly returns 404 if no active category with that slug; this **does not prove a routing bug**. Replace fixture with a slug backed by an isolated active category; avoid inventing production data. |
| P2-08 | Page footer / bottom dock | On mobile screenshots, bottom dock appears fixed during full-page capture on several routes. Check content clearance, tap interception, safe areas, scroll and overlay state in iPhone Safari; a full-page screenshot alone cannot prove collision. |

## Route coverage / evidence matrix

Generated TanStack `FileRoutesByFullPath` has **48 declarations**. After normalizing two trailing-slash aliases and excluding the non-visual sitemap endpoint, there are **45 distinct UI route patterns**. This audit visited 43 representative route URLs across the router families on the live site at 390px/320px. Some dynamic or secured screens expose only a 404, sign-in, or authorization gate, and therefore are **not functionally accepted**.

| Family | Routes observed, representative example, outcome | Acceptance status |
| --- | --- | --- |
| Discovery | `/`, `/categories`, `/listings`, `/offers`, `/category/vehicles` | **Failed visual acceptance** (P1-01/03); legacy slug fixture returned 404. |
| Listing/store | `/listings/396a72c1-bbd8-42fc-b8f6-918dc6daefa8`, `/seller/6524bf6a-2bfe-4218-ad4d-c359e52288f0` | Public pages rendered on earlier browser inspection; P2 observations pending. |
| Auth/account | `/login`, `/reset-password`, `/auth/callback`, `/profile`, `/profile/listings`, `/favorites`, `/saved-searches`, `/more`, `/add-listing` | Public/signed-out states rendered. **Authenticated owner workflows unverified**. |
| Communication | `/chats`, `/notifications`, `/activity` | Signed-out gates rendered. Threads/preferences/unread workflows **unverified**. |
| Trust/legal/promotions | `/support`, `/safety`, `/verification`, `/terms`, `/privacy`, `/prohibited`, `/promotion`, `/promotion-request` | **Failed visual acceptance** (P1-02); private submissions unverified. |
| Administration | `/admin`, `/admin/pending`, `/admin/listings`, `/admin/data-quality`, `/admin/reviews`, `/admin/reports`, `/admin/message-reports`, `/admin/safety`, `/admin/verifications`, `/admin/users`, `/admin/promotions`, `/admin/ad-placements`, `/admin/campaigns`, `/admin/audit`, `/admin/owner-controls`, **`/admin/notifications`** | Guest authorization gates observed; **all 16 admin working surfaces require isolated authorized fixtures**. |
| Not yet directly exercised | `/syria/$slug`, `/profile/listings/$id` | Need grounded fixture and role appropriate access; no unverified acceptance claims. |

**Additional live interaction:** Browser successfully filtered `/listings?q=سيارة` to two listings; category search accepted typed input (but was unreadable because of P1-01). English `dir=ltr` and `lang=en` rendered for categories/support/listings/login/more. At 320px, page widths did not exceed viewport for the sampled routes, but lack of document-wide overflow **does not** establish internal text readability (P1-03).

## Why existing CI did not catch these defects

- `e2e/layout-audit.ts` checks viewport overflow but not clipping within internal card price containers.
- Its contrast inventory evaluates common text elements such as headings/spans/paragraphs/strong, but does not automatically cover text-owning generic `div` nodes (P1-02).
- Standard text contrast checks do not automatically evaluate editable input text or placeholder contrast (P1-01).
- Green checks for separate PR HEADs do not establish combined `main` visual acceptance.

## Next batches / closure contract

1. **Batch 2 — confirmed P1 repair:** resolve P1-01/02/03 at their source owners and implement regression checks for actual computed colors and uncropped prices, with existing functionality preserved. Inspect screenshots at 320, 390, 430, 1440px in AR and EN. No new CSS catch-all patch.
2. **Batch 3 — identity reconciliation:** eliminate inappropriate legacy selector ownership in scope; check cards, media placeholders, footer, dock, browser theme-color and typography across the route matrix. Preserve approved homepage and My Store except for proven defects.
3. **Batch 4 — protected/public journey acceptance:** complete auth-owner-admin isolated test paths; verify real accessible route states without touching production data.
4. **Batch 5 — integration:** coordinate open B3.2 PR #874 and B3.4 #876, reconcile actual merge conflicts, and leave B4 pre-audit PR #877 untouched until its relevant acceptance work can be merged. Do not duplicate other agents' branches.
5. **Batch 6 — final acceptance:** exact-HEAD Quality Gate, Chrome, WebKit, visual screenshots and RTL/LTR, a complete route-state matrix and physical iPhone Safari/PWA checklist. No production deployment by this implementation.

**Status language:** `merged` is not `visually accepted`. Do not mark these pages or the complete redesign done until their documented tests and visual review pass. This is a browser/DOM audit, not a security penetration test, a production authorized-session test, or a real-iPhone hardware test.
