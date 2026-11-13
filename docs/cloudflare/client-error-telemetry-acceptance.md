# Client runtime error telemetry — isolated acceptance and production proof

**Scope:** browser runtime errors only. This does not replace existing Worker security/SSR logging, and it does not certify production observability until a real deployed-build canary is observed in Cloudflare logs.

## Data boundary

- Client error capture already exists in `src/lib/client-error-monitoring.ts` and `src/routes/__root.tsx`. The previous `window.__lovableEvents` hook may not be installed; do not rely on it as a guaranteed remote sink.
- `src/lib/lovable-error-reporting.ts` now sends a privacy-limited event to the **already configured** `VITE_PUBLIC_DATA_API_BASE_URL` Worker at `POST /v1/telemetry/client-errors`. No alternate host, telemetry credentials, Firebase token, or third-party account is required. If the Worker URL is absent, events are **not delivered** and must not be reported as collected.
- Browser traffic is bounded to three events per minute per active module instance. The Worker additionally applies the existing abuse rate limit.
- The event payload contains **only** version 1, mechanism, a fixed boundary, fixed severity, broad route group, strict build-commit SHA or `unknown`, and an allowlisted error class. **Never** send raw exceptions, messages, stacks, URLs, query strings, access tokens, auth identifiers, messages, listing details, or PII.
- The Worker strictly validates Origin against configured CORS origins, JSON type, maximum body size (1024 bytes), **exact** set of field names, and enumerated values. It returns 202 with no stateful D1/R2 mutation on valid receipt. Invalid intake is rejected before logging.
- Logs contain `event=client_runtime_error`, request ID and those allowlisted fields; they do **not** include request headers or client IP. This is a Worker **log event**, not a durable issue database or a third-party alert integration. Durability, searchable retention, alerting and export require separately configured Cloudflare logging / log delivery.

## Automated acceptance (no production access)

1. `node --test scripts/client-error-telemetry-contract.test.mjs` executes the browser reporter against a fake Worker transport and verifies delivery, allowlisted fields, no secrets in the payload, configuration failure behavior, and the three-per-minute cap.
2. `npm run test:setup --prefix cloudflare/worker`, `npm run test:fixtures --prefix cloudflare/worker`, then `cd cloudflare/worker && node --test --test-concurrency=1 test/marketplace.integration.test.mjs`. The real local Worker receives a valid event and returns 202 with CORS and request ID; unknown fields, cross-origin writes, missing Origin, wrong content type, oversized bodies, and GET are rejected.
3. Quality Gate runs both suites. These checks do not confirm Cloudflare production log retention or production deployment identity.

## After owner-managed deployment (manual, opt-in)

1. Identify the exact deployed Vercel and Cloudflare Worker revisions; verify the frontend `rawaj-build-commit` meta marker and Worker route availability. Neither a GitHub merge nor a green CI run proves production deployment.
2. Open an authorized Cloudflare Worker log viewer/tail or configured log destination **before** issuing the test request. Use an isolated, harmless canary from an allowed website origin (e.g., a manually constructed version-1 POST with `boundary:other` and `errorName:Error`) using only approved metadata. Do not trigger real application errors or include any user data.
3. Verify HTTP `202`, capture its `X-Request-Id`, and find exactly that ID in the Worker logs with `event=client_runtime_error` and the pinned build SHA. Check that no raw message, token, query string, IP, or stack appears.
4. Also verify a deliberately malformed payload is rejected with 400 without creating a client error log event and that a disallowed Origin returns 403.
5. If durable history or alerts are required, configure approved Cloudflare log retention/delivery and verify retrieval outside the Worker ephemeral tail before declaring production error monitoring complete.

**Do not publish or modify production to execute repository CI.** This runbook intentionally leaves production validation and logging-account configuration with the product owner / authorized operator.
