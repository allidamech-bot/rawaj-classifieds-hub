# Production D1 reconciliation — 2026-07-24

## Outcome

The production schema was compared with a clean local database after migrations
`0001`–`0003`. The effective application schema was compatible: there were no
material mismatches in tables, columns, types, nullability, defaults, primary
keys, foreign keys, unique indexes, ordinary indexes, triggers, or FTS5
objects. The only additional production object was Wrangler's
`d1_migrations` bookkeeping table.

The comparison tool wrote the machine-readable report outside the repository:

`%LOCALAPPDATA%\Temp\rawaj-d1-post0003-comparison.json`

## Comparison summary

| Object class                            | Expected after 0003 | Production before reconciliation |
| --------------------------------------- | ------------------: | -------------------------------: |
| Tables                                  |                  50 |                               51 |
| Indexes (`sqlite_master`)               |                  47 |                               47 |
| Triggers                                |                   3 |                                3 |
| Columns                                 |                 473 |                              476 |
| Foreign keys                            |                  67 |                               67 |
| Index definitions (`PRAGMA index_list`) |                 113 |                              114 |
| Indexed columns                         |                 342 |                              344 |
| Material mismatches                     |                   0 |                                0 |

The count differences are entirely attributable to `d1_migrations` and its
index metadata. Both sides contained the `listings_fts` FTS5 virtual table and
its expected shadow objects.

## Backup

Wrangler's whole-database export could not serialize the FTS5 virtual table.
Before any bookkeeping write, the audit tool therefore:

- captured the complete production schema SQL;
- exported all 45 ordinary application tables individually as JSON;
- captured non-sensitive aggregate row counts;
- recorded the FTS5 virtual and shadow objects as explicitly excluded; and
- wrote a SHA-256 manifest for the backup.

The private backup is outside the repository:

`%LOCALAPPDATA%\Temp\rawaj-d1-table-backup-20260724`

Manifest SHA-256:

`ae1806501fb3d237ab2a3f24efa1660953ad6cdf12972e0c67e02eaa062723cf`

No emails, password hashes, recovery hashes, session tokens, or message bodies
are included in this document.

## Bookkeeping and migrations

After compatibility was established, the following rows were inserted into
`d1_migrations` without executing their DDL:

|  ID | Name                                     |
| --: | ---------------------------------------- |
|   1 | `0001_catalog_foundation.sql`            |
|   2 | `0002_public_marketplace_foundation.sql` |
|   3 | `0003_full_backend_core.sql`             |

Wrangler then applied:

- `0004_favorites_saved_searches_messaging.sql`
- `0005_auth_recovery_legacy_media.sql`

The final migration ledger contains IDs 1 through 5 in order.

## Data and integrity verification

These aggregate counts were unchanged before and after reconciliation:

| Table                   | Rows |
| ----------------------- | ---: |
| `auth_users`            |   17 |
| `profiles`              |   17 |
| `listings`              |   34 |
| `listing_images`        |    0 |
| `favorites`             |    0 |
| `saved_searches`        |    0 |
| `conversations`         |    3 |
| `conversation_messages` |    9 |

Post-migration checks found:

- 0 listings with a missing owner;
- 0 profiles without an authentication user;
- 0 conversations with missing participants;
- 0 messages with a missing conversation or sender; and
- 0 rows returned by `PRAGMA foreign_key_check`.

The new columns and indexes introduced by migrations 0004 and 0005 were also
verified directly. No application table was dropped, recreated, renamed,
truncated, or rewritten.

## Reproduction

The comparison and backup are performed by:

`cloudflare/worker/scripts/audit-production-d1.mjs`

It requires explicit production configuration, writes its evidence outside the
repository by default, and refuses to report compatibility when a material
schema difference is present.
