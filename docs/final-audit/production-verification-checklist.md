# Production Verification Checklist

No item is considered verified until evidence is captured from Supabase, Vercel, the live site, an authenticated account, or an Android device as applicable. Repository presence, a merged PR, and a passing build do not prove Production application.

## Release identity

- [ ] exact `main` release commit recorded
- [ ] deployed Vercel commit matches the release commit
- [ ] Supabase project and environment recorded
- [ ] verification timestamp and actor recorded

## Supabase schema truth

- [ ] `supabase_migrations.schema_migrations` availability checked
- [ ] tables and columns
- [ ] primary, unique, foreign-key, and check constraints
- [ ] indexes
- [ ] triggers
- [ ] functions and procedures, including definitions and `search_path`
- [ ] grants and revokes
- [ ] RLS enabled state and policies
- [ ] custom types and enums
- [ ] storage buckets and limits
- [ ] storage policies
- [ ] extensions
- [ ] Realtime publication membership
- [ ] replica identity
- [ ] scheduled jobs and external schedulers
- [ ] Auth settings available through supported Production interfaces

## Phase 0 release-blocker migrations

- [ ] `202607160002_require_listing_moderation_audit.sql` reviewed against the release commit
- [ ] `202607160002_require_listing_moderation_audit.sql` applied in the controlled environment
- [ ] review RPC signature verified
- [ ] moderation action and audit log confirmed mandatory in `pg_get_functiondef`
- [ ] approve acceptance test writes listing state, moderation action, and audit log
- [ ] reject acceptance test writes listing state, moderation action, and audit log
- [ ] notification failure does not erase an otherwise audited decision
- [ ] `202607160003_enable_chat_realtime.sql` reviewed against the release commit
- [ ] `202607160003_enable_chat_realtime.sql` applied in the controlled environment
- [ ] `conversations` appears in `supabase_realtime`
- [ ] `conversation_messages` appears in `supabase_realtime`
- [ ] both chat tables retain RLS
- [ ] participant-only SELECT policies retained
- [ ] `authenticated` has SELECT through RLS
- [ ] `anon` has no SELECT on either chat table

## Realtime behavioral proof

- [ ] participant A sends a message to participant B
- [ ] participant B receives the change within the accepted latency target
- [ ] reconnect restores synchronization without duplicates
- [ ] unread state updates correctly
- [ ] non-participant C receives no conversation event
- [ ] non-participant C receives no message event
- [ ] logout removes or invalidates the prior account channel
- [ ] account switching does not retain the prior account workspace

## Reconciliation proof

- [ ] repository migration inventory mapped to Production history where history exists
- [ ] duplicate versions documented without blind renaming
- [ ] canonical/superseded/historical/manual/reconciliation classification complete
- [ ] every migration has a verified or explicitly unknown Production state
- [ ] clean replay passes
- [ ] Production-like upgrade replay passes
- [ ] reconciliation migrations tested in staging
- [ ] Production application recorded
- [ ] post-deploy object verification passes
- [ ] full Production catalog extraction refreshed on the release commit

## Required proof bundle

- [ ] `supabase/verification/20260716_phase_0_production_proof.sql` executed read-only
- [ ] every result set exported
- [ ] all boolean expectations reviewed
- [ ] unexpected rows or false values entered in the defect register
- [ ] sensitive values redacted before storage

## Release evidence retained

- [ ] exact queries or exported reports retained
- [ ] timestamps recorded
- [ ] actor/environment recorded
- [ ] release commit recorded
- [ ] sensitive values redacted
- [ ] unresolved differences entered in the defect register
- [ ] rollback decision and owner recorded
