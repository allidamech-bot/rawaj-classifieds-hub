begin;

create or replace function public.rawaj_public_nearby_listing_matches(
  user_latitude double precision,
  user_longitude double precision,
  radius_km integer default 25,
  result_limit integer default 60
)
returns table (
  listing_id uuid,
  distance_km double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select
      round(user_latitude::numeric, 2)::double precision as latitude,
      round(user_longitude::numeric, 2)::double precision as longitude,
      case when radius_km in (5, 10, 25, 50, 100) then radius_km else 25 end::double precision as radius,
      greatest(1, least(coalesce(result_limit, 60), 100)) as safe_limit
  ),
  candidates as (
    select
      l.id as listing_id,
      6371.0088 * 2 * asin(
        sqrt(
          power(sin(radians(n.latitude - normalized.latitude) / 2), 2) +
          cos(radians(normalized.latitude)) * cos(radians(n.latitude)) *
          power(sin(radians(n.longitude - normalized.longitude) / 2), 2)
        )
      ) as distance_km,
      normalized.radius,
      normalized.safe_limit
    from normalized
    join public.listings l
      on l.status = 'approved'
     and l.archived_at is null
     and (l.expires_at is null or l.expires_at > now())
    join public.location_nodes n
      on n.id = l.location_node_id
     and n.is_active = true
     and n.latitude is not null
     and n.longitude is not null
  )
  select candidates.listing_id, round(candidates.distance_km::numeric, 1)::double precision
  from candidates
  where candidates.distance_km <= candidates.radius
  order by candidates.distance_km asc, candidates.listing_id asc
  limit (select safe_limit from normalized);
$$;

revoke all on function public.rawaj_public_nearby_listing_matches(double precision, double precision, integer, integer) from public;
grant execute on function public.rawaj_public_nearby_listing_matches(double precision, double precision, integer, integer) to anon, authenticated;

comment on function public.rawaj_public_nearby_listing_matches(double precision, double precision, integer, integer) is
  'Returns public listing IDs and coarse distances using rounded user coordinates and canonical location-node centroids. Does not expose listing coordinates.';

commit;
