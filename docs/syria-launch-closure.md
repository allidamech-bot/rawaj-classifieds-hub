# RAWAJ Syria launch closure ledger

This ledger is the canonical closure sequence for the remaining Syria-only launch work. Saudi Arabia expansion is explicitly outside this scope and must not start until all eight gates below are closed.

## Non-negotiable release boundaries

- Never apply a new migration directly to Production before an independent Staging apply and rollback rehearsal.
- Never merge or promote a release while a required acceptance gate is red or lacks evidence.
- Never publish a debug, upload-key, placeholder, or guessed Android certificate fingerprint.
- Never delete Storage objects from an audit result alone. Deletion requires a reviewed candidate manifest, retention window, backup evidence, and a separate approved operation.
- Merging repository code does not authorize Supabase dashboard changes, Production SQL, Vercel Production promotion, or Google Play publication.

## Eight remaining Syria gates

| # | Gate | Repository state | External / high-risk closure evidence | Status |
| --- | --- | --- | --- | --- |
| 1 | Close SYP denomination Phase A | Implemented in PR #480 with migration, rollback, contracts, browser smoke, local replay, and Android RC validation | Independent Supabase Staging branch/project; migration apply; pre/post price checksum; old/new journeys; rollback rehearsal; evidence attached to PR #480; then review and merge | BLOCKED — paid Staging approval required |
| 2 | Implement SYP denomination Phase B | Must remain unstarted while Phase A is unproven on Staging and existing SYP rows are not classified | Stable Phase A Production observation, classification completion criteria, separate design/branch/migration/rehearsal | DEFERRED BY SAFETY |
| 3 | Deploy and measure the Egress mitigation | PR #475 is merged; permanent polling was removed and signed-media reads were deduplicated/cached | Controlled Production deployment followed by clean baseline and post-deployment measurements that exclude Preview/CI traffic; verify request and byte reduction over a representative window | READY AFTER GATE 1 |
| 4 | Complete Supabase Auth production configuration | Redirect and recovery code/contracts are merged; canonical callback is `/auth/callback` | Supabase Site URL and redirect allowlist evidence; Google provider/OAuth evidence; leaked-password protection decision; real registration, Google sign-in, and password-recovery tests | EXTERNAL CONFIGURATION REQUIRED |
| 5 | Complete Android verified App Links | Fail-closed `assetlinks.json` endpoint and Android intent-filter contract are merged | Play App Signing SHA-256; Production environment injection; HTTP 200/no-redirect evidence; package/fingerprint match; physical Play-signed device verification | EXTERNAL CREDENTIAL REQUIRED |
| 6 | Run Production Acceptance | Manual workflow and guarded E2E suite exist | Exact reviewed commit deployed to `rawa-j.com`; dedicated acceptance account secrets; all Production journeys pass; no destructive residue | BLOCKED BY GATES 1, 4, 5 |
| 7 | Build and release Android through Internal Testing | Android Release Candidate workflow is green on the Phase A head | Final merged commit AAB, version review, Play Console upload, Internal Testing install, authentication/App Links/push/smoke evidence | BLOCKED BY GATES 1–6 |
| 8 | Audit and clean Storage | Repeatable read-only audit is repository-owned; Production snapshot recorded below | Zero missing objects and zero orphan candidates, or a separately reviewed cleanup manifest and deletion operation | COMPLETE — NO DELETION REQUIRED |

## Production Storage integrity snapshot

A read-only transaction was executed against the `listing-images` bucket on 2026-07-21. No Storage object or database row was modified.

| Metric | Result |
| --- | ---: |
| Storage objects | 57 |
| `listing_images` rows | 57 |
| Total object bytes | 5,470,293 |
| Storage objects without a `listing_images` row | 0 |
| `listing_images` rows without a Storage object | 0 |
| Duplicate `storage_path` groups | 0 |
| Orphan bytes | 0 |

Six duplicate content-signature groups were observed. Identical content is not an orphan condition and is not deletion authority because each object may belong to a distinct listing or upload lifecycle.

The repeatable query is stored at `scripts/sql/listing-images-storage-integrity-audit.sql`. It is read-only and must remain free of `DELETE`, `UPDATE`, `INSERT`, object-removal calls, or DDL.

## Egress measurement protocol

The mitigation cannot be declared complete from Preview or CI logs. Browser Smoke, Playwright, Node-based checks, and repeated Preview navigation can generate the same signed URL pattern as users.

1. Record the exact Production build SHA and deployment timestamp.
2. Export comparable Supabase Storage logs for a pre-deployment and post-deployment window.
3. Summarize each export with `node scripts/summarize-supabase-storage-logs.mjs <export-file>`.
4. Separate likely automation from likely user traffic using the emitted actor classification; manually review unknown user agents.
5. Compare at minimum:
   - `POST /object/sign/listing-images` request count;
   - signed object download count and response bytes when present;
   - repeated signing requests for the same object/path;
   - request counts per likely-user session or representative journey;
   - Supabase dashboard Egress bytes over the same duration.
6. Do not close Gate 3 until the deployed commit is proven and a representative observation window shows the reduction. A repository build pass alone is not Egress evidence.

## Current safe execution result

- Gate 8 is closed without deletion because the live read-only audit is clean.
- Gates 1, 3, 4, 5, 6, and 7 contain completed repository preparation but require external state or credentials.
- Gate 2 is intentionally sequenced after Phase A validation and observation.
- The next authorized state-changing action is creation of an independent Supabase Staging branch/project only after explicit approval of its hourly cost.
