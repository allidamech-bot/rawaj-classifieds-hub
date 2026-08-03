# Syria provider finalization runbook

This runbook makes the existing RAWAJ production stack explicitly Syria-owned after the Saudi destination has been provisioned, migrated, reconciled, and accepted. It must not interrupt `rawa-j.com` or the current Google Play application.

## Current ownership

- Syria frontend and canonical origin: `https://rawa-j.com`
- Syria API: `https://rawaj-classifieds-hub.allidamech.workers.dev`
- Existing Vercel project: `rawaj-classifieds-hub`
- Existing Firebase project: retained for Syria
- Existing Worker, D1, and R2 resources: retained for Syria until controlled cleanup

## Mandatory order

1. Create GitHub protected environments `syria-preview` and `syria-production`.
2. Install the existing Syria Firebase Web configuration in Vercel and protected environments.
3. Install current Syria Cloudflare D1/R2 IDs and a least-privilege Worker token in `syria-production`.
4. Run the provider preflight locally or through a protected manual workflow.
5. Create a Vercel preview and verify authentication and marketplace journeys.
6. Run the read-only D1 reconciliation report.
7. Create and externally retain an encrypted D1 backup.
8. Complete Saudi user/data/media migration and destination reconciliation.
9. Remove Saudi-only identities/data from Syria only after rollback approval.
10. Rotate any credentials that were previously shared between markets.
11. Re-run Syria reconciliation, backup, and preview acceptance.
12. Merge the Syria hardening PR only after all required environment values are installed.

## Syria Vercel configuration

Install these values in Development, Preview, and Production as appropriate:

- `VITE_PUBLIC_DATA_PROVIDER=cloudflare`
- `VITE_PUBLIC_DATA_API_BASE_URL=https://rawaj-classifieds-hub.allidamech.workers.dev`
- `VITE_SITE_URL=https://rawa-j.com`
- `VITE_SYRIA_FIREBASE_API_KEY`
- `VITE_SYRIA_FIREBASE_AUTH_DOMAIN`
- `VITE_SYRIA_FIREBASE_PROJECT_ID`
- `VITE_SYRIA_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_SYRIA_FIREBASE_APP_ID`

Create `syria-preview` with:

- secret `VERCEL_TOKEN`
- variables `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- the Syria Firebase Web values
- the existing Syria D1/R2 identifiers used by provider preflight

The preview workflow may deploy only to a `vercel.app` URL. It cannot attach or alias the production domain.

## Syria Cloudflare protected environment

Create `syria-production` and require manual approval.

Secrets:

- `CLOUDFLARE_PRODUCTION_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `BACKUP_ENCRYPTION_PASSPHRASE`

Variables:

- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_D1_DATABASE_NAME`
- `CLOUDFLARE_R2_BUCKET_NAME`
- `SYRIA_FIREBASE_PROJECT_ID`

Use a token scoped only to the intended Syria Worker and required D1/R2 operations. Do not copy tokens into repository files, logs, issues, or chat.

## Manual workflows

All production-capable workflows require:

- execution from the current `main` head;
- an exact 40-character commit SHA;
- an operation-specific approval phrase;
- approval of the protected GitHub environment;
- passing provider preflight.

Available operations:

- Worker deployment: `DEPLOY_RAWAJ_SYRIA_PRODUCTION`
- Read-only reconciliation: `AUDIT_RAWAJ_SYRIA_PRODUCTION`
- Encrypted D1 backup: `BACKUP_RAWAJ_SYRIA_PRODUCTION`
- Vercel preview: `DEPLOY_RAWAJ_SYRIA_PREVIEW`

No workflow automatically modifies DNS, removes user data, deletes media, or publishes Android.

## Firebase ownership cleanup

The existing Firebase project remains active for Syria. Before removing any Saudi identity:

1. Build the approved Saudi UID allowlist from Saudi application ownership records.
2. Verify those UIDs exist in the destination Firebase project.
3. Test destination login and recovery flows.
4. Preserve encrypted migration and rollback evidence.
5. Remove only approved Saudi UIDs from the Syria project.
6. Verify Syria user counts and login flows after cleanup.

Never export/import the entire shared Firebase directory into the Saudi project.

## Data and media cleanup

Do not delete Saudi records or objects from Syria resources until destination reconciliation confirms counts, relationships, checksums, and live journeys. Take encrypted backups immediately before cleanup and test restoration in isolation.

The aggregate reconciliation workflow must report zero for broken foreign keys, missing media references, unsupported currencies, and non-Syria location codes after cleanup.

## Android

The current package `com.rawaj.marketplace` and its signing material remain unchanged. Country selection, dual-domain App Links, authentication routing, and notification routing are a later single-app project.
