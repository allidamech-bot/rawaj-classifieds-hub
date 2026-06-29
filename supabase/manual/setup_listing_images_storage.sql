-- RAWAJ listing images storage setup.
-- Manual-only file: review and run from Supabase Dashboard SQL Editor.
-- Do not run with Supabase CLI. Do not run from Lovable Cloud.
-- Do not add service-role keys to frontend code.

-- Design:
-- Bucket: listing-images
-- Visibility: public bucket.
--
-- Rationale:
-- RAWAJ is a public classifieds marketplace. Public listing images need to be
-- displayed to anonymous visitors without privileged server code or signed URLs.
-- Database visibility still controls which image rows the app renders. A direct
-- public object URL may be reachable if known, so do not store private documents,
-- IDs, phone numbers, or sensitive images in this bucket.
--
-- Path convention:
-- {auth.uid()}/{listing_id}/{random-file-name}.{jpg|jpeg|png|webp}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "RAWAJ listing images public read" on storage.objects;
create policy "RAWAJ listing images public read"
on storage.objects for select
using (bucket_id = 'listing-images');

drop policy if exists "RAWAJ listing owners upload images" on storage.objects;
create policy "RAWAJ listing owners upload images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.owner_id = auth.uid()
      and l.status in ('draft', 'pending_review', 'rejected')
  )
);

drop policy if exists "RAWAJ listing owners update own images" on storage.objects;
create policy "RAWAJ listing owners update own images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.owner_id = auth.uid()
      and l.status in ('draft', 'pending_review', 'rejected')
  )
)
with check (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.owner_id = auth.uid()
      and l.status in ('draft', 'pending_review', 'rejected')
  )
);

drop policy if exists "RAWAJ listing owners delete own images" on storage.objects;
create policy "RAWAJ listing owners delete own images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'listing-images'
  and (
    (
      (storage.foldername(name))[1] = auth.uid()::text
      and exists (
        select 1
        from public.listings l
        where l.id::text = (storage.foldername(name))[2]
          and l.owner_id = auth.uid()
          and l.status in ('draft', 'pending_review', 'rejected')
      )
    )
    or public.rawaj_is_owner_or_admin()
  )
);

-- Verification checklist after running:
-- 1. Confirm storage.buckets has listing-images with public = true.
-- 2. Confirm anonymous visitors can render public approved listing images from URLs stored in public.listing_images.
-- 3. Confirm signed-out users cannot upload.
-- 4. Confirm a signed-in user cannot upload into another user's path.
-- 5. Confirm a listing owner can upload only before approval.
-- 6. Confirm approved listing image changes require owner/admin moderation path or a separate future workflow.
--
-- Safe rollback notes:
-- - Disable new uploads by dropping the insert/update/delete policies above.
-- - Do not delete the bucket or objects unless the project owner intentionally wants to remove uploaded assets.
