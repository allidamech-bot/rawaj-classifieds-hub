-- RAWAJ listing image storage visibility reconciliation.
--
-- Purpose:
-- - keep listing-images private at the bucket level
-- - remove the legacy bucket-wide public SELECT policy
-- - allow public object reads only for approved, non-archived listings
-- - preserve existing owner/admin/moderator policies without redefining role semantics
--
-- Intentionally narrow and idempotent.

update storage.buckets
set public = false
where id = 'listing-images';

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage'
      and table_name = 'objects'
  ) then
    execute 'drop policy if exists "RAWAJ listing images public read" on storage.objects';
    execute 'drop policy if exists "Public reads approved listing image objects" on storage.objects';

    execute $policy$
      create policy "Public reads approved listing image objects"
      on storage.objects for select
      to public
      using (
        bucket_id = 'listing-images'
        and public.rawaj_safe_uuid((storage.foldername(name))[2]) is not null
        and exists (
          select 1
          from public.listings l
          where l.id = public.rawaj_safe_uuid((storage.foldername(objects.name))[2])
            and l.status = 'approved'
            and l.archived_at is null
        )
      )
    $policy$;
  end if;
end $$;
