-- RAWAJ listing schema contract reconciliation.
-- Makes the current application contract explicit even when an older production database
-- missed one of the incremental lifecycle/location migrations.

alter table public.listings
  add column if not exists status_changed_at timestamptz not null default now(),
  add column if not exists expires_at timestamptz,
  add column if not exists renewed_at timestamptz,
  add column if not exists expiry_days smallint,
  add column if not exists location_node_id uuid;

alter table public.listings drop constraint if exists listings_expiry_days_check;
alter table public.listings
  add constraint listings_expiry_days_check
  check (expiry_days is null or expiry_days in (30, 60, 90));

-- Add the canonical location FK only when the taxonomy table exists, without changing taxonomy data.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'location_nodes'
  ) then
    alter table public.listings drop constraint if exists listings_location_node_id_fkey;
    alter table public.listings
      add constraint listings_location_node_id_fkey
      foreign key (location_node_id) references public.location_nodes(id)
      on delete set null;
  end if;
end $$;

create index if not exists listings_public_expiry_idx
  on public.listings (status, expires_at)
  where status = 'approved';
create index if not exists listings_location_node_idx
  on public.listings (location_node_id);

-- Preserve the status timestamp contract if an older database missed it.
create or replace function public.rawaj_touch_listing_status_changed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists listings_touch_status_changed_at on public.listings;
create trigger listings_touch_status_changed_at
before update of status on public.listings
for each row execute function public.rawaj_touch_listing_status_changed_at();

comment on column public.listings.location_node_id is
  'Canonical Syria location node selected for the listing; governorate_id remains the marketplace compatibility key.';
