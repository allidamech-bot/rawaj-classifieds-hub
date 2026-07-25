# RAWAJ Phases 41–50 Release Readiness

This document is the repository source of truth for launch-readiness closure from Phase 41 through Phase 50. It records only repository-verifiable controls. Production and real-device claims remain separate manual gates.

## Phase 41 — Security review

Repository controls:

- SSR responses receive CSP, HSTS on HTTPS, anti-framing, MIME-sniffing protection, strict referrer policy, permissions policy, COOP and CORP headers.
- Authentication callback, login and reset-password responses are non-cacheable.
- Public listing and seller reads use explicit field allowlists rather than wildcard selects.
- JSON-LD serialization neutralizes script-breaking characters.
- Upload validation rejects empty, unsupported or oversized listing, profile and receipt files before Storage work.
- Owner, moderation and trust writes retain ownership, permission and stale-write protection.

Acceptance evidence: `src/server.ts`, `scripts/public-data-security.test.mjs`, `scripts/auth-recovery.test.mjs`, `scripts/listing-studio-v3.test.mjs`, and the the retired backend security contracts executed by Quality Gate.

## Phase 42 — SEO, indexing and structured data

Repository controls:

- Canonical URLs and crawler directives are generated centrally.
- Organization and WebSite structured data are emitted at the root.
- Listing pages emit honest category-aware schema without fabricated claims.
- Dynamic sitemap and robots behavior are covered by permanent tests.

Acceptance evidence: `src/lib/seo.ts`, `scripts/seo-discovery.test.mjs`, `scripts/semantic-seo.test.mjs`, and `scripts/dynamic-sitemap.test.mjs`.

## Phase 43 — Core Web Vitals

Repository controls:

- Primary and card media reserve intrinsic dimensions.
- Non-primary media uses lazy loading and asynchronous decoding.
- Critical media can retain eager loading and fetch priority.
- Full-screen media UI is code-split.
- Duplicate public reads are coalesced and successful placement reads use a short cache.
- Vercel Analytics is mounted once at the root.

Acceptance evidence: adaptive listing-card, listing-detail, public-ad, SSR and production-build contracts.

## Phase 44 — Mobile 320–430px

Repository controls:

- The app shell owns dynamic viewport height, safe-area and keyboard insets.
- Mobile controls use minimum functional text and touch-target contracts.
- Header, bottom dock, listing cards, search, filters and listing studio have dedicated mobile regression contracts.
- Offline state is accessible and non-destructive.

Acceptance evidence: design-foundation, header-navigation, bottom-dock, spatial-app-shell, search/filter and listing-studio contracts plus Browser Smoke.

## Phase 45 — Tablet and desktop through 1920px

Repository controls:

- Canonical page widths, gutters and content rhythms replace page-local width systems.
- Marketplace, reading and form surfaces retain separate intentional maximum widths.
- Desktop layout behavior is protected by the Desktop Experience contract.

Acceptance evidence: page-layout foundation/migration contracts, Desktop Experience contract and Browser Smoke.

## Phase 46 — Accessibility

Repository controls:

- Semantic `main` and navigation regions are present.
- Active navigation exposes `aria-current`.
- Keyboard focus rings, readable unread labels, live offline status and reduced-motion rules are protected.
- Image fallbacks preserve meaningful alternative text or decorative semantics.
- Error and empty states provide actionable controls.

Acceptance evidence: design, header, dock, communication, account, listing-detail and shell contracts.

## Phase 47 — PWA, Capacitor Android and deep links

Repository controls:

- A standalone RTL Arabic web manifest declares 192px and 512px icons.
- Capacitor keeps package identity `com.rawaj.marketplace`, HTTPS-only production URL and a narrow RAWAJ navigation allowlist.
- Android signing secrets are ignored and release identity is regression-tested.
- Android OAuth and deep-link work remains subject to its dedicated real-device gate and must not be represented as production-accepted solely from repository CI.

Acceptance evidence: `public/manifest.webmanifest`, `capacitor.config.ts`, Android launch-readiness contracts and Android-specific workflows.

## Phase 48 — Analytics and error monitoring

Repository controls:

- Vercel Analytics is mounted once in the root shell.
- Root route errors are reported through the application error reporter.
- Catastrophic SSR errors are captured, normalized to a safe HTML response and protected by security headers.
- Build identity metadata is emitted to support deployment diagnosis.

Acceptance evidence: `src/routes/__root.tsx`, `src/server.ts`, `src/lib/error-capture.ts`, `src/lib/lovable-error-reporting.ts`, and deployment-truth contracts.

## Phase 49 — Final automated test matrix

Every merge candidate must pass:

1. migration ledger and collision validation;
2. changed-file linting;
3. all product and launch regression contracts;
4. TypeScript typecheck;
5. listing-system regression;
6. production build;
7. Browser Smoke for browser-affecting changes.

Production acceptance remains manual-only, read-only and commit-identity checked.

## Phase 50 — Repository cleanup, production truth and rollback

Repository rules:

- `main` is changed only through a reviewed PR with green Quality Gate and diff review.
- No temporary patcher, workflow, noop file, generated secret, signing key or local credential may remain in the merge diff.
- Source-controlled migrations are not described as applied to Production without independent evidence.
- The deployed commit identity is exposed and checked before production acceptance.
- Rollback means redeploying the last verified production commit. Database rollback is never assumed and requires a forward-safe migration plan.
- Open Android release-candidate PRs remain separate until real-device gates and external redirect/asset-link configuration are verified.

## Closure boundary

Phases 41–50 are repository-closed when `scripts/phases-41-50-release-readiness.test.mjs`, full Quality Gate and Browser Smoke pass. This closure does not claim completion of the later production and real-phone release gate.
