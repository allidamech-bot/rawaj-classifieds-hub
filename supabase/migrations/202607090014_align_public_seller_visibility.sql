-- RAWAJ public seller visibility alignment.
--
-- SECURITY DEFINER seller discovery functions must enforce the same listing
-- visibility boundary as public listing reads. A seller is publicly discoverable
-- only through at least one approved, non-archived, non-expired listing.
-- Existing rows are not rewritten.

create or replace function public.get_public_seller_profile(p_seller_id uuid)
returns table (
  id uuid,
  first_name text,
  last_name text,
  display_name text,
  governorate text,
  bio text,
  business_name text,
  avatar_path text,
  avatar_url text,
  cover_path text,
  cover_url text,
  verified boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.first_name,
    p.last_name,
    p.display_name,
    p.governorate,
    p.bio,
    p.business_name,
    p.avatar_path,
    p.avatar_url,
    p.cover_path,
    p.cover_url,
    p.verification_status = 'verified' as verified,
    p.created_at
  from public.profiles p
  where p.id = p_seller_id
    and exists (
      select 1
      from public.listings l
      where l.owner_id = p.id
        and l.status = 'approved'
        and l.archived_at is null
        and (l.expires_at is null or l.expires_at > now())
    );
$$;

revoke all on function public.get_public_seller_profile(uuid) from public;
grant execute on function public.get_public_seller_profile(uuid) to anon, authenticated;

create or replace function public.search_public_sellers(
  p_query text,
  p_limit integer default 8
)
returns table (
  id uuid,
  display_name text,
  first_name text,
  last_name text,
  business_name text,
  governorate text,
  bio text,
  avatar_url text,
  approved_listing_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with public_sellers as (
    select
      l.owner_id,
      count(*)::integer as approved_listing_count
    from public.listings l
    where l.status = 'approved'
      and l.archived_at is null
      and (l.expires_at is null or l.expires_at > now())
    group by l.owner_id
  )
  select
    p.id,
    p.display_name,
    p.first_name,
    p.last_name,
    p.business_name,
    p.governorate,
    p.bio,
    p.avatar_url,
    s.approved_listing_count
  from public_sellers s
  join public.profiles p on p.id = s.owner_id
  where length(btrim(coalesce(p_query, ''))) >= 2
    and (
      p.display_name ilike '%' || btrim(p_query) || '%'
      or p.first_name ilike '%' || btrim(p_query) || '%'
      or p.last_name ilike '%' || btrim(p_query) || '%'
      or p.business_name ilike '%' || btrim(p_query) || '%'
      or p.governorate ilike '%' || btrim(p_query) || '%'
      or p.bio ilike '%' || btrim(p_query) || '%'
    )
  order by s.approved_listing_count desc, p.display_name nulls last, p.created_at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

revoke all on function public.search_public_sellers(text, integer) from public;
grant execute on function public.search_public_sellers(text, integer) to anon, authenticated;

comment on function public.get_public_seller_profile(uuid) is
  'Returns safe public seller profile fields only when the seller has at least one currently public listing.';

comment on function public.search_public_sellers(text, integer) is
  'Searches safe public seller profile fields using only currently public listings for seller eligibility and counts.';
