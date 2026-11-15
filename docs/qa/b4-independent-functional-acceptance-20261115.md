# RAWAJ — B4 supplemental functional and route acceptance

**Baseline:** Created from main `f066793becf75c4e47479a88bee0264635f62932`, subsequently integrated with `49ae683639c83dbe93898c1d96d37ca4be222743` and newer main work.  
**Change ownership:** Dedicated supplemental tests and CI only. No production deployment, application source, shared UI components, styling, or other PR branches.

## Upstream reconciliation

PR [#881](https://github.com/allidamech-bot/rawaj-classifieds-hub/pull/881) merged on main while this independent audit was underway. It already supplies:

- `e2e/b4-admin-authorization-matrix.spec.ts`: all generated `/admin` routes, anonymous and regular-member denial in Arabic/English, with generated-route inventory.
- `e2e/b4-functional-marketplace-journeys.spec.ts`: public search → listing → seller → contact gate, login validation and category-directory queries.
- `.github/workflows/b4-functional-acceptance.yml`: its own mobile WebKit and desktop Chromium CI.
- `docs/b4-independent-functional-acceptance-2026-11-15.md`: original B4 coverage/limitations matrix.

**Do not replace or duplicate any #881 files.** The new supplemental file `e2e/b4-functional-acceptance.spec.ts` adds URL-state persistence, error/empty outcomes, a localized cross-route inventory and independent coverage in desktop Firefox/mobile Chromium in addition to its four-browser matrix. The dedicated workflow is `.github/workflows/b4-functional-regression-extended.yml`.

## Route-to-test coverage matrix

| Requested journey | Generated TanStack route(s) | Authoritative coverage |
| --- | --- | --- |
| Homepage → categories → search/filters → listing | `/`, `/categories`, `/category/$slug`, `/syria/$slug`, `/listings`, `/listings/$id` | #881 UI transitions, `marketplace-smoke.spec.ts`, `search-results-design.spec.ts`, **supplemental B4** search trim/sort URL persistence and reload |
| Listing → storefront → contact | `/listings/$id`, `/seller/$id`, `/login`, `/chats` | #881 and `authenticated-messaging-journey.spec.ts`, **supplemental B4** returnTo redirect with guest identity |
| Login → account → profile/preferences | `/login`, `/auth/callback`, `/reset-password`, `/profile`, `/more` | #881 validation; existing `authenticated-account-profile-journey.spec.ts`, `b3-account-family.spec.ts`, **supplemental B4** route inventory |
| Listing → draft → editing → My Store | `/add-listing`, `/profile/listings`, `/profile/listings/$id` | `authenticated-critical-journey.spec.ts`, `authenticated-owner-listing-lifecycle-journey.spec.ts`, `b2-listing-editor-acceptance.spec.ts`; **supplemental B4** route inventory only |
| Favorites, saved searches, offers, promotions | `/favorites`, `/saved-searches`, `/offers`, `/promotion`, `/promotion-request` | `authenticated-saved-discovery-journey.spec.ts`, `authenticated-price-offers-journey.spec.ts`; **supplemental B4** route inventory |
| Messaging, notifications, activity | `/chats`, `/notifications`, `/activity` | `authenticated-messaging-journey.spec.ts`, `authenticated-notifications-journey.spec.ts`; **supplemental B4** route inventory |
| Support, reporting, safety, verification | `/support`, `/safety`, `/verification`, `/prohibited`, `/privacy`, `/terms` and listing reporting | `b3-trust-support.spec.ts`, #881 safe contact, **supplemental B4** route inventory |
| All administration and authorization | `/admin` plus 15 generated child routes | **Merged #881 generated route matrix**, `scripts/admin-security-regression.mjs`; supplemental B4 intentionally does not repeat it |

## Additional deterministic test cases

| Behavior | Assertion | State |
| --- | --- | --- |
| Direct home → category link | Public category directory opens and renders | Playwright four-browser CI |
| Home search | Trimmed `q` in URL; filter sort persists through reload | Playwright four-browser CI |
| Listing details | Search results navigate to fixture listing detail | Playwright four-browser CI |
| Seller contact | Public storefront and listing contact actions render; anonymous message redirects to login with returnTo | Playwright four-browser CI |
| Temporary listing API failure | Local 503 presents visible recovery action; accessible results after recovery | Playwright four-browser CI |
| Empty listing response | Explicit empty state, zero listing cards | Playwright four-browser CI |
| 20 public and guest-facing direct routes | Hydration and usable main region, Arabic RTL and English LTR, no remote write | Playwright four-browser CI |

The existing suite also covers loading/pending-route behavior (`marketplace-smoke.spec.ts`) and UI validation (`#881`/authenticated fixture suites).

## Environment and safety

- Playwright is permitted only when `RAWAJ_E2E_USE_FIXTURES=1` **and** `E2E_BASE_URL` is absent.
- The Vite server uses local immutable public fixtures and isolated Firebase ordinary-user fixture. Never send writes to the live `rawa-j.com` backend.
- Four targets: `mobile-chromium`, `desktop-chromium`, `desktop-firefox`, `mobile-webkit` (WebKit emulation; not a physical iPhone Safari test).
- Browser Smoke, Quality Gate, CodeQL, Semgrep and deployment lock remain independent merge gates.

## Authenticated coverage limitations

Real Firebase/OAuth sign-in, production buyer-to-seller delivery, actual notification/push propagation, live moderator/owner-positive admin actions, real payments, manual verification and moderation outcomes **are not independently proven** by these fixtures. Existing isolated authenticated tests are relevant supporting evidence, not proof of production end-to-end success.

## Reproduction

```bash
npm ci
npx playwright install --with-deps chromium firefox webkit
RAWAJ_E2E_USE_FIXTURES=1 VITE_PUBLIC_DATA_API_BASE_URL=http://127.0.0.1:4173 \
VITE_RAWAJ_E2E_DISABLE_REMOTE_MEDIA=1 npx playwright test \
e2e/b4-functional-acceptance.spec.ts --project=mobile-chromium \
--project=desktop-chromium --project=desktop-firefox --project=mobile-webkit
```

## Defect register

No confirmed **product** defect has been identified from the supplemental browser assertions. Earlier test-only failures were caused by requiring a second network request even when the recovery state was correct; the test expectation was corrected without touching product code. Product defects must be logged separately with severity, affected route, expected vs actual behavior, browser and exact reproduction steps.

## Merge criterion and CI evidence

The supplemental PR must remain open until Quality Gate, dedicated four-browser B4, required Browser Smoke shards, CodeQL, Semgrep and deployment lock all pass **on the final reconciled HEAD**. Report final commit, PR number, and checks from GitHub rather than inferring success from code inspection.
