-- RAWAJ listing-images Storage integrity audit
-- Safe to run against Production: the transaction is explicitly read-only and always rolled back.

begin transaction read only;

with storage_listing as (
  select
    id,
    name,
    created_at,
    updated_at,
    coalesce((metadata ->> 'size')::bigint, 0) as size_bytes,
    metadata ->> 'mimetype' as mime_type,
    metadata ->> 'eTag' as etag
  from storage.objects
  where bucket_id = 'listing-images'
),
image_rows as (
  select id, listing_id, storage_path, created_at
  from public.listing_images
),
storage_without_row as (
  select storage_listing.*
  from storage_listing
  left join image_rows on image_rows.storage_path = storage_listing.name
  where image_rows.id is null
),
rows_without_storage as (
  select image_rows.*
  from image_rows
  left join storage_listing on storage_listing.name = image_rows.storage_path
  where storage_listing.id is null
)
select jsonb_build_object(
  'generated_at', now(),
  'bucket_id', 'listing-images',
  'storage_object_count', (select count(*) from storage_listing),
  'storage_total_bytes', (select coalesce(sum(size_bytes), 0) from storage_listing),
  'listing_image_row_count', (select count(*) from image_rows),
  'storage_without_row_count', (select count(*) from storage_without_row),
  'storage_without_row_bytes', (select coalesce(sum(size_bytes), 0) from storage_without_row),
  'storage_without_row_older_than_7d', (
    select count(*)
    from storage_without_row
    where created_at < now() - interval '7 days'
  ),
  'storage_without_row_older_than_30d', (
    select count(*)
    from storage_without_row
    where created_at < now() - interval '30 days'
  ),
  'rows_without_storage_count', (select count(*) from rows_without_storage),
  'duplicate_storage_path_groups', (
    select count(*)
    from (
      select storage_path
      from image_rows
      group by storage_path
      having count(*) > 1
    ) duplicate_paths
  ),
  'duplicate_content_signature_groups', (
    select count(*)
    from (
      select etag, size_bytes
      from storage_listing
      where etag is not null
      group by etag, size_bytes
      having count(*) > 1
    ) duplicate_content
  )
) as integrity_summary;

with storage_listing as (
  select
    name,
    created_at,
    updated_at,
    coalesce((metadata ->> 'size')::bigint, 0) as size_bytes,
    metadata ->> 'mimetype' as mime_type,
    metadata ->> 'eTag' as etag
  from storage.objects
  where bucket_id = 'listing-images'
)
select
  storage_listing.name,
  storage_listing.created_at,
  storage_listing.updated_at,
  storage_listing.size_bytes,
  storage_listing.mime_type,
  storage_listing.etag
from storage_listing
left join public.listing_images
  on public.listing_images.storage_path = storage_listing.name
where public.listing_images.id is null
order by storage_listing.created_at asc, storage_listing.name asc
limit 500;

select
  public.listing_images.id,
  public.listing_images.listing_id,
  public.listing_images.storage_path,
  public.listing_images.created_at
from public.listing_images
left join storage.objects
  on storage.objects.bucket_id = 'listing-images'
 and storage.objects.name = public.listing_images.storage_path
where storage.objects.id is null
order by public.listing_images.created_at asc
limit 500;

rollback;
