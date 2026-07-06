-- RAWAJ listing-image mutation lock during review.
-- Manual review required. Do not apply automatically from frontend tooling.
--
-- Fresh-bootstrap correction:
-- The historical core migration allowed owner image writes while a listing was
-- pending_review. A later manual SQL file narrowed this to draft/rejected, but
-- manual files are not part of canonical migration replay. This migration makes
-- the intended lock part of the ordered migration chain.

create or replace function public.rawaj_listing_owner_can_add_images(target_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.listings l
    where l.id = target_listing_id
      and l.owner_id = auth.uid()
      and l.status in ('draft', 'rejected')
  );
$$;

comment on function public.rawaj_listing_owner_can_add_images(uuid) is
  'True only for the authenticated owner of a draft or rejected listing; pending_review image mutation is locked.';

-- Canonical listing_images metadata policies.
drop policy if exists "Listing owners add images before approval" on public.listing_images;
create policy "Listing owners add images before approval"
on public.listing_images for insert
to authenticated
with check (public.rawaj_listing_owner_can_add_images(listing_id));

drop policy if exists "Listing owners edit images before approval" on public.listing_images;
create policy "Listing owners edit images before approval"
on public.listing_images for update
to authenticated
using (public.rawaj_listing_owner_can_add_images(listing_id))
with check (public.rawaj_listing_owner_can_add_images(listing_id));

-- Remove the legacy broader owner-delete policy if it exists, then recreate the
-- intended editable-state delete policy.
drop policy if exists "Listing owners self-delete own listing images" on public.listing_images;
drop policy if exists "Listing owners delete images before approval" on public.listing_images;
create policy "Listing owners delete images before approval"
on public.listing_images for delete
to authenticated
using (public.rawaj_listing_owner_can_add_images(listing_id));

-- Align storage-object writes with metadata writes when Supabase Storage exists.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage'
      and table_name = 'objects'
  ) then
    execute 'drop policy if exists "Authenticated users upload own listing images" on storage.objects';
    execute $policy$
      create policy "Authenticated users upload own listing images"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'listing-images'
        and (storage.foldername(name))[1] = auth.uid()::text
        and public.rawaj_safe_uuid((storage.foldername(name))[2]) is not null
        and public.rawaj_listing_owner_can_add_images(
          public.rawaj_safe_uuid((storage.foldername(name))[2])
        )
      )
    $policy$;

    execute 'drop policy if exists "Authenticated users update own listing images" on storage.objects';
    execute $policy$
      create policy "Authenticated users update own listing images"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'listing-images'
        and (storage.foldername(name))[1] = auth.uid()::text
        and public.rawaj_safe_uuid((storage.foldername(name))[2]) is not null
        and public.rawaj_listing_owner_can_add_images(
          public.rawaj_safe_uuid((storage.foldername(name))[2])
        )
      )
      with check (
        bucket_id = 'listing-images'
        and (storage.foldername(name))[1] = auth.uid()::text
        and public.rawaj_safe_uuid((storage.foldername(name))[2]) is not null
        and public.rawaj_listing_owner_can_add_images(
          public.rawaj_safe_uuid((storage.foldername(name))[2])
        )
      )
    $policy$;

    execute 'drop policy if exists "Authenticated users delete own listing images" on storage.objects';
    execute $policy$
      create policy "Authenticated users delete own listing images"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'listing-images'
        and (storage.foldername(name))[1] = auth.uid()::text
        and public.rawaj_safe_uuid((storage.foldername(name))[2]) is not null
        and public.rawaj_listing_owner_can_add_images(
          public.rawaj_safe_uuid((storage.foldername(name))[2])
        )
      )
    $policy$;
  end if;
end $$;
