# RAWAJ Syria — protected Cloudflare API cutover (owner-operated)

**Status:** NOT AUTHORIZED FOR LIVE CUTOVER. This is a read-only migration preparation guide.
The existing `workers.dev` production route, D1, R2 and Firebase must remain unchanged
until each prerequisite and rollback check is verified independently.

## Current verified architecture

- Vercel hosts `rawa-j.com`; `vercel.json` rewrites `/v1/*` and `/api/*` to
  `https://rawaj-classifieds-hub.allidamech.workers.dev`.
- Production frontend `.env.production` currently points to this same Worker origin.
- Cloudflare Wrangler currently sets `workers_dev: true`, `preview_urls: false`.
- `render-config.mjs` deliberately rejects any `CLOUDFLARE_WORKER_CUSTOM_DOMAIN`.
- The live Worker production deploy is manually protected. **Do not bypass it.**
- The Vercel production `VITE_PUBLIC_DATA_API_BASE_URL` environment variable is
  configured separately and must be verified in Vercel **before each cutover deploy**.
  Source-controlled `.env.production` is not proof of the actual build's environment.
- The Worker Free plan has a 100,000 request/day **account-wide** quota. Application
  cooldown and per-actor limits alone cannot stop unauthenticated direct Worker requests.

## External prerequisites — do not infer these from source code

1. Confirm the owner's Cloudflare account contains an **active** `rawa-j.com` zone
   and that `api.rawa-j.com` can be attached as a Worker Custom Domain.
   An existing CNAME or a zone hosted by another account blocks this operation.
2. Record Cloudflare Workers analytics for the last full day: total invocations,
   busiest routes, peak UTC hours, worker name, and error/1027 counts. If other
   Workers share the same Free plan, attribute their usage separately.
3. Add a **carefully scoped** Cloudflare WAF rate-limiting rule for `api.rawa-j.com`
   and the API/media routes; use real traffic data to select thresholds. Avoid
   indiscriminate blocking of legitimate shared-IP Syrian mobile users.
   Confirm unwanted requests are blocked **before** invoking Workers.
4. Test a protected custom domain in isolation: HTTPS/TLS, `/v1/health`,
   references, listings, images, public seller profiles, Firebase-authorized
   account requests, browser uploads, CORS and iPhone Safari/PWA. Check both
   Arabic RTL and English LTR. No D1 migration or production data mutation.
5. Ensure all public image URLs, server SSR API requests, Vercel external rewrites,
   and `VITE_PUBLIC_DATA_API_BASE_URL` resolve through the protected domain.
   Do not expose `workers.dev` through a fallback or an embedded absolute URL.
6. Prepare a pre-approved rollback release and previous Vercel environment values
   before changing live routing. Never disable the last working API endpoint first.

## Phase-aware source cutover contract

Run `npm run test:cloudflare-edge-cutover`. The guard is **offline/read-only**.
It currently returns `mode: "legacy"`, because production is intentionally pinned.
It rejects **split Vercel rewrite/frontend origins**, unsupported Worker routing,
unexpected deploy targets, and half-configured custom domains.

The following four deliberate phases support a zero-downtime transition:

1. **legacy:** `workers_dev: true`, no custom domain, old frontend API origin,
   old Vercel rewrites, old production smoke URL, explicit custom-domain freeze.
2. **staging:** Create and validate the new custom domain alongside the old route
   while Vercel and the frontend still use `workers.dev`. Keep `workers_dev: true`;
   the custom domain route is explicit and the custom-domain render freeze is
   removed only through an approved, reviewed change. Smoke still checks old live origin.
3. **cutover:** Switch `.env.production`, **both** Vercel rewrites, Vercel production
   environment variables, and smoke tests to `https://api.rawa-j.com`.
   Keep `workers_dev: true` **temporarily**, only until the new production
   deployment and all media/auth journeys pass. The old route is still vulnerable
   during this short handoff; do not leave the system in this state indefinitely.
4. **protected:** After independent acceptance, change `workers_dev: false`
   while retaining `preview_urls: false` and explicit
   `routes: [{ "pattern": "api.rawa-j.com", "custom_domain": true }]`.
   Verify old hostname is unreachable and future Wrangler redeploys keep it off.

For stages 2–4 the Worker must have the explicit Custom Domain route, and the
render-config freeze must be deliberately reviewed and updated. The manual
SHA-gated `syria-production` deployment flow and Syria-only D1/R2/Firebase
identity must remain intact throughout.

**Important:** A static source contract does not prove Cloudflare DNS, zone
ownership, WAF, TLS, Worker routing, mobile app configuration or Vercel
encrypted production environment values. The short-lived `cutover` phase
does not itself block bots on the old endpoint.

## Release sequence

1. Record Cloudflare usage and confirm ownership of the active domain zone,
   edge WAF/rate-limiting capability and route prerequisites.
2. Obtain explicit owner approval and a documented rollback procedure.
3. In `staging`, attach and test the protected custom domain without
   changing the frontend or disabling the old route; run manual read-only
   acceptance (health, listing/media, auth, CORS, PWA) and inspect WAF results.
4. In `cutover`, deploy the matching client/Vercel environment and rewrite
   changes using an exact reviewed SHA. Verify real browser and SSR routes.
5. In `protected`, disable `workers.dev` only after verified new-domain
   functionality. Confirm the Wrangler source will not re-enable it.
6. Monitor invocation totals, WAF blocks, Error 1027, auth and media failures.
   Revert only through reviewed versions and documented original settings.

## Explicit exclusions

No automatic DNS, Zone, Cloudflare Access, WAF, Worker, D1, R2 or Firebase changes.
Do not use a Saudi account, unrelated token, or shared production credentials.
Do not introduce a second paid service as an assumed prerequisite.

References: Cloudflare Workers Custom Domains and workers.dev documentation;
Cloudflare Workers plan limits and WAF rate-limiting rules.
