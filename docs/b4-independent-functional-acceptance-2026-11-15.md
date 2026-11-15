# B4 independent functional and route acceptance — 2026-11-15

## Scope and isolation

- Baseline: `main` commit `f066793becf75c4e47479a88bee0264635f62932`.
- Dedicated branch: `test/20261115-b4-independent-functional-acceptance`.
- TanStack source of truth: `src/routeTree.gen.ts`, `FileRoutesByFullPath` (48 generated entries, including index aliases and sitemap); the existing draft PR #877 separately tracks the rendered-visual route inventory. This branch does **not** edit its tests, documentation or source branch.
- New deterministic tests: `e2e/b4-admin-authorization-matrix.spec.ts` and `e2e/b4-functional-marketplace-journeys.spec.ts`.
- New CI: `.github/workflows/b4-functional-acceptance.yml` — mobile WebKit (iPhone 13) and desktop Chromium, both Arabic RTL and English LTR.
- Browser Smoke also runs the new specs (mobile and desktop Chromium) when `e2e/**` changes.
- New test suites are explicitly disabled without `RAWAJ_E2E_USE_FIXTURES=1` or when `E2E_BASE_URL` points to an external environment. No production mutations.

## Route-to-test matrix

Status terms: **B4** = newly exercised in this branch; **Existing** = already present in main and exercised by the repo's broader browser/Node jobs; **Blocked** = requires real authorized test identities and a dedicated non-production backend. An existing test is not evidence of a successful current CI run until its workflow completes.

| Journey | Generated routes / actions | Existing acceptance coverage | New B4 coverage / limitation |
| --- | --- | --- | --- |
| 1. Discovery and filtering | `/`, `/categories`, `/category/$slug`, `/listings`, `/listings/$id` | `marketplace-smoke`, `search-results-design`, `listings-filter-sheet-scroll`, `categories-directory-design`, `authenticated-critical-journey` | **B4:** home search with trimmed query → result → listing detail; home → category directory query; both languages; category taxonomy and filter controls covered by existing tests |
| 2. Seller and contact | `/listings/$id`, `/seller/$id`, contact dock | `listing-detail-approved-identity`, `my-store-approved-design`, `authenticated-messaging-journey` | **B4:** detail → public seller store → detail; safe phone/WhatsApp URL contracts (no external click); guest message redirects to login without private write |
| 3. Authentication/profile | `/login`, `/reset-password`, `/auth/callback`, `/profile`, `/more` | `authenticated-account-profile-journey`, `b3-account-family`, `release-core-journeys` | **B4:** malformed/empty login validation and no session creation in both languages. Live Firebase credential rejection / OAuth blocked (fixture accepts any password) |
| 4. Listing lifecycle | `/add-listing`, `/profile/listings`, `/profile/listings/$id` | `authenticated-critical-journey`, `authenticated-owner-listing-lifecycle-journey`, `b2-listing-editor-acceptance` | Existing isolated create/draft/submit/edit and owner listing fixtures. Real moderation/approval round-trip blocked without authorized backend |
| 5. Retention/commerce | `/favorites`, `/saved-searches`, `/offers`, `/promotion`, `/promotion-request` | `authenticated-saved-discovery-journey`, `authenticated-price-offers-journey`, `premium-listing-workflows-responsive`, `release-core-journeys` | Existing isolated persistence/offer coverage. Actual paid promotion/payment fulfillment not proven |
| 6. Communication | `/chats`, `/notifications`, `/activity` | `authenticated-messaging-journey`, `authenticated-notifications-journey`, `home-notification-overlay`, `current-acceptance-regression` | Existing mocked account flows; true push delivery, cross-user inbox and production realtime not verified |
| 7. Support/trust | `/support`, `/safety`, `/verification`, `/privacy`, `/terms`, `/prohibited` | `b3-trust-support`, `release-core-journeys` and safety/verification Node contracts | Existing validation, retry/error and report/verification fixtures; actual human moderation status not verified |
| 8. Administration | `/admin` and **every** `/admin/*` entry from generated TanStack inventory | `marketplace-smoke` (subset), `scripts/admin-security-regression.mjs`, admin contract tests | **B4:** generated full route inventory; guest + signed-in ordinary member both denied direct entry with no privileged UI/actions; real admin role positive authorization blocked |

## Functional states & evidence

| State | Evidence |
| --- | --- |
| Loading and navigation race | `marketplace-smoke.spec.ts` checks pending route mask; `rendered-system-states.spec.ts` checks error boundary |
| Empty | `authenticated-saved-discovery-journey.spec.ts` checks favorites and saved searches empty states |
| Validation | B4 login validation; existing B3 support/verification validation |
| Error/retry | `b3-trust-support.spec.ts` simulates 503 and retries; `rendered-system-states.spec.ts` |
| Permission denied | B4 complete dynamically derived admin matrix, guest and ordinary member |
| RTL/LTR, responsive | B4 Arabic/English × mobile WebKit/desktop Chromium; existing B3 tests inspect 320–1440 px widths |
| Private write isolation | B4 asserts zero guest conversation writes; existing authenticated fixtures assert local-only writes and bearer token |
| Failed requests | Playwright traces/screenshots preserved on failures by config; workflow artifacts retained for seven days |

## Verified limitations and stability risks

1. **No valid owner/admin test identity provided.** Positive admin workflows and permission *roles* cannot be asserted in an isolated browser session. The deny-only matrix must not be represented as full administrative authorization certification. Do not simulate admin privileges by altering frontend role data.
2. **No live Firebase auth negative test.** `e2e/firebase-auth-fixture.ts` accepts arbitrary passwords, so the B4 negative test only exercises client-side validation, not credential validation. The existing positive fixture sessions are simulation, not production SSO evidence.
3. **Backend does not run as a real isolated multi-user deployment in this PR.** Cross-user messaging, actual notifications delivery, manual trust approvals, paid promotion and real owner-admin actions remain unverified.
4. **Existing tests sometimes skip when reference data is unavailable** (e.g. the category landing route check in `marketplace-smoke`). The B4 cases require deterministic local fixtures rather than silently skipping a missing dataset.
5. **Concurrent changes:** PRs #874, #876, #877 and #879 are explicitly out of scope. Any merge requires a fresh base comparison, resolved integration conflicts and passing exact-HEAD CI.

## Defect register

No new functional defect is marked **confirmed** solely on inspection. Failures must be recorded after execution with route, language, viewport, fixture, reproduction steps, expected and actual outcomes, log/trace and priority.

Separately, open PR #879 reports three display regressions (category search contrast, support surface readability, price clipping). These are **reported by its owning PR**, not reproduced or fixed by this functional-testing branch; their implementation remains exclusively with #879.

## Evidence and merge gate

Use the dedicated `B4 Functional Acceptance` workflow and existing `Browser Smoke` / `Quality Gate` checks on the exact branch HEAD. Attach CI run links and test totals to the PR once complete. Do not merge with failing, missing or pending mandatory checks. No production deployment.
