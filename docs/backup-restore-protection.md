# Syria backup and restore protection

This procedure applies only to RAWAJ Syria. It must never be used for Saudi Arabia or Gateway.

## Fixed production identity

- Worker: `rawaj-classifieds-hub`
- Worker URL: `https://rawaj-classifieds-hub.allidamech.workers.dev`
- D1: `rawaj-staging`
- D1 ID: `d0e6496c-9f63-48d3-beeb-d2e219500f6a`
- R2: `rawaj-listing-images-production`
- Firebase: `project-af18fcaf-c46e-4ec5-93a`

The D1 audit/backup command validates every identifier above from the generated Syria config before
issuing a remote read. It refuses an arbitrary `--database` value. Backups must be written outside
the repository to a private, access-controlled directory; the manifest records the immutable D1 ID,
Worker, R2 bucket, Firebase project, row counts, and SHA-256 checksums.

## D1 backup

Render and review the Syria production config locally, then run the existing read-only
`audit-production-d1.mjs` command with an outside-repository backup directory and report path. Abort
if any identity check fails. Never supply a config or database name from another repository.

## R2 backup

Inventory and download only from `rawaj-listing-images-production`. Preserve object keys, size,
ETag, content type, ownership metadata, and checksums. Verification must not copy objects into a
production bucket.

## Restore

Production restore is prohibited during routine validation. A future restore must:

1. Require an explicit destination and verify its immutable D1 ID or exact R2 bucket identity.
2. Require a Syria-specific approval phrase and a reviewed backup manifest.
3. Reject every Saudi and Gateway identifier before any write.
4. Rehearse first against an isolated local D1 database or disposable non-production bucket.
5. Verify counts, checksums, foreign keys, ownership, and media metadata before separate production approval.

No current repository command performs a generic production restore. The reconciliation rehearsal is
local-only and cannot target production.
