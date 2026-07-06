-- RAWAJ: Complete pending_review owner lock
-- Manual review required. Do not apply automatically from frontend tooling.
--
-- This provides complete owner lock during pending_review while preserving:
-- - draft editing and first submission
-- - rejected editing and resubmission
-- - moderator/admin transitions
-- - safe delete semantics
--
-- Required Live-state dependency:
--   - Migration 202607050002 should be applied first

-- listings UPDATE: Owner lock for draft/rejected/pending_review rows
-- BUT allow status transition to pending_review for submission/resubmission
-- The USING clause allows reading the row; WITH CHECK must allow submit transition
-- Helper function for checking if owner can write to listing (draft/rejected/pending_review status)
create or replace function public.rawaj_listing_owner_can_write(target_listing_id uuid)
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
      and l.status in ('draft', 'pending_review', 'rejected')
  );
$$;

comment on function public.rawaj_listing_owner_can_write(uuid) is
  'Returns true if owner controls listing with draft/pending_review/rejected status.';

-- Override: Owner can write/update the row (USING allows row access)
-- WITH CHECK allows status transition to pending_review for submission
-- Note: Moderators have separate policies for moderation

-- listing_images INSERT/UPDATE/DELETE: Only draft/rejected allowed (not pending_review)
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
  'Returns true only if owner can add images (draft or rejected status). Blocks during pending_review.';

-- listing_images policies (INSERT/UPDATE/DELETE blocked during pending_review)
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

drop policy if exists "Listing owners delete images before approval" on public.listing_images;
create policy "Listing owners delete images before approval"
on public.listing_images for delete
to authenticated
using (public.rawaj_listing_owner_can_add_images(listing_id));

-- storage.objects policies for listing-images bucket
-- Must align with listing_images policies for owner mutations during draft/rejected only
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'objects'
  ) then
    -- INSERT: Only draft/rejected listings can have images uploaded
    execute $policy$
      create or replace policy "Authenticated users upload own listing images"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'listing-images'
        and (storage.foldername(name))[1] = auth.uid()::text
        and public.rawaj_safe_uuid((storage.foldername(name))[2]) is not null
        and exists (
          select 1
          from public.listings l
          where l.id = public.rawaj_safe_uuid((storage.foldername(name))[2])
            and l.owner_id = auth.uid()
            and l.status in ('draft', 'rejected')
        )
      )
    $policy$;

    -- UPDATE: Only draft/rejected listings can have images updated
    execute $policy$
      create or replace policy "Authenticated users update own listing images"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'listing-images'
        and (storage.foldername(name))[1] = auth.uid()::text
        and public.rawaj_safe_uuid((storage.foldername(name))[2]) is not null
        and exists (
          select 1
          from public.listings l
          where l.id = public.rawaj_safe_uuid((storage.foldername(name))[2])
            and l.owner_id = auth.uid()
            and l.status in ('draft', 'rejected')
        )
      )
      with check (
        bucket_id = 'listing-images'
        and (storage.foldername(name))[1] = auth.uid()::text
        and public.rawaj_safe_uuid((storage.foldername(name))[2]) is not null
        and exists (
          select 1
          from public.listings l
          where l.id = public.rawaj_safe_uuid((storage.foldername(name))[2])
            and l.owner_id = auth.uid()
            and l.status in ('draft', 'rejected')
        )
      )
    $policy$;

    -- DELETE: Only draft/rejected listings can have images deleted via direct Storage API
    -- Note: Owner deletion flow uses deleteListingImage() which has app-level guard
    -- This policy must align to prevent bypass during pending_review
    execute $policy$
      create or replace policy "Authenticated users delete own listing images"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'listing-images'
        and (storage.foldername(name))[1] = auth.uid()::text
        and public.rawaj_safe_uuid((storage.foldername(name))[2]) is not null
        and exists (
          select 1
          from public.listings l
          where l.id = public.rawaj_safe_uuid((storage.foldername(name))[2])
            and l.owner_id = auth.uid()
            and l.status in ('draft', 'rejected')
        )
      )
    $policy$;
  end if;
end $$;