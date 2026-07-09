-- RAWAJ P0 production contract reconciliation: persist confirmed manual hotfixes.
--
-- This migration records two function-definition hotfixes already verified in
-- Production on 2026-07-09. It does not mutate taxonomy rows, listing rows, or
-- table structure. It only re-asserts the confirmed Production function bodies
-- so GitHub main and future environments converge on the same runtime contract.

-- 1) PostgreSQL has no min(uuid) aggregate. Preserve the existing canonical
-- resolver behavior while aggregating through text and casting the unique
-- candidate back to uuid.
create or replace function public.rawaj_resolve_location_option(
  legacy_governorate text,
  option_label text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_label text := btrim(option_label);
  resolved_id uuid;
  candidate_count integer;
begin
  if legacy_governorate is null or normalized_label = '' then
    return null;
  end if;

  select option_paths.id
  into resolved_id
  from public.rawaj_location_option_paths('SY') option_paths
  where option_paths.legacy_governorate_id = legacy_governorate
    and option_paths.label_ar = normalized_label
  limit 1;

  if resolved_id is not null then
    return resolved_id;
  end if;

  select
    count(*),
    min(n.id::text)::uuid
  into
    candidate_count,
    resolved_id
  from public.location_nodes n
  where n.is_active = true
    and n.legacy_governorate_id = legacy_governorate
    and btrim(n.name_ar) = normalized_label
    and n.node_type not in ('country', 'governorate');

  if candidate_count = 1 then
    return resolved_id;
  end if;

  return null;
end;
$$;

revoke all on function public.rawaj_resolve_location_option(text, text) from public;
grant execute on function public.rawaj_resolve_location_option(text, text) to anon, authenticated;

-- 2) Guard optional user_restrictions access with dynamic SQL. A static
-- reference can still fail at runtime when the relation is absent even when a
-- to_regclass check is present. Preserve the canonical submit lifecycle and
-- only query restrictions when the relation actually exists.
create or replace function public.rawaj_submit_listing_for_review(p_listing_id uuid)
returns setof public.listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_listing public.listings%rowtype;
  v_posting_restricted boolean := false;
begin
  if v_actor is null then
    raise exception 'Authentication required.';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.account_status in ('frozen', 'disabled')
  ) then
    raise exception 'Account is not allowed to publish.';
  end if;

  if to_regclass('public.user_restrictions') is not null then
    execute $sql$
      select exists (
        select 1
        from public.user_restrictions r
        where r.user_id = $1
          and r.restriction_type = 'posting'
          and r.lifted_at is null
          and (r.ends_at is null or r.ends_at > now())
      )
    $sql$
    into v_posting_restricted
    using v_actor;

    if v_posting_restricted then
      raise exception 'Posting is restricted for this account.';
    end if;
  end if;

  select l.*
  into v_listing
  from public.listings l
  where l.id = p_listing_id
    and l.owner_id = v_actor
    and l.status in ('draft', 'rejected')
  for update;

  if v_listing.id is null then
    raise exception 'Draft or rejected owned listing not found.';
  end if;

  if v_listing.category_id is null
    or v_listing.governorate_id is null
    or char_length(btrim(coalesce(v_listing.title, ''))) < 4
  then
    raise exception 'Listing category, governorate, and title are required.';
  end if;

  update public.listings l
  set
    status = 'pending_review',
    reviewed_by = null,
    reviewed_at = null,
    rejection_reason = null,
    published_at = null,
    archived_at = null,
    updated_at = now()
  where l.id = p_listing_id;

  return query
  select l.*
  from public.listings l
  where l.id = p_listing_id;
end;
$$;

revoke all on function public.rawaj_submit_listing_for_review(uuid) from public;
revoke all on function public.rawaj_submit_listing_for_review(uuid) from anon;
grant execute on function public.rawaj_submit_listing_for_review(uuid) to authenticated;
