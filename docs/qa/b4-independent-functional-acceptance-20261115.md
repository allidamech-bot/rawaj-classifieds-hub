# RAWAJ — Batch 4 independent functional acceptance

**Baseline:** `main` at `f066793becf75c4e47479a88bee0264635f62932` (2026-11-15).  
**Change ownership:** only `e2e/b4-*.spec.ts`, this QA document and the dedicated B4 CI workflow.  
**Environment:** local Vite fixture mode (`RAWAJ_E2E_USE_FIXTURES=1`), never production.  
**Language/browser targets:** ar-SY RTL and en LTR; mobile Chromium, desktop Chromium, desktop Firefox and emulated iPhone WebKit.

## Route-to-test coverage matrix

| Owner-requested journey | Real TanStack routes | Existing browser coverage in main | New B4 assertion | Remaining limit |
| --- | --- | --- | --- | --- |
| Home → categories → search/filter → detail | `/`, `/categories`, `/category/$slug`, `/listings`, `/listings/$id`, `/syria/$slug` | `marketplace-smoke.spec.ts`, `search-results-design.spec.ts`, `release-core-journeys.spec.ts` | UI-driven category transition, query normalization, URL sort persistence/reload, fixture listing detail, recovery after 503, deterministic empty state | Location/category variant coverage remains in existing tests; full live dataset not asserted |
| Detail → seller → contact | `/listings/$id`, `/seller/$id`, `/login`, `/chats` | `authenticated-messaging-journey.spec.ts`, `authenticated-critical-journey.spec.ts` | Seller link actually navigates; visible contact actions; unauthenticated messaging requires login with returnTo | Message write covered only in existing isolated authenticated fixture suite |
| Login → account/profile/preferences | `/login`, `/auth/callback`, `/reset-password`, `/profile`, `/more` | `authenticated-account-profile-journey.spec.ts`, `b3-account-family.spec.ts`, `b3-account-hub.spec.ts` | Local bilingual route surface inventory | Real Firebase, MFA and external identity providers not exercised |
| Create → draft → edit → My Store | `/add-listing`, `/profile/listings`, `/profile/listings/$id` | `authenticated-critical-journey.spec.ts`, `authenticated-owner-listing-lifecycle-journey.spec.ts`, `b2-listing-editor-acceptance.spec.ts`, `my-store-approved-design.spec.ts` | Signed-out route surface and localized navigation smoke | Mutations rely on existing local owner fixtures; no live posting |
| Favorites, searches, offers, promotions | `/favorites`, `/saved-searches`, `/offers`, `/promotion`, `/promotion-request` | `authenticated-saved-discovery-journey.spec.ts`, `authenticated-price-offers-journey.spec.ts` | Bilingual route inventory; no remote writes | Real payments, pricing, external promotion fulfillment not exercised |
| Messaging, notifications, activity | `/chats`, `/notifications`, `/activity` | `authenticated-messaging-journey.spec.ts`, `authenticated-notifications-journey.spec.ts`, `authenticated-rendered-visual-qa.spec.ts` | Bilingual route inventory and guest-to-login contact boundary | Realtime multi-user delivery not proven on production |
| Support, reporting, safety, verification | `/support`, `/safety`, `/prohibited`, `/privacy`, `/terms`, `/verification` | `b3-trust-support.spec.ts`, `rendered-system-states.spec.ts` | Bilingual direct-route inventory | Government document submission and manual-review outcome intentionally not exercised |
| All administration routes | `/admin` and all 15 generated child routes | `marketplace-smoke.spec.ts` checks partial anonymous navigation; `scripts/admin-security-regression.mjs` contract suite | Explicit exhaustive anonymous route matrix; ordinary-member denial on dashboard/users/owner controls; no admin nav or privileged requests | Positive admin-authorized workflows require real authorized isolated identities and backend fixtures; not verified here |

## All generated admin routes

`/admin`, `/admin/ad-placements`, `/admin/audit`, `/admin/campaigns`, `/admin/data-quality`, `/admin/listings`, `/admin/message-reports`, `/admin/notifications`, `/admin/owner-controls`, `/admin/pending`, `/admin/promotions`, `/admin/reports`, `/admin/reviews`, `/admin/safety`, `/admin/users`, `/admin/verifications`.

## Determinism and security model

- The B4 tests explicitly **skip** unless local fixture mode is enabled and `E2E_BASE_URL` is unset; they must never point at production.
- Generated listing IDs and the authorized ordinary-member fixture come from the repository's existing Vite middleware and Firebase-auth fixture.
- Admin checks are negative authorization acceptance, *not* an authorization proof against a real production backend. The actual server must enforce permissions independently of the UI.
- No test creates actual marketplace listings, messages, promotions or support submissions against production.
- Any product failure must be documented separately with route, steps, expected, actual, affected browser, reproduction evidence and severity. The B4 branch must not modify overlapping product/UI files.
- Screenshots/traces are uploaded on browser failure; test results are not deemed passed until GitHub reports successful jobs.

## Reproduction

```bash
npm ci
npx playwright install --with-deps chromium firefox webkit
RAWAJ_E2E_USE_FIXTURES=1 \
VITE_PUBLIC_DATA_API_BASE_URL=http://127.0.0.1:4173 \
VITE_RAWAJ_E2E_DISABLE_REMOTE_MEDIA=1 \
npx playwright test e2e/b4-functional-acceptance.spec.ts e2e/b4-admin-authorization.spec.ts \
  --project=mobile-chromium --project=desktop-chromium \
  --project=desktop-firefox --project=mobile-webkit
```

GitHub CI: `.github/workflows/b4-functional-acceptance.yml`, plus repository Quality Gate and Browser Smoke on PR. Absence of CI failures is **not** equivalent to production acceptance for paths intentionally unverified.

## Defect register and final status

| Severity | Route | Steps / expected / actual | Status |
| --- | --- | --- | --- |
| — | — | No confirmed functional product defect established from code inspection alone. Browser failures, if any, will be triaged and added with reproducible evidence. | Pending CI |

**Authenticated limitations:** no independently verified actual admin session, production Firebase login, real member-to-member delivery, production notifications, payment or manual verification. These must not be reported as passed merely because isolated fixture tests pass.

**Merge gate:** only merge after every required check, including B4 Chromium/Firefox/WebKit jobs, passes on the final PR head and the PR has no unresolved conflicts.
