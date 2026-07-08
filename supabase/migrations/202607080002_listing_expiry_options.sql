-- RAWAJ Customer Journey Integrity: explicit owner-selectable listing expiry options.
-- null expiry_days means no automatic expiry.

alter table public.listings
  add column if not exists expiry_days smallint;

alter table public.listings
  drop constraint if exists listings_expiry_days_check;

alter table public.listings
  add constraint listings_expiry_days_check
  check (expiry_days is null or expiry_days in (30, 60, 90));

create index if not exists listings_public_expiry_idx
  on public.listings (status, expires_at)
  where status = 'approved';

create or replace function public.rawaj_apply_listing_expiry_on_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'approved'
     and (
       old.status is distinct from 'approved'
       or new.expiry_days is distinct from old.expiry_days
     ) then
    if new.expiry_days is null then
      new.expires_at = null;
    else
      new.expires_at = now() + make_interval(days => new.expiry_days);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists listings_apply_expiry_on_approval on public.listings;
create trigger listings_apply_expiry_on_approval
before update of status, expiry_days on public.listings
for each row execute function public.rawaj_apply_listing_expiry_on_approval();

comment on column public.listings.expiry_days is
  'Owner-selected listing lifetime in days: 30, 60, 90, or null for no automatic expiry.';
