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

## Isolated restore rehearsal (offline; no production changes)

After obtaining a fresh, **privately stored** Syria D1 export and preserving its manifest SHA-256
separately, run this on a controlled host with Node.js 22 or later:

```sh
node cloudflare/worker/scripts/rehearse-syria-d1-backup.mjs \\
  --backup-dir=/absolute/private/syria-d1-backup \\
  --expected-manifest-sha256=<independently-recorded-64-hex-sha256>
```

This is an **in-memory** isolated SQLite reconstruction. It validates identity and every file
against a separately pinned manifest, recreates base tables and data, checks every restored row,
recreates indexes/views/triggers, reconstructs the deliberately omitted `listings_fts` FTS5
index from `listings`, and fails closed if foreign keys do not reconcile. Unsupported virtual
tables or row formats are not reported as a successful recovery.

CI tests only synthetic snapshots and rejection cases. **No real Syria snapshot has been
restored by CI.** Completion of recovery acceptance additionally requires a real snapshot
in an isolated environment, validated API/search behavior and separate R2 media restore
checks. No command above communicates with or writes to production D1/R2; do not place
real backup files, manifest pins, or private reports in the repository.

## Offline R2 media validation against D1 (no remote access)

A separately exported R2 backup may be checked only after preserving original keys,
ETags, HTTP metadata and custom metadata. Store it **outside this repository** with
the following content-addressed layout (same SHA-256 blob may serve multiple keys):

- `manifest.json`: `schemaVersion: 1`, pinned Syria `bucket`, `worker`,
  `databaseId`, `firebaseProject`, and `objects`.
- Each object entry: `key`, lowercase `sha256`, `byteSize`, original `etag`,
  `httpMetadata` (including `contentType`), optional `customMetadata` and
  optional `ownerId` when established independently from D1.
- Each exact payload: `objects/<sha256>`. This keeps arbitrary R2 keys as
  manifest data, never as filesystem traversal paths.

Run only after **independently** recording both manifest SHA-256 pins:

```sh
node cloudflare/worker/scripts/verify-syria-r2-backup.mjs \\
  --r2-dir=/private/syria-r2-backup \\
  --r2-sha256=<independently-recorded-r2-manifest-sha256> \\
  --d1-dir=/private/syria-d1-backup \\
  --d1-sha256=<independently-recorded-d1-manifest-sha256>
```

The verifier checks each payload's cryptographic digest and length, duplicates,
unexpected blob files, Syria-specific resource identity, and that every
`media_assets.status = 'ready'` D1 record has a matching R2 key, content checksum,
content type, ETag and byte size. If the manifest provides `ownerId`, it must
match D1's `owner_id`. **ETags are compared as opaque metadata, never used as
an MD5 or SHA-256 substitute.**

**Boundary:** this verifier does not export anything from R2 or prove a real R2
backup exists. Its CI tests use synthetic local media only. A separate
read-only production inventory/download, isolated upload-and-retrieve rehearsal,
and app-level image access acceptance are required before claiming recovery ready.
