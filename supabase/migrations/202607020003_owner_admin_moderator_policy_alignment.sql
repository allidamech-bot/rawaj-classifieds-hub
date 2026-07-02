-- RAWAJ owner/admin/moderator policy alignment.
-- Manual review required. Do not apply automatically from frontend tooling.

-- Platform taxonomy/location management is owner-only. Public active reads stay public.
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

-- Moderation surfaces are available to active owner/admin/moderator roles.
drop policy if exists "Admin-like reads all listings" on public.listings;
drop policy if exists "Privileged moderators read all listings" on public.listings;
create policy "Privileged moderators read all listings"
on public.listings for select
to authenticated
using (public.current_user_can_moderate());

drop policy if exists "Admin-like moderates listings" on public.listings;
drop policy if exists "Owner admins moderate listings" on public.listings;
drop policy if exists "Privileged moderators update listing moderation" on public.listings;
create policy "Privileged moderators update listing moderation"
on public.listings for update
to authenticated
using (public.current_user_can_moderate())
with check (public.current_user_can_moderate());

create or replace function public.rawaj_protect_listing_moderation_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('rawaj.promotion_moderation', true) = 'on' then
    if (to_jsonb(new) - array['is_featured', 'featured_until', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['is_featured', 'featured_until', 'updated_at'])
    then
      raise exception 'Moderators can only change promotion fields during promotion moderation.';
    end if;

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

-- Hard deletion remains owner-only. Normal admins/moderators should moderate, not erase.
drop policy if exists "Admin-like deletes listings" on public.listings;
drop policy if exists "Owner deletes listings" on public.listings;
create policy "Owner deletes listings"
on public.listings for delete
to authenticated
using (public.current_user_can_manage_roles());

drop policy if exists "Admin-like reads all listing images" on public.listing_images;
drop policy if exists "Privileged moderators read all listing images" on public.listing_images;
create policy "Privileged moderators read all listing images"
on public.listing_images for select
to authenticated
using (public.current_user_can_moderate());

drop policy if exists "Admin-like deletes listing images" on public.listing_images;
drop policy if exists "Owner deletes listing images" on public.listing_images;
create policy "Owner deletes listing images"
on public.listing_images for delete
to authenticated
using (public.current_user_can_manage_roles());

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

create or replace function public.rawaj_protect_listing_report_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

-- Listing image storage objects: moderators can review/read, only owner role can hard delete.
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

-- Audited account status RPCs for owner/admin safety work.
-- Moderators cannot freeze/unfreeze users. Owners cannot be targeted by admin.
create or replace function public.rawaj_set_account_status(
  target_user_id uuid,
  next_status public.rawaj_account_status,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_role public.rawaj_user_role;
  target_is_owner boolean;
begin
  if actor is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.current_user_is_admin_like() then
    raise exception 'Only active owner/admin users can change account status.';
  end if;

  if target_user_id is null then
    raise exception 'Target user is required.';
  end if;

  if target_user_id = actor then
    raise exception 'Users cannot change their own account status through this RPC.';
  end if;

  select public.rawaj_current_user_primary_role() into actor_role;

  select exists (
    select 1
    from public.user_roles
    where user_id = target_user_id
      and role = 'owner'::public.rawaj_user_role
  ) into target_is_owner;

  if target_is_owner and not public.current_user_can_manage_roles() then
    raise exception 'Only owner can target another owner account.';
  end if;

  update public.profiles
  set account_status = next_status,
      updated_at = now()
  where id = target_user_id;

  if not found then
    raise exception 'Target profile was not found.';
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, target_table, target_id, metadata)
  values (
    actor,
    actor_role,
    'account_status_changed',
    'profiles',
    target_user_id::text,
    jsonb_build_object('next_status', next_status::text, 'reason', nullif(btrim(coalesce(reason, '')), ''))
  );
end;
$$;

revoke execute on function public.rawaj_set_account_status(uuid, public.rawaj_account_status, text) from public;
grant execute on function public.rawaj_set_account_status(uuid, public.rawaj_account_status, text) to authenticated;

comment on function public.rawaj_set_account_status(uuid, public.rawaj_account_status, text) is
  'Audited owner/admin RPC for freezing, unfreezing, disabling, or reactivating accounts without exposing broad profile update policies.';
