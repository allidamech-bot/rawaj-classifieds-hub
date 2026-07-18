# RAWAJ Android 1.0.4 Pre-release Customer Acceptance Audit

**Audit date:** 2026-07-18  
**Repository:** `allidamech-bot/rawaj-classifieds-hub`  
**Baseline:** `4444114fc0429175fff7cdbd9af0006c6ce7a143`  
**Audit branch:** `audit/android-1.0.4-customer-acceptance`  
**Pull request:** `#458`  
**Production origin inspected non-destructively:** `https://rawa-j.com`  
**Release decision:** **NO-GO**

## 1. Executive verdict

The exact requested baseline was verified and built successfully. The audit branch adds a production-style local browser gate, a live read-only browser gate, the complete requested viewport matrix, cross-browser smoke, Lighthouse evidence, regression contracts, and objective fixes.

The release remains **NO-GO** for customer publication because:

1. The live mobile homepage and listings experience recorded release-critical LCP results of approximately **17.1 seconds** and **24.4 seconds**. The branch fixes the identified lazy-loading root causes, but the fixed branch cannot yet be measured against production-like public data because the Vercel Preview check is blocked by the account build-rate limit.
2. Existing production media includes materially oversized images. One listing-card source image was approximately 3.5 MB while rendered at a small card size. Production media transformation or replacement is outside this audit's non-destructive boundary.
3. GitHub Actions does not expose dedicated Supabase test credentials, so real authenticated buyer, seller, favorite, saved-search, chat, notification, profile-edit, listing-create/edit, and admin journeys were not completed.
4. Physical Android acceptance for OAuth/deep links, push navigation, safe areas, keyboard overlap, back behavior, TalkBack, and installation of the signed RC remains external.

No P0 defect was found. No Production promotion, live data mutation, Google Play upload, or PR merge was performed.

## 2. Baseline verification

| Check | Result |
| --- | --- |
| Expected `main` commit | `4444114fc0429175fff7cdbd9af0006c6ce7a143` |
| Actual verified `main` commit at audit start | Exact match |
| Baseline commit message | `Build Android 1.0.4 release candidate (#457)` |
| Feature branch ancestry | Baseline is an ancestor; branch is not behind `main` |
| GitHub checkout cleanliness | Clean checkout verified by the acceptance workflow |
| User Windows working tree | Not inspectable from the available environment |
| `npm ci` | Executed in GitHub Actions |
| `npm run typecheck` | Executed on the audited branch |
| `npm run build` | Executed on the audited branch |
| Direct modification of `main` | None |
| Production promotion | Not performed |
| Google Play release/upload | Not performed |
| Supabase production mutation | Not performed |

The repository uses TanStack Start, React 19, TypeScript, Supabase, Capacitor Android, Playwright, and a broad contract/lint/typecheck/build Quality Gate.

## 3. Environment and browser details

- GitHub-hosted Ubuntu 24.04 runners.
- Node.js 22.
- Playwright Chromium for the full acceptance matrix.
- Cross-browser smoke projects: mobile Chromium, desktop Chromium, desktop Firefox, and mobile WebKit.
- Arabic locale `ar-SY`; expected document semantics `lang="ar"` and `dir="rtl"`.
- Local target: production Node output built with `NITRO_PRESET=node-server` and served from `.output/server/index.mjs` on `127.0.0.1:4173`.
- Live target: `https://rawa-j.com`, read-only and non-destructive.
- Lighthouse mobile and desktop profiles for `/`, `/listings`, one real listing detail, and `/login`.

The requested Codex integrated browser was not available in this session. Browser execution was performed through Playwright in GitHub Actions with screenshots, traces, videos, HTML reports, console monitoring, network-failure monitoring, and Lighthouse artifacts. Direct Chromium access from the local execution container to the public domain was administratively blocked; no direct-container browsing is claimed.

The local workflow stubs only the unavailable Vercel Analytics script endpoint. This avoids a local non-Vercel MIME/404 false failure while preserving all application, API, image, route, console, and JavaScript failure checks.

## 4. Local-main versus live-site differences

| Area | Audited branch/local production | Live website baseline |
| --- | --- | --- |
| Source revision | PR branch based on exact baseline | Deployment revision was not assumed to equal the branch |
| Supabase Actions secrets | Not configured | Public production reads available |
| Public listing/seller data | Data-dependent tests can skip locally | Real public data inspected non-destructively |
| 320 px hero/title | Fluid typography fix present | Overlap/crowding captured in live evidence |
| 320 px primary dock label | Compact `أضف` label present | Truncated unfinished label captured live |
| Promotional banner priority | Eager/high priority with intrinsic dimensions | Live baseline LCP banner was lazy |
| Listing-card priority | Near-viewport cards promoted; off-screen cards remain lazy | Live baseline visible LCP card remained lazy |
| Canonical metadata | Implicit root canonical conflict removed | Live listings/detail contained conflicting canonical links |
| Accessibility fixes | Brand naming, contrast, card contrast, summary contrast, footer contrast and heading order fixed | Lighthouse findings reflect pre-fix live deployment |
| Preview validation | Source build succeeds; Vercel Preview blocked by build-rate limit | Production intentionally unchanged |

## 5. Device and viewport matrix

The suite loads `/` and `/listings` at every required size, reloads important routes after viewport initialization, verifies Arabic RTL semantics, checks document width against viewport width, captures screenshots, and records page errors, console errors, failed requests, and server failures.

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

The route inventory is repeated at 360 × 800 and 1440 × 900. Portrait coverage is complete for the requested matrix. Explicit landscape-device emulation remains an external/manual gate.

## 6. Route coverage

### Static public routes loaded directly

`/`, `/categories`, `/listings`, `/offers`, `/login`, `/reset-password`, `/support`, `/safety`, `/privacy`, `/terms`, `/prohibited`, `/promotion`, `/verification`.

### Protected/account routes loaded directly and checked for safe failure/redirect behavior

`/profile`, `/profile/listings`, `/add-listing`, `/favorites`, `/saved-searches`, `/chats`, `/notifications`, `/activity`, `/more`.

### Admin routes loaded directly and checked for safe failure/redirect behavior

`/admin`, `/admin/verifications`, `/admin/users`, `/admin/safety`, `/admin/reviews`, `/admin/reports`, `/admin/promotions`, `/admin/pending`, `/admin/owner-controls`, `/admin/message-reports`, `/admin/listings`, `/admin/campaigns`, `/admin/audit`, `/admin/ad-placements`.

### Dynamic/data-driven routes

- One real `/listings/$id` route was discovered from live listings and opened.
- The corresponding `/seller/$id` storefront was opened when the link was rendered.
- Logged-out contact behavior was checked for a login route, chat route, or explicit dialog outcome.
- Category/location/edit/OAuth dynamic paths are covered by repository contracts; destructive or credential-dependent browser interactions were not fabricated.

For covered routes, the suite checks direct URL load, visible `main`, refresh, back/forward, language/direction, horizontal overflow, page errors, console errors, failed requests, and HTTP 500-class failures.

## 7. Customer-journey results

| Journey | Result | Evidence / limitation |
| --- | --- | --- |
| A — New visitor | PASS for public path | Home, discovery, listing detail, seller storefront, and logged-out contact boundary exercised non-destructively. |
| B — Returning buyer | BLOCKED | No dedicated authenticated test credentials; no real user contacted. |
| C — Seller | BLOCKED | No isolated safe account/backend for listing submission and edit mutation. |
| D — Mobile-first customer | PARTIAL | Full responsive matrix and public navigation covered; branch-only fixes still require deployed real-data validation and native keyboard/safe-area acceptance. |
| E — Desktop customer | PASS for public path | Public shell, discovery, listings, detail, seller and desktop route inventory covered. |
| F — Failure recovery | PARTIAL | Invalid login, unavailable-auth state, refresh, back/forward, error/empty states and runtime monitoring covered; authenticated retry and controlled network-loss preservation remain blocked. |

**Public journey paths passed:** 2  
**Complete authenticated journeys passed:** 0  
**Product-crash journey failures established:** 0  
**Partial journeys:** 2  
**Blocked journeys:** 2

**Real authenticated journeys completed:** No.  
**Messages sent to real users:** No.  
**Listings submitted to Production:** No.

## 8. Button and interaction coverage

Browser interaction coverage includes:

- Header logo/account/login entry.
- Primary desktop navigation.
- Mobile bottom navigation and primary listing action.
- Search/filter entry points.
- Browser back/forward.
- Invalid login submission and input preservation when auth is configured.
- Keyboard Tab entry.
- Escape closure for an available dialog.
- Listing-card links.
- Seller-storefront links.
- Logged-out contact/message outcome.
- 320 px primary dock label integrity.

Repository contracts additionally cover filters, reset behavior, taxonomy, saved searches, favorites, listing studio, image handling, communication, notifications, profile, support, moderation, and access-control behavior. A rendered control was not counted as working solely because it existed. Credential-dependent actions remain blocked rather than inferred as passes.

## 9. Console, network, and runtime findings

- No core public-route JavaScript crash was established.
- The first local run exposed a Vercel-only `/_vercel/insights/script.js` MIME/404 issue on the local Node host. The audit harness now serves an inert script at that exact path rather than suppressing general 404s.
- An early cross-browser run installed only Chromium while requesting Firefox/WebKit. The workflow now installs all requested browsers; that failure was harness-related, not a RAWAJ product failure.
- Vercel Preview reports failure because the account reached its build-rate limit. This is an external capacity blocker, not a source-code build failure.
- Lighthouse found large media payloads, late LCP image priority, unused JavaScript, canonical conflicts, and accessibility issues on the live baseline.
- No secrets, authorization headers, tokens, private messages, or customer data are included in the report/artifacts.

## 10. Accessibility findings

### Covered

- Arabic `lang` and RTL document direction.
- Keyboard entry reaches a focusable element.
- Login input semantics.
- Escape closure for an available dialog.
- Stable image dimensions.
- Reduced-motion browser context.
- Horizontal-overflow checks.
- Lighthouse accessibility scores ranged from 93 to 100 on the measured live baseline.

### Live-baseline findings and branch fixes

1. Visible `RAWAJ` text did not match the home-link accessible name. The accessible name now includes both visible Arabic and Latin brand text.
2. Small Latin brand text failed contrast. The branch uses a darker light-mode orange and a readable dark-mode orange.
3. Listing-card price/category text and the listings summary failed contrast. The branch uses stronger light/dark text values.
4. Footer trust text failed contrast. It now uses foreground text.
5. Desktop listing detail reported a non-sequential footer `h4`. Footer group titles now use `h2`.

These fixes are contract-tested. A deployed post-fix Lighthouse rerun remains required.

## 11. Performance findings

### Live Lighthouse baseline

| Page/profile | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Home mobile | 48 | 96 | 96 | 100 | 1.84s | 17.10s | 700ms | 0.185 |
| Listings mobile | 54 | 96 | 96 | 92 | 1.80s | 24.37s | 260ms | 0.071 |
| Listing detail mobile | 75 | 90 | 96 | 92 | 1.83s | 6.73s | 120ms | 0.113 |
| Login mobile | 82 | 94 | 96 | 58 | 1.88s | 2.68s | 140ms | 0.184 |
| Home desktop | 70 | 96 | 96 | 100 | 0.58s | 3.97s | 80ms | 0.185 |
| Listings desktop | 86 | 96 | 96 | 92 | 0.52s | 2.25s | 0ms | 0.071 |
| Listing detail desktop | 89 | 90 | 96 | 92 | 0.53s | 2.13s | 0ms | 0.050 |
| Login desktop | 99 | 94 | 96 | 58 | 0.56s | 0.84s | 0ms | 0.016 |

The low login SEO score is materially affected by its intentional `noindex, nofollow` directive and is not treated as a public discoverability failure.

### Root causes confirmed by Lighthouse

- The above-the-fold promotional banner was the homepage LCP element and used lazy loading.
- A visible listing-card image was the listings mobile LCP element and used lazy loading.
- One live listing-card source image was approximately 3.5 MB while displayed at a small card size; Lighthouse reported approximately 3.4 MB potential savings for that asset.
- Home CLS of 0.185 exceeds the recommended 0.1 threshold and must be remeasured after media-priority fixes.
- Existing production media is oversized for several rendered dimensions.

### Code mitigation in this PR

- Above-the-fold promotional media uses eager/high priority and stable intrinsic dimensions.
- Listing images remain lazy by default, but cards already inside or near the viewport are promoted to eager/high using geometry and an IntersectionObserver with a bounded root margin.
- Off-screen cards remain lazy.
- Regression contracts prevent a blanket eager-loading regression.

### Unresolved production media gate

This audit cannot recompress or mutate existing Production Storage objects. Oversized media must be transformed, replaced, or served through an image-resizing pipeline, followed by mobile Lighthouse reruns on the deployed fixed build.

## 12. P0 issues

**Count: 0**

No reproduced public route crash, unusable login shell, sensitive-data exposure, destructive security defect, or core listing-open failure was established.

## 13. P1 issues

### P1-01 — 320 px homepage hero content overlap

- **Route:** `/`
- **Viewport:** 320 × 568
- **Actual live baseline:** Main Arabic value proposition collided visually with the following description.
- **Fix:** Fluid heading clamp and corrected line height.
- **Regression:** Playwright compares heading and description geometry.
- **Status:** Fixed in code; local browser gate and deployed review remain required.

### P1-02 — Release-critical mobile discovery LCP

- **Routes:** `/`, `/listings`
- **Profile:** Lighthouse mobile.
- **Actual live baseline:** LCP approximately 17.1s and 24.4s; performance 48 and 54.
- **Fix:** LCP media prioritization implemented without eagerly loading all cards.
- **Status:** Code/contract mitigation present; real-data post-deployment measurement and production media remediation remain unresolved.

**Total P1 findings: 2.**  
**Unresolved release P1 findings: 1 (`P1-02`).**

## 14. P2 issues

### P2-01 — 320 px bottom-dock primary label truncation

Fixed with a compact visible `أضف` label below 340 px while preserving the full accessible name.

### P2-02 — Color-contrast failures

Live baseline affected brand, result-summary, listing-card and footer trust text. Branch contrast fixes and contracts are present; deployed Lighthouse verification remains required.

### P2-03 — Accessible-name and heading-order inconsistencies

Header brand naming and footer heading order are fixed and contract-tested.

### P2-04 — Conflicting canonical links

The root head emitted a `/` canonical while leaf pages emitted route canonicals. `createSeo()` now emits a canonical only when a route explicitly supplies a path. The SEO contract prevents reintroduction.

**Total P2 findings: 4.**  
**Unresolved code fixes: 0.**  
**Post-deployment verification pending: 4.**

## 15. P3 issues

**Count: 0 recorded separately.**

Minor polish was not inflated into defects without objective customer impact.

## 16. Blocked tests and missing credentials

The following are not claimed as passed:

- Controlled registration and existing-email registration.
- Valid login, logout and session persistence.
- Google OAuth completion.
- Password-recovery email/deep-link completion.
- Favorite persistence and login action recovery.
- Saved-search create/delete/alert settings.
- Listing create, image upload/order/remove, moderation and edit preservation.
- Buyer/seller chat create/send/realtime/read/reconnect.
- Profile/avatar/cover mutation.
- Notification read mutation and push settings.
- Support submission.
- Admin moderation mutations.
- Physical Android deep links, push receipt, keyboard, safe areas, back behavior and TalkBack.

Reason: no dedicated safe E2E credentials or isolated mutable backend were available, and Production mutation was prohibited.

## 17. Screenshot, trace and audit evidence

GitHub Actions retains Playwright screenshots, videos, traces and HTML reports for 30 days. Key evidence names include:

- `mobile-320x568-home.png`
- `mobile-320x568-listings.png`
- `mobile-360x800-home.png`
- `desktop-1440x900-home.png`
- `desktop-1440x900-listings.png`
- `login-validation-mobile.png` when auth configuration is available
- `listing-detail-mobile.png`
- `seller-storefront-mobile.png`
- `home-mobile-320-readability.png` on the fixed local branch

Workflow artifacts:

- `local-main-pre-release-acceptance`
- `live-public-pre-release-acceptance`
- `live-lighthouse-pre-release-acceptance`

The live Lighthouse baseline artifact from run `29622887163` expires on 2026-08-17. This report preserves the measured values and conclusions after artifact expiry.

## 18. Fixes implemented

1. Responsive 320 px hero typography.
2. Compact 320 px primary add-listing label with unchanged accessible name.
3. Eager/high loading for above-the-fold promotional media.
4. Near-viewport eager/high promotion for listing-card images while preserving off-screen lazy loading.
5. Removal of conflicting implicit root canonical links.
6. Accessible brand-link name.
7. Stronger brand, card, result-summary and footer contrast.
8. Sequential footer heading structure.
9. Production-style local TanStack Start browser target.
10. Local Vercel Analytics test-host shim.
11. Correct installation of all cross-browser smoke engines.
12. Separation of live baseline checks from branch-only fixed-state assertions.

## 19. Automated regression tests added or extended

- New Playwright pre-release acceptance suite.
- Required 13-viewport matrix.
- Public/protected/admin route inventory at mobile and desktop.
- Runtime console/network/page-error and 500-class monitoring.
- RTL and horizontal-overflow checks.
- Back/forward behavior.
- 320 px hero geometry and bottom-dock label regression.
- Invalid login/input preservation.
- Keyboard focus and Escape behavior.
- Listing detail, seller storefront and logged-out contact path when data exists.
- Public-ad LCP-priority contract.
- Listing-card near-viewport priority contract.
- Explicit-canonical SEO contract.
- Accessible header-brand contract.
- Card contrast contract.
- Footer hierarchy/trust-contrast contract.
- Lighthouse mobile/desktop evidence workflow for four required page types.

## 20. Quality Gate and diff status

The branch is subject to the repository Quality Gate, browser acceptance workflow, cross-browser smoke, Android RC build, and contract workflows. The PR must remain draft and unmerged until the latest head is green or every external failure is explicitly classified. Vercel's build-rate-limit failure is external and does not replace a reviewable Preview requirement.

The final diff must contain only the audit report, evidence workflow, tests and objective fixes. No dependency package, production data, Google Play configuration, unrelated feature or broad redesign is permitted.

## 21. Remaining external acceptance gates

1. Clear the Vercel build-rate limit and obtain a reviewable Preview.
2. Re-run mobile/desktop Lighthouse on the deployed fixed branch with production-like data.
3. Remediate or transform oversized Production media without destructive data loss.
4. Configure isolated buyer, seller and admin E2E accounts/backend.
5. Complete authenticated journeys B and C and all blocked mutations.
6. Perform a physical Android RC pass for OAuth/deep links, push, safe areas, keyboard, back behavior and TalkBack.
7. Review every final PR check and the final diff.
8. Keep the PR draft and unmerged while any P0 or unresolved P1 remains.
9. Do not upload or promote Android 1.0.4 until the recommendation changes.

## 22. Final recommendation

**NO-GO**

The branch contains objective fixes and substantially stronger acceptance coverage, but release acceptance is incomplete. The live mobile discovery performance remains an unresolved P1 until oversized media is addressed and the fixed build is remeasured. Real authenticated journeys and physical Android acceptance also remain blocked. PR #458 must remain draft and unmerged.
