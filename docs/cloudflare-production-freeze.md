# RAWAJ Syria Cloudflare Production Freeze

Syria Cloudflare Production is intentionally operated through one path only:

- Workflow: `.github/workflows/cloudflare-production-worker-deploy.yml`
- Trigger: manual `workflow_dispatch` from `main`
- Runtime release: an explicitly reviewed commit SHA
- Protected environment: `syria-production`
- Credential secrets: `SYRIA_CLOUDFLARE_API_TOKEN` and `SYRIA_CLOUDFLARE_ACCOUNT_ID`
- Required credential scope variable: `SYRIA_CLOUDFLARE_CREDENTIAL_SCOPE=rawaj-classifieds-hub`
- Worker: `rawaj-classifieds-hub`
- D1: `rawaj-staging` (`d0e6496c-9f63-48d3-beeb-d2e219500f6a`)
- R2: `rawaj-listing-images-production`
- Firebase project: `project-af18fcaf-c46e-4ec5-93a`
- Production API endpoint: `https://rawaj-classifieds-hub.allidamech.workers.dev`

## Frozen boundaries

- No automatic Worker deployment from `push` or `pull_request`.
- No D1 migration in the Worker deployment workflow.
- No Vercel deployment from the Worker deployment workflow.
- No fallback to generic or Saudi Cloudflare secrets.
- No temporary one-shot deployment workflows.
- No custom-domain, Zone, route, or DNS mutation during Worker deployment.
- No dependency on `api.rawa-j.com`.
- No automatic rollback.
- No access to Saudi Worker, D1, R2, Firebase, Vercel, domain, or deployment resources.

## Dedicated credentials

Create credentials specifically scoped for the Syria Worker operation. Store them only in the GitHub `syria-production` environment under the names above. Do not copy a Saudi token, a generic personal token, or a token shared with another project.

The workflow performs a read-only Worker-service permission preflight against `rawaj-classifieds-hub` before dependency installation. Missing credentials, a wrong scope marker, another Worker target, or a different account context stops the deployment before any mutation.

## Normal operation

The live frontend uses the fixed workers.dev endpoint above. Future reviewed Syria Worker code releases use the same manual workflow, the same Syria-only credential namespace, and the same pinned D1/R2/Firebase identities. If no Syria Worker code changes are required, no Cloudflare action is required.
