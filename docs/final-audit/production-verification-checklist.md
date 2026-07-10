# Production Verification Checklist

No item is considered verified until evidence is captured from Supabase, Vercel, the live site, an authenticated account, or an Android device as applicable.

## Supabase schema truth

- [ ] `supabase_migrations.schema_migrations`
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
- [ ] scheduled jobs
- [ ] auth settings available through supported Production interfaces

## Reconciliation proof

- [ ] repository migration inventory mapped to Production history
- [ ] duplicate versions documented without blind renaming
- [ ] canonical/superseded/historical/manual/reconciliation classification complete
- [ ] every migration has a verified or explicitly unknown Production state
- [ ] clean replay passes
- [ ] Production-like upgrade replay passes
- [ ] reconciliation migration tested in staging
- [ ] Production application recorded
- [ ] post-deploy object verification passes

## Release evidence retained

- [ ] exact queries or exported reports retained
- [ ] timestamps recorded
- [ ] actor/environment recorded
- [ ] sensitive values redacted
- [ ] unresolved differences entered in the defect register
