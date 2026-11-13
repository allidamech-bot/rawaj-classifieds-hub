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

The backup command now **fails before remote access** unless both paths are absolute, outside the
repository (including symlink-resolved paths), and unused. Put the new backup directory and
the separate report under private, access-controlled storage. The command creates its backup
directory with mode 0700 and all output files with mode 0600; it refuses to overwrite an old
snapshot or report. Keep the reported manifest SHA-256 in a separately protected record.

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


## Offline backup integrity verification (no production writes)

Before treating a new D1 snapshot as a usable backup, run:

```sh
node cloudflare/worker/scripts/verify-syria-d1-backup.mjs \\
  --backup-dir=/absolute/private/syria-d1-backup \\
  --expected-manifest-sha256=<sha256-from-the-audit-report>
```

The verifier reads only local backup files. It checks exact Syria Worker/D1/R2/Firebase
identifiers, the externally pinned manifest checksum, the exported schema checksum, the
complete ordinary-table list, every table's SHA-256 and row count, and every declared FTS
exclusion. It rejects duplicate manifest entries, corrupt files and symlinked table dumps.
A snapshot without the newer `schemaSha256` field is *not* accepted by this integrity
verifier; preserve old snapshots but create a fresh checked export rather than silently
claiming they have passed.

**Important:** A checksum-verified export is **not** a completed restore rehearsal.
Reconstruction, foreign-key checks and application-level acceptance on an isolated D1
database remain separate requirements before calling disaster recovery proven.
Never restore into production as part of this verification.
