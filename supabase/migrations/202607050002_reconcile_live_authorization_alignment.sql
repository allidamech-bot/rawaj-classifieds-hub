-- RAWAJ narrow authorization reconciliation.
-- Manual review required. Do not apply automatically from frontend tooling.
--
-- Reconciles confirmed Live drift between 202607020003 intent and current
-- Live authorization state. Does not replay 202607020003 blindly.
--
-- Scope:
-- - platform catalog management stays owner-only
-- - moderation read/update expands to active moderator role
-- - hard delete remains owner-only
-- - moderation field protection triggers are added
-- - storage moderation access aligns with table-level moderation policies

-- A. Platform catalog management
drop policy if exists "Admin-like manages categories" on public.categories;
drop policy if exists "Owner manages categories" on public.categories;
create policy "Owner manages categories"
on public.categories for all
to authenticated
using (public.current_user_can_manage_roles())
with check (public.current_user_can_manage_roles());

drop policy if exists "Admin-like manages subcategories" on public.subcategories;
drop policy if exists "Owner manages subcategories" on public.subcategories;
create policy "Owner manages subcategories"
on public.subcategories for all
to authenticated
using (public.current_user_can_manage_roles())
with check (public.current_user_can_manage_roles());

drop policy if exists "Admin-like manages governorates" on public.governorates;
drop policy if exists "Owner admins manage governorates" on public.governorates;
drop policy if exists "Owner manages governorates" on public.governorates;
create policy "Owner manages governorates"
on public.governorates for all
to authenticated
using (public.current_user_can_manage_roles())
with check (public.current_user_can_manage_roles());

-- taxonomy_nodes already matches owner-only intent. leave unchanged.

-- B. Listing moderation read
drop policy if exists "Admin-like reads all listings" on public.listings;
drop policy if exists "Privileged moderators read all listings" on public.listings;
create policy "Privileged moderators read all listings"
on public.listings for select
to authenticated
using (public.current_user_can_moderate());

-- C. Listing moderation update
drop policy if exists "Admin-like moderates listings" on public.listings;
drop policy if exists "Owner admins moderate listings" on public.listings;
drop policy if exists "Privileged moderators update listing moderation" on public.listings;
create policy "Privileged moderators update listing moderation"
on public.listings for update
to authenticated
using (public.current_user_can_moderate())
with check (public.current_user_can_moderate());

-- D. Listing moderation field protection
create or replace function public.rawaj_protect_listing_moderation_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_can_manage_roles() then
    return new;
  end if;

  if not public.current_user_can_moderate() then
    return new;
  end if;

  if (to_jsonb(new) - array[
        'status',
        'reviewed_by',
        'reviewed_at',
        'rejection_reason',
        'published_at',
        'archived_at',
        'updated_at'
      ])
     is distinct from
     (to_jsonb(old) - array[
        'status',
        'reviewed_by',
        'reviewed_at',
        'rejection_reason',
        'published_at',
        'archived_at',
        'updated_at'
      ])
  then
    raise exception 'Moderators can only change moderation-safe fields on listings.';
  end if;

  return new;
end;
$$;

drop trigger if exists listings_protect_moderation_update on public.listings;
create trigger listings_protect_moderation_update
before update on public.listings
for each row execute function public.rawaj_protect_listing_moderation_update();

-- E. Listing hard delete
drop policy if exists "Admin-like deletes listings" on public.listings;
drop policy if exists "Owner deletes listings" on public.listings;
create policy "Owner deletes listings"
on public.listings for delete
to authenticated
using (public.current_user_can_manage_roles());

-- F. Listing image metadata moderation read
drop policy if exists "Admin-like reads all listing images" on public.listing_images;
drop policy if exists "Privileged moderators read all listing images" on public.listing_images;
create policy "Privileged moderators read all listing images"
on public.listing_images for select
to authenticated
using (public.current_user_can_moderate());

-- G. Listing image metadata hard delete
drop policy if exists "Admin-like deletes listing images" on public.listing_images;
drop policy if exists "Owner deletes listing images" on public.listing_images;
create policy "Owner deletes listing images"
on public.listing_images for delete
to authenticated
using (public.current_user_can_manage_roles());

-- H. Listing reports read/update
drop policy if exists "Admin-like reads listing reports" on public.listing_reports;
drop policy if exists "Owner admins read listing reports" on public.listing_reports;
drop policy if exists "Privileged moderators read listing reports" on public.listing_reports;
create policy "Privileged moderators read listing reports"
on public.listing_reports for select
to authenticated
using (public.current_user_can_moderate());

drop policy if exists "Admin-like moderates listing reports" on public.listing_reports;
drop policy if exists "Owner admins moderate listing reports" on public.listing_reports;
drop policy if exists "Privileged moderators update listing reports" on public.listing_reports;
create policy "Privileged moderators update listing reports"
on public.listing_reports for update
to authenticated
using (public.current_user_can_moderate())
with check (public.current_user_can_moderate());

-- I. Listing report field protection
create or replace function public.rawaj_protect_listing_report_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_can_manage_roles() then
    return new;
  end if;

  if not public.current_user_can_moderate() then
    return new;
  end if;

  if new.reporter_id is distinct from old.reporter_id
    or new.report_type is distinct from old.report_type
    or new.reason is distinct from old.reason
    or new.listing_id is distinct from old.listing_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Moderators can only change moderation-safe fields on listing reports.';
  end if;

  return new;
end;
$$;

drop trigger if exists listing_reports_protect_update on public.listing_reports;
create trigger listing_reports_protect_update
before update on public.listing_reports
for each row execute function public.rawaj_protect_listing_report_update();

-- J. Storage moderation read
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage' and table_name = 'objects'
  ) then
    execute 'drop policy if exists "Admin-like reads all listing image objects" on storage.objects';
    execute 'drop policy if exists "Privileged moderators read listing image objects" on storage.objects';
    execute '
      create policy "Privileged moderators read listing image objects"
      on storage.objects for select
      to authenticated
      using (
        bucket_id = ''listing-images''
        and public.current_user_can_moderate()
      )
    ';

    execute 'drop policy if exists "Admin-like deletes listing image objects" on storage.objects';
    execute 'drop policy if exists "Owner deletes listing image objects" on storage.objects';
    execute '
      create policy "Owner deletes listing image objects"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = ''listing-images''
        and public.current_user_can_manage_roles()
      )
    ';
  end if;
end $$;
