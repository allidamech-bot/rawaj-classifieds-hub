# RAWAJ Cloudflare Production Freeze

Cloudflare Production is intentionally operated through one path only:

- Workflow: `.github/workflows/cloudflare-production-worker-deploy.yml`
- Trigger: manual `workflow_dispatch` from `main`
- Runtime release: an explicitly reviewed commit SHA
- Credential source: the `production` environment secret `CLOUDFLARE_PRODUCTION_API_TOKEN`
- API domain: `https://api.rawa-j.com`

## Frozen boundaries

- No automatic Worker deployment from `push` or `pull_request`.
- No D1 migration in the Worker deployment workflow.
- No Vercel deployment from the Worker deployment workflow.
- No fallback to the legacy generic `CLOUDFLARE_API_TOKEN` secret.
- No temporary one-shot deployment workflows.
- No automatic rollback.

## Permanent token

Create one dedicated Cloudflare user API token from the official **Edit Cloudflare Workers** template and name it `RAWAJ Production Worker Deploy`. Store it only as the GitHub `production` environment secret `CLOUDFLARE_PRODUCTION_API_TOKEN`.

The workflow performs a read-only Worker-service permission preflight before dependency installation. If the token is missing, stale, IP-restricted, scoped to another account, or lacks effective Workers Scripts access, the deployment stops immediately with a targeted error.

## Normal operation

Cloudflare dashboard configuration remains frozen. Future reviewed Worker code releases use the same manual workflow and the same dedicated token. If no Worker code changes are required, no Cloudflare action is required.
