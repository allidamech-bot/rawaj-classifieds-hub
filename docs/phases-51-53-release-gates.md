# RAWAJ phases 51–53 release gates

## Phase 51 — Production acceptance

Production acceptance is valid only when the manual production workflow runs against `https://rawa-j.com`, the deployed build exposes the expected commit identity, and the read-only Playwright suite completes without critical console, hydration, page, or request failures. Repository contracts are not a substitute for that run.

## Phase 52 — Android real-device gate

Android release acceptance requires a physical device and external configuration evidence for OAuth return, App Links, SHA fingerprints, package identity, signing, version identity, and Play Console configuration. Repository checks may validate static configuration, but they must not claim real-device acceptance.

## Phase 53 — Remaining image resilience

Administrative and private media surfaces must use a resilient image renderer that reserves dimensions at the call site, provides meaningful alternative text, defaults to lazy loading and async decoding, disables dragging unless needed, and renders a non-sensitive fallback after a broken or expired URL. Signed and private URLs must remain unchanged and must not be converted to public URLs.
