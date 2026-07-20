-- RAWAJ Taxonomy, Data & Search Foundation V1: server-side dynamic listing submit gate.
-- The current published V1 runtime has no governed field rules, so existing behavior remains unchanged.
-- Once a governed taxonomy version with field rules is published, every submission must use an
-- active published Leaf and satisfy its required structured attributes.

create or replace function public.rawaj_submit_listing_for_review(p_listing_id uuid)
returns setof public.listings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_listing public.listings%rowtype;
  v_dynamic_version_id uuid;
  v_assignment_node_id text;
  v_completeness jsonb;
  v_missing_keys jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required.';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.account_status in ('frozen', 'disabled')
  ) then
    raise exception 'Account is not allowed to publish.';
  end if;

  if to_regclass('public.user_restrictions') is not null and exists (
    select 1 from public.user_restrictions r
    where r.user_id = v_actor
      and r.restriction_type = 'posting'
      and r.lifted_at is null
      and (r.ends_at is null or r.ends_at > now())
  ) then
    raise exception 'Posting is restricted for this account.';
  end if;

  select l.* into v_listing
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

  select version_row.id
    into v_dynamic_version_id
  from public.taxonomy_versions version_row
  where version_row.status = 'published'
    and exists (
      select 1
      from public.taxonomy_field_rules rule_row
      where rule_row.version_id = version_row.id
    )
  order by version_row.version_number desc
  limit 1;

  if v_dynamic_version_id is not null then
    select assignment_row.taxonomy_node_id
      into v_assignment_node_id
    from public.listing_taxonomy_assignments assignment_row
    join public.taxonomy_version_nodes node_row
      on node_row.version_id = v_dynamic_version_id
     and node_row.node_id = assignment_row.taxonomy_node_id
    where assignment_row.listing_id = v_listing.id
      and node_row.is_active
      and node_row.is_leaf
    limit 1;

    if v_assignment_node_id is null then
      raise exception 'listing_published_taxonomy_leaf_required'
        using errcode = '23514';
    end if;

    v_completeness := public.rawaj_listing_attribute_completeness_v1(v_listing.id);

    if not coalesce((v_completeness ->> 'complete')::boolean, false) then
      v_missing_keys := coalesce(v_completeness -> 'missingRequiredFields', '[]'::jsonb);
      raise exception 'listing_attributes_incomplete'
        using
          errcode = '23514',
          detail = jsonb_build_object(
            'taxonomyNodeId', v_assignment_node_id,
            'missingRequiredFields', v_missing_keys
          )::text;
    end if;
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

  return query select l.* from public.listings l where l.id = p_listing_id;
end;
$$;

revoke all on function public.rawaj_submit_listing_for_review(uuid) from public, anon;
grant execute on function public.rawaj_submit_listing_for_review(uuid) to authenticated;

comment on function public.rawaj_submit_listing_for_review(uuid) is
  'Submits an owned editable listing. Dynamic field completeness is enforced only after a governed field-bearing taxonomy version is published.';
