-- Preserve meaningful favorite context even when a listing is no longer public.
-- The snapshot table intentionally does not foreign-key listing_id so history
-- can survive listing deletion. Rows remain private to their owning user.

create table if not exists public.favorite_listing_snapshots (
  user_id uuid not null,
  listing_id uuid not null,
  title_snapshot text not null,
  price_snapshot numeric,
  currency_snapshot text not null default 'SYP',
  status_snapshot text not null default 'approved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

alter table public.favorite_listing_snapshots enable row level security;

drop policy if exists favorite_listing_snapshots_select_own
  on public.favorite_listing_snapshots;
create policy favorite_listing_snapshots_select_own
  on public.favorite_listing_snapshots
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists favorite_listing_snapshots_insert_own
  on public.favorite_listing_snapshots;
create policy favorite_listing_snapshots_insert_own
  on public.favorite_listing_snapshots
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists favorite_listing_snapshots_update_own
  on public.favorite_listing_snapshots;
create policy favorite_listing_snapshots_update_own
  on public.favorite_listing_snapshots
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists favorite_listing_snapshots_delete_own
  on public.favorite_listing_snapshots;
create policy favorite_listing_snapshots_delete_own
  on public.favorite_listing_snapshots
  for delete
  to authenticated
  using (auth.uid() = user_id);

insert into public.favorite_listing_snapshots (
  user_id,
  listing_id,
  title_snapshot,
  price_snapshot,
  currency_snapshot,
  status_snapshot,
  created_at,
  updated_at
)
select
  f.user_id,
  f.listing_id,
  l.title,
  l.price,
  coalesce(l.currency, 'SYP'),
  l.status,
  f.created_at,
  now()
from public.favorites f
join public.listings l on l.id = f.listing_id
on conflict (user_id, listing_id) do nothing;

create index if not exists favorite_listing_snapshots_user_created_idx
  on public.favorite_listing_snapshots (user_id, created_at desc);
