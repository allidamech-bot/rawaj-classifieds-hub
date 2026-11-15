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

## Atomic source cutover contract

Run `npm run test:cloudflare-edge-cutover`. The script is **offline/read-only**.
It currently returns `mode: "legacy"`, because production is intentionally pinned.

For a later approved change, these must move **together** and pass the test:

- `.env.production`: `VITE_PUBLIC_DATA_API_BASE_URL=https://api.rawa-j.com`
- `vercel.json`: both `/v1/:path*` and `/api/:path*` rewrites to the matching host
- `cloudflare/worker/wrangler.base.jsonc`: `workers_dev: false`, `preview_urls: false`,
  explicit `routes: [{ "pattern": "api.rawa-j.com", "custom_domain": true }]`
- `cloudflare/worker/scripts/render-config.mjs`: change the explicit custom-domain
  rejection only after the authorized target has been validated and reviewed
- `.github/workflows/cloudflare-production-worker-deploy.yml`: keep manual SHA-gated
  `syria-production` protection and use the protected health/smoke origin

**Important:** Passing static tests is never proof that Cloudflare DNS, WAF, TLS,
permissions, or Vercel encrypted production environment values are correct.
The script prevents a partial *source* cutover, not an infrastructure incident.

## Release sequence

1. Verify protected endpoint and WAF policies in Cloudflare, without production routing changes.
2. Obtain a change window and explicit owner approval for Worker/domain and frontend rollout.
3. Stage the complete source configuration. Pass all Quality Gate, browser/WebKit,
   security, account, media and read-only remote tests.
4. Deploy the authorized Cloudflare Worker version through its guarded manual workflow.
   Keep the old hostname reachable during the handoff.
5. Update and deploy Vercel production configuration to the new origin. Verify the
   exact deployed commit, Vercel environment variables and user journeys.
6. Disable `workers.dev` only after the new route is independently confirmed
   operational and the source Wrangler config will keep it disabled on redeploy.
7. Monitor Worker invocation totals, WAF blocks, error 1027, authentication and media.
   Roll back only using reviewed versions and the recorded original settings.

## Explicit exclusions

No automatic DNS, Zone, Cloudflare Access, WAF, Worker, D1, R2 or Firebase changes.
Do not use a Saudi account, unrelated token, or shared production credentials.
Do not introduce a second paid service as an assumed prerequisite.

References: Cloudflare Workers Custom Domains and workers.dev documentation;
Cloudflare Workers plan limits and WAF rate-limiting rules.
