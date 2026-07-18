# RAWAJ Android 1.0.4 Pre-release Customer Acceptance Audit

**Audit date:** 2026-07-18  
**Repository:** `allidamech-bot/rawaj-classifieds-hub`  
**Baseline:** `4444114fc0429175fff7cdbd9af0006c6ce7a143`  
**Audit branch:** `audit/android-1.0.4-customer-acceptance`  
**Pull request:** `#458`  
**Production origin inspected non-destructively:** `https://rawa-j.com`  
**Release decision:** **NO-GO**

## 1. Executive verdict

The audited baseline builds and its full repository Quality Gate passes after the objective fixes in this pull request. The Android release-candidate workflow also builds successfully without publishing to Google Play.

The release is nevertheless **NO-GO** for customer publication at this checkpoint because:

1. The live mobile homepage and listings experience recorded release-critical LCP results of approximately 17.1 seconds and 24.4 seconds respectively. The pull request fixes the identified lazy-loading root causes, but an end-to-end measurement of the branch is still blocked because the Vercel Preview check is failing on the account build-rate limit.
2. GitHub Actions does not currently expose the dedicated Supabase test credentials required to complete real authenticated buyer, seller, favorite, saved-search, chat, notification, profile-edit, and listing-create/edit journeys safely.
3. A physical Android device callback test for Google OAuth, password recovery deep links, push-notification navigation, keyboard/safe-area behavior, and final signed RC installation remains an external acceptance gate.

No P0 defect was found. No Production promotion, live data mutation, Google Play upload, or PR merge was performed.

## 2. Baseline verification

| Check | Result |
| --- | --- |
| Expected `main` commit | `4444114fc0429175fff7cdbd9af0006c6ce7a143` |
| Actual verified `main` commit at audit start | Exact match |
| Baseline commit message | `Build Android 1.0.4 release candidate (#457)` |
| Feature branch ancestry | Baseline is an ancestor; branch is not behind `main` |
| Direct modification of `main` | None |
| Production promotion | Not performed |
| Google Play release/upload | Not performed |
| Supabase production mutation | Not performed |

The repository defines TanStack Start, React 19, TypeScript, Supabase, Capacitor Android, Playwright, four Playwright browser projects, and a broad Quality Gate with contract, lint, typecheck, build, and performance-budget stages.

## 3. Environment and browser details

- GitHub-hosted Ubuntu 24.04 runners.
- Node.js 22 for project checks.
- Playwright 1.61.1.
- Chromium for the full acceptance matrix.
- Existing release smoke projects: mobile Chromium, desktop Chromium, desktop Firefox, and mobile WebKit.
- Arabic locale: `ar-SY`.
- Document expectation: `lang="ar"`, `dir="rtl"`.
- Local target: production Node output generated with `NITRO_PRESET=node-server` and served on `127.0.0.1:4173`.
- Live target: `https://rawa-j.com`, read-only/non-destructive.

The local workflow deliberately stubs only the unavailable Vercel Analytics script endpoint. This prevents a local non-Vercel server from generating a false console failure while preserving all application, API, image, route, and JavaScript failure checks.

## 4. Local-main versus live-site differences

| Area | Local audited branch | Live website |
| --- | --- | --- |
| Source revision | PR branch based on the exact baseline | Deployment revision could not be assumed to equal the branch |
| Supabase test secrets in Actions | Not configured | Public production reads available |
| Public listing and seller data | May be absent locally without secrets | Available and inspected non-destructively |
| Vercel Analytics endpoint | Not native to local Node output; audit-only stub used | Available through Vercel |
| 320 px hero/title fix | Implemented on branch | Not present in captured live evidence |
| Compact 320 px bottom-dock label | Implemented on branch | Not present in captured live evidence |
| LCP media priority fixes | Implemented on branch | Live measurement still represents the pre-fix deployment |
| Preview validation | Blocked by Vercel build-rate limit | Production remained unchanged |

## 5. Device and viewport matrix

The acceptance test contains all required viewport sizes and reloads each major route after viewport initialization.

### Mobile

- 320 × 568
- 360 × 800
- 375 × 812
- 390 × 844
- 412 × 915
- 430 × 932

### Tablet

- 768 × 1024
- 820 × 1180
- 1024 × 1366

### Desktop

- 1280 × 720
- 1366 × 768
- 1440 × 900
- 1920 × 1080

Homepage and listings rendering, Arabic RTL semantics, runtime health, and horizontal overflow are covered at all 13 sizes. The route inventory is covered at representative 360 × 800 and 1440 × 900 sizes. Portrait is the primary mobile/tablet profile; desktop widths cover landscape presentation.

## 6. Route coverage

### Static public routes loaded directly

`/`, `/categories`, `/listings`, `/offers`, `/login`, `/reset-password`, `/support`, `/safety`, `/privacy`, `/terms`, `/prohibited`, `/promotion`, `/verification`.

### Protected/account routes loaded directly and verified to fail closed without crashing

`/profile`, `/profile/listings`, `/add-listing`, `/favorites`, `/saved-searches`, `/chats`, `/notifications`, `/activity`, `/more`.

### Admin routes loaded directly and verified to fail closed without crashing

`/admin`, `/admin/verifications`, `/admin/users`, `/admin/safety`, `/admin/reviews`, `/admin/reports`, `/admin/promotions`, `/admin/pending`, `/admin/owner-controls`, `/admin/message-reports`, `/admin/listings`, `/admin/campaigns`, `/admin/audit`, `/admin/ad-placements`.

### Dynamic/data-driven routes

- One public listing detail route was resolved from live listing discovery and inspected.
- The corresponding seller storefront was opened when the seller link was present.
- Category, Syria-location, listing-edit, OAuth callback, and other dynamic routes are covered by repository contracts; destructive or credential-dependent interactions were not fabricated.

For covered routes, the browser checks direct URL loading, visible `main`, document language/direction, refresh, back/forward behavior, horizontal overflow, page errors, console errors, and failed requests.

## 7. Customer-journey results

| Journey | Result | Evidence / limitation |
| --- | --- | --- |
| A — New visitor | PASS for public path | Homepage, discovery, listings, listing detail, seller link, and logged-out contact/login handling were exercised non-destructively. |
| B — Returning buyer | BLOCKED | No dedicated test credentials in Actions; no real user was contacted. |
| C — Seller | BLOCKED | No safe authenticated test account/environment for listing creation and edit submission. |
| D — Mobile-first customer | PARTIAL | Public navigation and responsive matrix covered; 320 px visual defects found and fixed, but branch Preview revalidation is blocked. |
| E — Desktop customer | PASS for public path | Public shell, discovery, filters presentation, listings and detail pages covered at desktop sizes. |
| F — Failure recovery | PARTIAL | Invalid login, browser navigation, route refresh, unavailable-auth state, error/empty states and runtime monitoring covered; authenticated retry and controlled network-loss state preservation remain blocked. |

**Real authenticated journeys completed:** No.  
**Messages sent to real users:** No.  
**Listings submitted to Production:** No.

## 8. Button and interaction coverage

Automated and manual-browser checks exercised:

- Header logo and account/login entry.
- Primary desktop navigation.
- Mobile bottom navigation and primary listing action.
- Search/filter entry points.
- Browser back and forward.
- Login form validation and form preservation.
- Password field semantics.
- Keyboard focus entry.
- Escape handling for available dialogs.
- Listing-card links.
- Seller-storefront links.
- Logged-out contact/message action outcome.
- Filter controls, reset contracts, saved-search contracts, favorites contracts, listing studio contracts, communication contracts, notification contracts, and admin access contracts through the Quality Gate.

A rendered control was not counted as working solely because it existed. Credential-dependent actions remain explicitly blocked rather than reported as passes.

## 9. Console and network findings

- No core public-route JavaScript crash was established.
- The first local production audit reported 404/MIME console errors for `/_vercel/insights/script.js`; this is a Vercel-only endpoint, not an application route. The local audit harness now supplies an inert local script at that exact path so genuine console and network failures remain visible.
- Vercel Preview currently reports failure because the account reached its build-rate limit. This is an external deployment-capacity blocker, not a source-code build failure.
- Live Lighthouse found very large media payloads and late LCP image prioritization.
- Secrets, authorization headers, tokens, and private user data were not captured in the report.

## 10. Accessibility findings

### Passing/covered

- Arabic `lang` and RTL document direction.
- Keyboard entry reaches a focusable element.
- Login inputs have semantic types and autocomplete values.
- Dialog Escape behavior is tested when a dialog trigger is available.
- Stable image dimensions reduce layout shift.
- Reduced-motion and horizontal-overflow contracts pass.
- Lighthouse accessibility scores ranged from 93 to 100 across the measured pages/profiles.

### Remaining findings

- Color-contrast failures were reported for the Latin `RAWAJ` brand text, listings result count, selected listing-card price/category text, and a footer trust badge.
- The visible logo text and the link accessible name do not fully match.
- Desktop listing detail reported a non-sequential footer heading level.

These are classified as P2 because they affect accessibility and clarity but did not make the audited journeys unusable.

## 11. Performance findings

### Live Lighthouse results

| Page | Mobile performance | Desktop performance | Mobile LCP | Desktop LCP |
| --- | ---: | ---: | ---: | ---: |
| Home | 48 | 66 | 17.1 s | 4.0 s |
| Listings | 54 | 90 | 24.4 s | 1.2 s |
| Listing detail | 70 | 93 | 4.7 s | 1.0 s |
| Login | 69 | 96 | 5.0 s | 1.1 s |

Accessibility was 93–100, best practices 100, and SEO varied by route.

### Root causes confirmed by Lighthouse

- The above-the-fold promotional banner was the homepage LCP element and used `loading="lazy"` without `fetchpriority="high"`.
- A visible listing-card image was the listings mobile LCP element and used `loading="lazy"`.
- Home transferred approximately 6.3 MiB; listings transferred approximately 7.9–8.0 MiB.
- Several individual listing/ad images are materially oversized for their rendered dimensions.
- Home and listings contain measurable unused JavaScript.

### Fixes in this PR

- Above-the-fold public ad media now uses eager loading and high fetch priority.
- Listing-card media remains lazy by default, but cards inside or close to the viewport are promoted to eager/high priority through bounded viewport detection and IntersectionObserver.
- Regression contracts ensure the solution does not make every card eager.

### Required remeasurement

The fix must be remeasured on a deployable PR Preview with the same production-like public data. The live Lighthouse scores above cannot prove the branch fix because the live site was intentionally not promoted.

## 12. P0 issues

**Count: 0**

No core crash, credential disclosure, destructive security issue, unusable login shell, or severe route failure was established.

## 13. P1 issues

### P1-01 — 320 px homepage hero content overlap

- **Route:** `/`
- **Viewport:** 320 × 568
- **Actual:** The main Arabic value proposition overlapped the following description and became visually unusable.
- **Expected:** Heading and description remain readable with no collision.
- **Fix:** Responsive clamp and line-height applied to the hero heading.
- **Regression:** Playwright compares the heading and following paragraph geometry at 320 px.
- **Status:** Fixed in code; branch browser gate required before merge.

### P1-02 — Release-critical mobile discovery LCP

- **Routes:** `/`, `/listings`
- **Profile:** Lighthouse mobile
- **Actual:** LCP approximately 17.1 s and 24.4 s, with performance scores 48 and 54.
- **Expected:** Above-the-fold discovery media must not be delayed by lazy loading; release should meet an agreed mobile performance threshold under the same profile.
- **Fix:** LCP media prioritization implemented without eagerly loading all cards.
- **Status:** Fix is contract-tested; end-to-end Preview measurement is blocked by the Vercel build-rate limit.

**Total P1 count: 2.**  
**Unresolved acceptance P1 count: 1 (P1-02 verification).**

## 14. P2 issues

### P2-01 — 320 px bottom-dock primary label truncation

Fixed by using a compact `أضف` label below 340 px. Regression coverage is included.

### P2-02 — Color-contrast failures

Remaining on selected brand, result-count, card metadata/price, and footer badge text. Requires token-level contrast correction and Lighthouse recheck.

### P2-03 — Accessible-name and heading-order inconsistencies

The header logo accessible name does not include its visible RAWAJ name, and the desktop listing-detail footer skips heading levels.

### P2-04 — Canonical metadata not accepted by Lighthouse

Listings and listing-detail pages did not expose a valid canonical URL in the live Lighthouse run. Login is intentionally noindex, but canonical generation should still be reviewed separately.

**Total P2 count: 4.**

## 15. P3 issues

**Count: 0 recorded separately.**

Minor visual polish was not inflated into defects where no objective customer impact was established.

## 16. Blocked tests and missing credentials

- Registration and existing-email registration against a controlled test account.
- Valid login, logout, and session persistence.
- Google OAuth completion.
- Password-recovery email delivery and native deep-link completion.
- Favorites persistence and action recovery after login.
- Saved-search create/delete/alert state with an authenticated account.
- Listing creation, image upload/order/removal, moderation state, and owner edit preservation through the browser.
- Real buyer/seller chat creation, send/read/realtime/reconnect behavior.
- Profile, avatar, cover, verification, notification read state, and account settings mutations.
- Admin authenticated routes and moderation actions.
- Native keyboard, safe area, push navigation, and physical-device OAuth callback.
- Branch Lighthouse remeasurement with production-like data while Vercel Preview is blocked.

## 17. Screenshot and evidence inventory

GitHub Actions retains Playwright screenshots, traces, videos on failure, HTML reports, and Lighthouse JSON artifacts for 30 days.

Evidence names include:

- `local-main-pre-release-acceptance`
- `live-public-pre-release-acceptance`
- `live-lighthouse-pre-release-acceptance`
- Existing Browser Smoke diagnostics
- Android release-candidate metadata/artifact from the RC workflow

Captured evidence includes homepage and listings screenshots across the required matrix, login and protected-route states, listing detail, seller storefront when data exists, and every automated failure context.

## 18. Fixes implemented

1. Fixed 320 px hero heading collision.
2. Fixed 320 px primary bottom-dock label truncation.
3. Added the 13-viewport acceptance matrix.
4. Added direct-route, reload, back/forward, RTL, overflow, runtime, validation, keyboard, listing, seller, and logged-out-contact checks.
5. Added local-main, live-public, cross-browser and Lighthouse audit jobs.
6. Isolated Vercel Analytics from the local Node audit without suppressing unrelated errors.
7. Prioritized above-the-fold ad media.
8. Prioritized only near-viewport listing-card media while preserving lazy loading elsewhere.
9. Updated regression contracts for the revised media behavior.

## 19. Automated regression tests added or extended

- `e2e/pre-release-customer-acceptance.spec.ts`
- `.github/workflows/pre-release-customer-acceptance.yml`
- 320 px hero/dock regression assertion.
- LCP media priority contract in `phases-54-56-performance-observability.test.mjs`.
- Updated public-ad rendering contract.
- Updated adaptive listing-card media contract.

## 20. Quality and build gates

- Repository Quality Gate: PASS on the code changes before this report-only commit; the report commit must also retain a green final run.
- Typecheck: PASS in Quality Gate.
- Production build: PASS in Quality Gate.
- Performance budget: PASS in Quality Gate.
- Android Release Candidate workflow: PASS on the audited code before the report-only commit; no Play publication performed.
- Vercel Preview: BLOCKED by build-rate limit.
- Browser Smoke and Pre-release Customer Acceptance: must be green on the final PR head before merge consideration.

## 21. Remaining external acceptance gates

1. Restore Vercel Preview capacity and deploy the PR branch without assigning the live domain.
2. Repeat mobile and desktop Lighthouse on the Preview with production-like public data.
3. Set dedicated, non-production test credentials/secrets for buyer, seller, and admin roles.
4. Complete Journeys B and C, authenticated portions of D/F, and the chat/notification flows.
5. Install the final signed RC on at least one representative Android device and verify OAuth/recovery deep links, keyboard, safe areas, push navigation, camera/gallery selection, and network recovery.
6. Correct or explicitly accept the remaining contrast, heading-order, accessible-name, and canonical findings.
7. Review the final PR diff and all final-head checks.
8. Keep the PR unmerged until the gates above are documented.

## 22. Final recommendation

# NO-GO

The codebase is buildable and materially improved, but the release cannot be accepted for customer publication while the mobile performance fix lacks branch-level end-to-end measurement and the principal authenticated/native customer journeys remain blocked. A future GO decision requires zero unresolved P0/P1 issues and completed external acceptance evidence.