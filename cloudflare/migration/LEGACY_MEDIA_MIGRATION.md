# RAWAJ legacy media migration

This tooling reads Supabase as a legacy source and writes only to Wrangler's
local D1/R2 persistence by default. It has no remote or Production apply mode.
Source records and objects are never modified.

## Source discovery

The exporter reads these legacy sources:

- `public.listing_images.storage_path` from the private `listing-images` bucket;
- `public.ad_placements.image_url`;
- `public.profiles.avatar_path` and `cover_path` from `profile-media`;
- `public.profiles.avatar_url` and `cover_url` when a storage path is absent.

Stable Supabase primary keys are retained as `sourceId`. Listing images map by
`listing_id`; profile media maps by the unchanged profile/user UUID. Titles,
display names, filenames, and array positions are never used for identity.

Copy `legacy-media.env.example` to an ignored local environment file and supply
read-only source credentials. Never prefix privileged values with `VITE_`.

## Commands

Export a repeatable read-only snapshot and enriched media manifest:

```powershell
node .\cloudflare\migration\export-public-snapshot.mjs
```

Plan a bounded batch without reading objects or writing D1/R2:

```powershell
node .\cloudflare\migration\legacy-media-migrate.mjs --dry-run --entities=all --batch-size=50 --report=.\cloudflare\migration-report.local.json
```

Apply to local Wrangler persistence only:

```powershell
node .\cloudflare\migration\legacy-media-migrate.mjs --apply --target=local --entities=listing-images,promotional-media,profile-media --persist-to=.wrangler/state --report=.\cloudflare\migration-report.local.json
```

Resume after the last machine-readable checkpoint:

```powershell
node .\cloudflare\migration\legacy-media-migrate.mjs --apply --target=local --resume-after=listing_image:SOURCE_ID --batch-size=50
```

Reconcile D1 links and migration-ledger counts without source access:

```powershell
node .\cloudflare\migration\legacy-media-migrate.mjs --reconcile-only --target=local --report=.\cloudflare\migration-report.local.json
```

Reports contain source IDs and failure categories, but never credentials,
recovery tokens, or object contents. `cloudflare/migration-report.local.json`
is local output and must not be committed.

## Safety and reruns

- Dry-run performs no source download and no target write.
- `legacy_media_migrations` uniquely identifies every source entity.
- A completed ledger entry plus an existing R2 object is skipped on rerun.
- Objects are validated by signature, MIME agreement, non-empty content, and
  the 25 MiB size ceiling before upload.
- R2 keys are generated from the source identity and SHA-256 checksum; raw
  filenames are not trusted.
- The D1 media row, entity link, and ledger update are committed together.
- If D1 commit fails after upload, the tool attempts to delete the new R2
  object.
- Expired or not-yet-started advertisements are imported as drafts.
- Apply mode refuses every target except local Wrangler persistence.
