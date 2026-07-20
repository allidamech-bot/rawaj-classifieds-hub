-- RAWAJ Phase A rollback.
-- Rehearse only on a disposable Staging copy before any Production deployment.
-- The backup preserves classification evidence before additive columns are removed.

begin;

create table if not exists public.rawaj_syp_denomination_rollback_backup (
  captured_at timestamptz not null default now(),
  source_table text not null,
  row_key text not null,
  payload jsonb not null
);

comment on table public.rawaj_syp_denomination_rollback_backup is
  'Rollback backup for SYP denomination metadata. Remove only after rollback verification.';

insert into public.rawaj_syp_denomination_rollback_backup (source_table, row_key, payload)
select
  'listings',
  id::text,
  jsonb_build_object(
    'price', price,
    'currency', currency,
    'price_denomination', price_denomination,
    'price_new_syp_normalized', price_new_syp_normalized,
    'updated_at', updated_at
  )
from public.listings
where price_denomination <> 'unclassified'
on conflict do nothing;

drop function if exists public.rawaj_classify_syp_listing_price(uuid, text, timestamptz);
drop function if exists public.rawaj_list_unclassified_syp_prices();

drop index if exists public.listings_public_normalized_price_idx;

alter table public.listing_price_changes
  drop constraint if exists listing_price_changes_denomination_valid,
  drop column if exists new_price_new_syp_normalized,
  drop column if exists old_price_new_syp_normalized,
  drop column if exists new_price_denomination,
  drop column if exists old_price_denomination;

alter table public.favorite_listing_snapshots
  drop constraint if exists favorite_listing_snapshots_price_denomination_valid,
  drop column if exists price_new_syp_normalized_snapshot,
  drop column if exists price_denomination_snapshot;

alter table public.listings
  drop constraint if exists listings_price_denomination_valid,
  drop column if exists price_new_syp_normalized,
  drop column if exists price_denomination;

notify pgrst, 'reload schema';

commit;

-- Required follow-up: redeploy the pre-Phase-A function definitions from the baseline
-- migration bundle before accepting writes. This script intentionally preserves the
-- rollback backup instead of discarding classification evidence.
