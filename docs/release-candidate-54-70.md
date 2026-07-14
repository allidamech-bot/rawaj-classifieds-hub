# RAWAJ phases 54–70 release candidate

This document defines the repository-owned completion criteria for phases 54–70. External acceptance evidence remains mandatory where the repository cannot produce it.

## Performance and observability

- Phase 54: the production client build must preserve multiple JavaScript chunks.
- Phase 55: single-asset and total JavaScript/CSS budgets run after every Quality Gate production build.
- Phase 56: root boundaries, global browser errors, and unhandled promise rejections are captured with build and route context after credential redaction.

## Critical user journeys

- Phase 57: login, callback, reset-password, and authenticated acceptance routes are regression-tested.
- Phase 58: profile, seller storefront, profile media, account listings, verification, and deletion-request paths remain covered.
- Phase 59: add and edit listing routes stay bound to the shared listing studio and image contracts.
- Phase 60: URL-driven listings discovery, categories, filters, and Syria taxonomy contracts remain required.
- Phase 61: chats, notifications, activity, and more/account routes are included in browser and authenticated acceptance.

## Administration, security, and moderation

- Phase 62: admin navigation and actions stay permission-gated and covered by admin security regression tests.
- Phase 63: public data exposure, RLS-facing API behavior, storage access, and migration ledger checks remain mandatory.
- Phase 64: privacy disclosure and the authenticated account-deletion request flow remain present.
- Phase 65: authentication rate-limit feedback, content flags, reports, and abuse signals remain covered. Supabase dashboard rate-limit values require external configuration evidence.
- Phase 66: pending moderation, safety review, reports, and prohibited-content guidance remain linked and tested.

## Compatibility and presentation

- Phase 67: the release workflow runs Chromium, Firefox, and WebKit projects; pull-request smoke remains Chromium-only for cost and speed.
- Phase 68: release journeys verify RTL semantics, keyboard reachability, reduced-motion behavior, and mobile overflow protection.
- Phase 69: the copy-quality gate rejects placeholder copy and empty Arabic/English labels.

## Phase 70 — Release Candidate

The manual `Release Candidate` workflow certifies one exact commit and produces:

- the built web output;
- the performance-budget result through the full repository checks;
- cross-browser release-journey results;
- an Android debug APK produced from the same commit;
- a machine-readable release candidate manifest.

The following items cannot be truthfully completed by repository automation alone and remain hard external gates:

1. Production deployment of the exact candidate commit.
2. Authenticated Production Acceptance using the dedicated acceptance account.
3. Physical Android device validation of OAuth return, custom scheme handling, and verified App Links.
4. A valid `/.well-known/assetlinks.json` containing the real release certificate SHA-256 fingerprint.
5. Release keystore signing, Play App Signing verification, version publication, and Play Console review evidence.
6. Confirmed Supabase Auth rate-limit and provider settings in the Production dashboard.

A candidate must not be described as fully launched until those external records are attached to the release decision.
