-- RAWAJ: Complete pending_review owner lock for listing-images storage
-- Manual review required. Do not apply automatically from frontend tooling.
--
-- This reconciles owner image mutations so that:
-- - draft and rejected listings allow owner INSERT/UPDATE/DELETE
-- - pending_review listings block owner image mutations
-- - paths are ownership-bound and status-bound
--
-- Required Live-state dependencies:
--   - Migration 202607050002 should be applied first
--   - public.rawaj_safe_uuid(uuid) should exist
--   - storage.objects table should exist
--   - bucket_id = 'listing-images' should exist

BEGIN;

-- listing_images table policies (already idempotent via IF EXISTS)
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
drop policy if exists "Authenticated users upload own listing images" on storage.objects;
create policy "Authenticated users upload own listing images"
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
);

drop policy if exists "Authenticated users update own listing images" on storage.objects;
create policy "Authenticated users update own listing images"
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
);

drop policy if exists "Authenticated users delete own listing images" on storage.objects;
create policy "Authenticated users delete own listing images"
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
);

COMMIT;
