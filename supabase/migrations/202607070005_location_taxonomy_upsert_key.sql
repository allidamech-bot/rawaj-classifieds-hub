-- RAWAJ location taxonomy import upsert-key hardening.
-- Manual-only migration. Requires 202607070001 through 202607070004.

-- PostgREST/Supabase upsert conflict inference needs a plain unique index for
-- onConflict=external_source,external_id. PostgreSQL unique indexes already
-- allow multiple NULL values, so the previous partial predicate is unnecessary.
drop index if exists public.location_nodes_source_external_uidx;

create unique index if not exists location_nodes_source_external_uidx
  on public.location_nodes(external_source, external_id);
