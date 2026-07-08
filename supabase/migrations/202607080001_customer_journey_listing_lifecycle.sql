-- RAWAJ Customer Journey Integrity: explicit listing lifecycle foundation.
-- Public discovery remains approved-only. Owner transitions are performed by
-- guarded application updates and remain subject to existing RLS policies.

alter table public.listings
  add column if not exists status_changed_at timestamptz not null default now(),
  add column if not exists expires_at timestamptz,
  add column if not exists renewed_at timestamptz;

alter table public.listings
  drop constraint if exists listings_status_check;

alter table public.listings
  add constraint listings_status_check
  check (
    status in (
      'draft',
      'pending_review',
      'approved',
      'rejected',
      'archived',
      'expired',
      'sold',
      'rented',
      'unavailable'
    )
  );

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

comment on column public.listings.status_changed_at is
  'Timestamp of the most recent listing lifecycle status transition.';
comment on column public.listings.expires_at is
  'Optional marketplace expiry timestamp used by listing renewal flows.';
comment on column public.listings.renewed_at is
  'Timestamp of the most recent owner renewal action.';
