-- RAWAJ dedicated ad-placement media storage contract.
--
-- Keeps owner-managed advertising banners out of profile-media so banner uploads
-- have an explicit 5 MiB limit and owner-only write boundary. Existing image_url
-- values remain valid; this migration does not rewrite historical placements.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ad-placement-media',
  'ad-placement-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "RAWAJ ad placement media public read" on storage.objects;
create policy "RAWAJ ad placement media public read"
on storage.objects for select
using (bucket_id = 'ad-placement-media');

drop policy if exists "RAWAJ owner uploads ad placement media" on storage.objects;
create policy "RAWAJ owner uploads ad placement media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'ad-placement-media'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.role::text = 'owner'
      and p.account_status = 'active'
  )
);

drop policy if exists "RAWAJ owner updates ad placement media" on storage.objects;
create policy "RAWAJ owner updates ad placement media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'ad-placement-media'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.role::text = 'owner'
      and p.account_status = 'active'
  )
)
with check (
  bucket_id = 'ad-placement-media'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.role::text = 'owner'
      and p.account_status = 'active'
  )
);

drop policy if exists "RAWAJ owner deletes ad placement media" on storage.objects;
create policy "RAWAJ owner deletes ad placement media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'ad-placement-media'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.role::text = 'owner'
      and p.account_status = 'active'
  )
);
