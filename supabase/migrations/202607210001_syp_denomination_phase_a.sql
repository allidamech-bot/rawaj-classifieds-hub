-- RAWAJ SYP redenomination Phase A.
-- Additive metadata only: this migration never converts or overwrites public.listings.price.

alter table public.listings
  add column if not exists price_denomination text not null default 'unclassified',
  add column if not exists price_new_syp_normalized numeric
    generated always as (
      case
        when currency = 'SYP' and price is not null and price_denomination = 'old' then price / 100
        when currency = 'SYP' and price is not null and price_denomination = 'new' then price
        else null
      end
    ) stored;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.listings'::regclass
      and conname = 'listings_price_denomination_valid'
  ) then
    alter table public.listings
      add constraint listings_price_denomination_valid
      check (price_denomination in ('old', 'new', 'unclassified'));
  end if;
end;
$$;

create index if not exists listings_public_normalized_price_idx
  on public.listings (price_new_syp_normalized, id)
  where status = 'approved' and archived_at is null;

alter table public.favorite_listing_snapshots
  add column if not exists price_denomination_snapshot text not null default 'unclassified',
  add column if not exists price_new_syp_normalized_snapshot numeric
    generated always as (
      case
        when currency_snapshot = 'SYP'
          and price_snapshot is not null
          and price_denomination_snapshot = 'old'
          then price_snapshot / 100
        when currency_snapshot = 'SYP'
          and price_snapshot is not null
          and price_denomination_snapshot = 'new'
          then price_snapshot
        else null
      end
    ) stored;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.favorite_listing_snapshots'::regclass
      and conname = 'favorite_listing_snapshots_price_denomination_valid'
  ) then
    alter table public.favorite_listing_snapshots
      add constraint favorite_listing_snapshots_price_denomination_valid
      check (price_denomination_snapshot in ('old', 'new', 'unclassified'));
  end if;
end;
$$;

alter table public.listing_price_changes
  add column if not exists old_price_denomination text not null default 'unclassified',
  add column if not exists new_price_denomination text not null default 'unclassified',
  add column if not exists old_price_new_syp_normalized numeric
    generated always as (
      case
        when currency = 'SYP' and old_price_denomination = 'old' then old_price / 100
        when currency = 'SYP' and old_price_denomination = 'new' then old_price
        else null
      end
    ) stored,
  add column if not exists new_price_new_syp_normalized numeric
    generated always as (
      case
        when currency = 'SYP' and new_price_denomination = 'old' then new_price / 100
        when currency = 'SYP' and new_price_denomination = 'new' then new_price
        else null
      end
    ) stored;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.listing_price_changes'::regclass
      and conname = 'listing_price_changes_denomination_valid'
  ) then
    alter table public.listing_price_changes
      add constraint listing_price_changes_denomination_valid
      check (
        old_price_denomination in ('old', 'new', 'unclassified')
        and new_price_denomination in ('old', 'new', 'unclassified')
      );
  end if;
end;
$$;

create or replace function public.rawaj_owner_update_listing(
  p_listing_id uuid,
  p_patch jsonb
)
returns setof public.listings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_listing public.listings%rowtype;
  v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  v_allowed_keys text[] := array[
    'category_id','subcategory_id','governorate_id','location_node_id','title',
    'description','price','price_denomination','price_type','listing_condition','district_ar',
    'contact_name','contact_options','details'
  ];
  v_unknown_keys text[];
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;

  select array_agg(k) into v_unknown_keys
  from jsonb_object_keys(v_patch) as k
  where not (k = any(v_allowed_keys));

  if coalesce(array_length(v_unknown_keys, 1), 0) > 0 then
    raise exception 'Unsupported listing edit fields: %', array_to_string(v_unknown_keys, ',');
  end if;

  select l.* into v_listing
  from public.listings l
  where l.id = p_listing_id
    and l.owner_id = v_actor
    and l.status in ('draft', 'rejected')
  for update;

  if v_listing.id is null then raise exception 'Editable owned listing not found.'; end if;

  if v_patch ? 'price_denomination'
     and coalesce(v_patch->>'price_denomination', '') not in ('old', 'new', 'unclassified')
  then
    raise exception 'syp_price_denomination_invalid' using errcode = '22023';
  end if;

  update public.listings l
  set
    category_id = case when v_patch ? 'category_id' then nullif(btrim(v_patch->>'category_id'), '') else l.category_id end,
    subcategory_id = case when v_patch ? 'subcategory_id' then nullif(btrim(v_patch->>'subcategory_id'), '') else l.subcategory_id end,
    governorate_id = case when v_patch ? 'governorate_id' then nullif(btrim(v_patch->>'governorate_id'), '') else l.governorate_id end,
    location_node_id = case
      when v_patch ? 'location_node_id' and jsonb_typeof(v_patch->'location_node_id') = 'null' then null
      when v_patch ? 'location_node_id' then nullif(v_patch->>'location_node_id', '')::uuid
      else l.location_node_id
    end,
    title = case when v_patch ? 'title' then btrim(v_patch->>'title') else l.title end,
    description = case
      when v_patch ? 'description' and jsonb_typeof(v_patch->'description') = 'null' then null
      when v_patch ? 'description' then btrim(v_patch->>'description')
      else l.description
    end,
    price = case
      when v_patch ? 'price' and jsonb_typeof(v_patch->'price') = 'null' then null
      when v_patch ? 'price' then (v_patch->>'price')::numeric
      else l.price
    end,
    price_denomination = case
      when v_patch ? 'price_denomination' then v_patch->>'price_denomination'
      else l.price_denomination
    end,
    price_type = case when v_patch ? 'price_type' then v_patch->>'price_type' else l.price_type end,
    listing_condition = case when v_patch ? 'listing_condition' then v_patch->>'listing_condition' else l.listing_condition end,
    district_ar = case
      when v_patch ? 'district_ar' and jsonb_typeof(v_patch->'district_ar') = 'null' then null
      when v_patch ? 'district_ar' then btrim(v_patch->>'district_ar')
      else l.district_ar
    end,
    contact_name = case
      when v_patch ? 'contact_name' and jsonb_typeof(v_patch->'contact_name') = 'null' then null
      when v_patch ? 'contact_name' then btrim(v_patch->>'contact_name')
      else l.contact_name
    end,
    contact_options = case when v_patch ? 'contact_options' then coalesce(v_patch->'contact_options', '{}'::jsonb) else l.contact_options end,
    details = case when v_patch ? 'details' then coalesce(v_patch->'details', '{}'::jsonb) else l.details end,
    updated_at = now()
  where l.id = p_listing_id;

  if exists (
    select 1 from public.listings l
    where l.id = p_listing_id
      and (
        l.category_id is null
        or l.governorate_id is null
        or char_length(btrim(coalesce(l.title, ''))) < 4
      )
  ) then
    raise exception 'Listing category, governorate, and title are required.';
  end if;

  return query select l.* from public.listings l where l.id = p_listing_id;
end;
$$;

revoke all on function public.rawaj_owner_update_listing(uuid, jsonb) from public, anon;
grant execute on function public.rawaj_owner_update_listing(uuid, jsonb) to authenticated;

create or replace function public.rawaj_create_owner_draft_v2(
  p_creation_request_id uuid,
  p_patch jsonb default '{}'::jsonb
)
returns setof public.listings
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  v_allowed_keys text[] := array[
    'category_id', 'subcategory_id', 'governorate_id', 'location_node_id',
    'title', 'description', 'price', 'price_denomination', 'price_type', 'listing_condition',
    'district_ar', 'contact_name', 'contact_options', 'details'
  ];
  v_unknown_keys text[];
  v_listing public.listings%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if p_creation_request_id is null then raise exception 'Draft creation request id is required.'; end if;

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

  select array_agg(k) into v_unknown_keys
  from jsonb_object_keys(v_patch) as k
  where not (k = any(v_allowed_keys));

  if coalesce(array_length(v_unknown_keys, 1), 0) > 0 then
    raise exception 'Unsupported listing creation fields: %', array_to_string(v_unknown_keys, ',');
  end if;

  if nullif(btrim(v_patch->>'category_id'), '') is null
    or nullif(btrim(v_patch->>'governorate_id'), '') is null
    or char_length(btrim(coalesce(v_patch->>'title', ''))) < 4
  then
    raise exception 'Listing category, governorate, and title are required.';
  end if;

  if v_patch ? 'price_denomination'
     and coalesce(v_patch->>'price_denomination', '') not in ('old', 'new', 'unclassified')
  then
    raise exception 'syp_price_denomination_invalid' using errcode = '22023';
  end if;

  select l.* into v_listing
  from public.listings l
  where l.owner_id = v_actor
    and l.creation_request_id = p_creation_request_id
  for update;

  if found then
    if v_listing.status <> 'draft' then raise exception 'creation_request_completed'; end if;
    return query select * from public.rawaj_owner_update_listing(v_listing.id, v_patch);
    return;
  end if;

  begin
    insert into public.listings (
      owner_id, creation_request_id, category_id, subcategory_id, governorate_id,
      location_node_id, title, description, price, price_denomination, price_type,
      listing_condition, status, district_ar, contact_name, contact_options, details
    ) values (
      v_actor,
      p_creation_request_id,
      nullif(btrim(v_patch->>'category_id'), '')::uuid,
      nullif(btrim(v_patch->>'subcategory_id'), '')::uuid,
      nullif(btrim(v_patch->>'governorate_id'), '')::uuid,
      nullif(btrim(v_patch->>'location_node_id'), '')::uuid,
      btrim(v_patch->>'title'),
      coalesce(btrim(v_patch->>'description'), ''),
      case
        when not (v_patch ? 'price') or jsonb_typeof(v_patch->'price') = 'null' then null
        else (v_patch->>'price')::numeric
      end,
      coalesce(nullif(v_patch->>'price_denomination', ''), 'unclassified'),
      coalesce(nullif(v_patch->>'price_type', ''), 'fixed')::public.rawaj_price_type,
      coalesce(nullif(v_patch->>'listing_condition', ''), 'not_applicable')::public.rawaj_listing_condition,
      'draft',
      nullif(btrim(v_patch->>'district_ar'), ''),
      nullif(btrim(v_patch->>'contact_name'), ''),
      coalesce(v_patch->'contact_options', '{}'::jsonb),
      coalesce(v_patch->'details', '{}'::jsonb)
    )
    returning * into v_listing;
  exception
    when unique_violation then
      select l.* into v_listing
      from public.listings l
      where l.owner_id = v_actor
        and l.creation_request_id = p_creation_request_id
      for update;
      if not found then raise; end if;
      if v_listing.status <> 'draft' then raise exception 'creation_request_completed'; end if;
      return query select * from public.rawaj_owner_update_listing(v_listing.id, v_patch);
      return;
  end;

  return next v_listing;
end;
$$;

revoke all on function public.rawaj_create_owner_draft_v2(uuid, jsonb) from public, anon;
grant execute on function public.rawaj_create_owner_draft_v2(uuid, jsonb) to authenticated;

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
  if v_actor is null then raise exception 'Authentication required.'; end if;

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

  if v_listing.id is null then raise exception 'Draft or rejected owned listing not found.'; end if;

  if v_listing.category_id is null
    or v_listing.governorate_id is null
    or char_length(btrim(coalesce(v_listing.title, ''))) < 4
  then
    raise exception 'Listing category, governorate, and title are required.';
  end if;

  if v_listing.currency = 'SYP'
     and v_listing.price is not null
     and v_listing.price_type::text in ('fixed', 'negotiable')
     and v_listing.price_denomination not in ('old', 'new')
  then
    raise exception 'syp_price_denomination_required' using errcode = '23514';
  end if;

  select version_row.id into v_dynamic_version_id
  from public.taxonomy_versions version_row
  where version_row.status = 'published'
    and exists (
      select 1 from public.taxonomy_field_rules rule_row
      where rule_row.version_id = version_row.id
    )
  order by version_row.version_number desc
  limit 1;

  if v_dynamic_version_id is not null then
    select assignment_row.taxonomy_node_id into v_assignment_node_id
    from public.listing_taxonomy_assignments assignment_row
    join public.taxonomy_version_nodes node_row
      on node_row.version_id = v_dynamic_version_id
     and node_row.node_id = assignment_row.taxonomy_node_id
    where assignment_row.listing_id = v_listing.id
      and node_row.is_active
      and node_row.is_leaf
    limit 1;

    if v_assignment_node_id is null then
      raise exception 'listing_published_taxonomy_leaf_required' using errcode = '23514';
    end if;

    v_completeness := public.rawaj_listing_attribute_completeness_v1(v_listing.id);
    if not coalesce((v_completeness ->> 'complete')::boolean, false) then
      v_missing_keys := coalesce(v_completeness -> 'missingRequiredFields', '[]'::jsonb);
      raise exception 'listing_attributes_incomplete'
        using errcode = '23514',
          detail = jsonb_build_object(
            'taxonomyNodeId', v_assignment_node_id,
            'missingRequiredFields', v_missing_keys
          )::text;
    end if;
  end if;

  update public.listings l
  set status = 'pending_review',
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

create or replace function public.rawaj_list_unclassified_syp_prices()
returns setof public.listings
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.*
  from public.listings l
  where auth.uid() is not null
    and l.currency = 'SYP'
    and l.price is not null
    and l.price_type::text in ('fixed', 'negotiable')
    and l.price_denomination = 'unclassified'
    and (
      l.owner_id = auth.uid()
      or public.rawaj_current_user_can_review_listings()
    )
  order by
    case when l.status = 'approved' then 0 else 1 end,
    l.updated_at asc,
    l.id asc;
$$;

revoke all on function public.rawaj_list_unclassified_syp_prices() from public, anon;
grant execute on function public.rawaj_list_unclassified_syp_prices() to authenticated;

create or replace function public.rawaj_classify_syp_listing_price(
  p_listing_id uuid,
  p_denomination text,
  p_expected_updated_at timestamptz
)
returns setof public.listings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_listing public.listings%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if p_denomination not in ('old', 'new') then
    raise exception 'syp_price_denomination_invalid' using errcode = '22023';
  end if;
  if p_expected_updated_at is null then
    raise exception 'syp_denomination_stale_write';
  end if;

  select l.* into v_listing
  from public.listings l
  where l.id = p_listing_id
  for update;

  if not found then raise exception 'syp_denomination_listing_not_found'; end if;
  if v_listing.owner_id <> v_actor and not public.rawaj_current_user_can_review_listings() then
    raise exception 'syp_denomination_permission_denied';
  end if;
  if v_listing.updated_at is distinct from p_expected_updated_at then
    raise exception 'syp_denomination_stale_write';
  end if;
  if v_listing.currency <> 'SYP'
     or v_listing.price is null
     or v_listing.price_type::text not in ('fixed', 'negotiable')
  then
    raise exception 'syp_denomination_numeric_syp_required';
  end if;

  perform set_config('rawaj.syp_denomination_write', 'on', true);
  update public.listings
  set price_denomination = p_denomination,
      updated_at = now()
  where id = p_listing_id;
  perform set_config('rawaj.syp_denomination_write', 'off', true);

  return query select l.* from public.listings l where l.id = p_listing_id;
end;
$$;

revoke all on function public.rawaj_classify_syp_listing_price(uuid, text, timestamptz)
  from public, anon;
grant execute on function public.rawaj_classify_syp_listing_price(uuid, text, timestamptz)
  to authenticated;

create or replace function public.rawaj_protect_listing_moderation_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('rawaj.syp_denomination_write', true) = 'on' then
    if auth.uid() is null
       or (old.owner_id <> auth.uid() and not public.rawaj_current_user_can_review_listings())
    then
      raise exception 'syp_denomination_permission_denied';
    end if;

    if (to_jsonb(new) - array['price_denomination', 'price_new_syp_normalized', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['price_denomination', 'price_new_syp_normalized', 'updated_at'])
    then
      raise exception 'syp_denomination_unsafe_update';
    end if;
    return new;
  end if;

  if current_setting('rawaj.owner_price_drop_write', true) = 'on' then
    if auth.uid() is null or old.owner_id <> auth.uid() then
      raise exception 'listing_price_drop_permission_denied';
    end if;
    if old.status <> 'approved' or new.status is distinct from old.status then
      raise exception 'listing_price_drop_requires_approved_listing';
    end if;
    if (to_jsonb(new) - array['price', 'price_new_syp_normalized', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['price', 'price_new_syp_normalized', 'updated_at'])
    then
      raise exception 'listing_price_drop_unsafe_update';
    end if;
    if old.price is null or new.price is null or old.price <= 0 or new.price <= 0 or new.price >= old.price then
      raise exception 'listing_price_drop_invalid_price';
    end if;
    return new;
  end if;

  if public.rawaj_current_user_can_review_listings()
     and (to_jsonb(new) - array[
           'status','reviewed_by','reviewed_at','rejection_reason',
           'published_at','archived_at','updated_at','status_changed_at',
           'expires_at'
         ])
         is not distinct from
         (to_jsonb(old) - array[
           'status','reviewed_by','reviewed_at','rejection_reason',
           'published_at','archived_at','updated_at','status_changed_at',
           'expires_at'
         ])
  then
    return new;
  end if;

  if old.owner_id = auth.uid()
     and old.status in ('draft', 'rejected')
     and new.status = 'pending_review'
     and new.owner_id is not distinct from old.owner_id
     and new.is_featured is not distinct from old.is_featured
     and new.featured_until is not distinct from old.featured_until
     and new.reviewed_by is null
     and new.reviewed_at is null
     and new.rejection_reason is null
     and new.published_at is null
     and new.archived_at is null
  then
    return new;
  end if;

  if old.owner_id = auth.uid() and old.status in ('draft', 'rejected') then
    if new.owner_id is distinct from old.owner_id
      or new.is_featured is distinct from old.is_featured
      or new.featured_until is distinct from old.featured_until
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at
      or new.rejection_reason is distinct from old.rejection_reason
      or new.published_at is distinct from old.published_at
      or new.archived_at is distinct from old.archived_at
    then
      raise exception 'Listing owners cannot change moderation-controlled fields.';
    end if;
    return new;
  end if;

  if public.rawaj_current_user_can_review_listings() then
    raise exception 'Review staff can only change moderation-safe fields on listings.';
  end if;

  return new;
end;
$$;

comment on column public.listings.price_denomination is
  'Explicit Syrian-pound source denomination: old, new, or unclassified. Never inferred.';
comment on column public.listings.price_new_syp_normalized is
  'Generated comparison value in new SYP. Null while denomination is unclassified.';
comment on function public.rawaj_classify_syp_listing_price(uuid, text, timestamptz) is
  'Stale-safe owner/reviewer metadata-only denomination classification. Stored price is unchanged.';


-- Phase A completion: normalized search, governed price history, and snapshot metadata.

create or replace function public.rawaj_public_listing_search_page_v1_impl(
  p_taxonomy_node_ids text[] default null,
  p_attribute_filters jsonb default '{}'::jsonb,
  p_governorate_id uuid default null,
  p_location_node_ids uuid[] default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_price_type text default null,
  p_condition text default null,
  p_query text default null,
  p_with_photos boolean default false,
  p_sort text default 'latest',
  p_cursor jsonb default null,
  p_page_size integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_version_id uuid;
  v_filters jsonb := coalesce(p_attribute_filters, '{}'::jsonb);
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_sort text := coalesce(nullif(btrim(p_sort), ''), 'latest');
  v_page_size integer := greatest(1, least(coalesce(p_page_size, 30), 50));
  v_total_count bigint := 0;
  v_listing_ids jsonb := '[]'::jsonb;
  v_has_more boolean := false;
  v_last jsonb;
  v_next_cursor jsonb := null;
begin
  if jsonb_typeof(v_filters) <> 'object' then
    raise exception 'listing_search_filters_object_required' using errcode = '22023';
  end if;

  if (select count(*) from jsonb_object_keys(v_filters)) > 50 then
    raise exception 'listing_search_filter_limit_exceeded' using errcode = '54000';
  end if;

  if v_sort not in ('latest', 'cheapest', 'expensive', 'featured') then
    raise exception 'listing_search_sort_invalid' using errcode = '22023';
  end if;

  if p_cursor is not null and jsonb_typeof(p_cursor) <> 'object' then
    raise exception 'listing_search_cursor_object_required' using errcode = '22023';
  end if;

  if p_price_min is not null and p_price_min < 0 then
    raise exception 'listing_search_price_min_invalid' using errcode = '22023';
  end if;

  if p_price_max is not null and p_price_max < 0 then
    raise exception 'listing_search_price_max_invalid' using errcode = '22023';
  end if;

  if p_price_min is not null and p_price_max is not null and p_price_min > p_price_max then
    raise exception 'listing_search_price_range_invalid' using errcode = '22023';
  end if;

  select version_row.id
    into v_version_id
  from public.taxonomy_versions version_row
  where version_row.status = 'published'
  order by version_row.version_number desc
  limit 1;

  if v_version_id is null then
    return jsonb_build_object(
      'taxonomyVersionId', null,
      'totalCount', 0,
      'listingIds', '[]'::jsonb,
      'nextCursor', null
    );
  end if;

  if exists (
    select 1
    from jsonb_object_keys(v_filters) input_key(field_key)
    where not exists (
      select 1
      from public.field_definitions field_row
      join public.taxonomy_field_rules rule_row
        on rule_row.field_key = field_row.key
       and rule_row.version_id = v_version_id
      where field_row.key = input_key.field_key
        and field_row.is_active
        and not field_row.is_sensitive
        and field_row.is_filterable
        and (
          p_taxonomy_node_ids is null
          or cardinality(p_taxonomy_node_ids) = 0
          or rule_row.taxonomy_node_id = any(p_taxonomy_node_ids)
        )
    )
  ) then
    raise exception 'listing_search_field_not_allowed' using errcode = '22023';
  end if;

  with candidate_listings as (
    select
      listing_row.id,
      listing_row.price_new_syp_normalized as price,
      listing_row.is_featured,
      listing_row.created_at
    from public.listings listing_row
    join public.listing_taxonomy_assignments assignment_row
      on assignment_row.listing_id = listing_row.id
    join public.taxonomy_version_nodes node_row
      on node_row.version_id = v_version_id
     and node_row.node_id = assignment_row.taxonomy_node_id
    where listing_row.status = 'approved'
      and listing_row.archived_at is null
      and (listing_row.expires_at is null or listing_row.expires_at > now())
      and node_row.is_active
      and node_row.is_leaf
      and (
        p_taxonomy_node_ids is null
        or cardinality(p_taxonomy_node_ids) = 0
        or assignment_row.taxonomy_node_id = any(p_taxonomy_node_ids)
      )
      and (
        p_location_node_ids is null
        or cardinality(p_location_node_ids) = 0
        or listing_row.location_node_id = any(p_location_node_ids)
        or (
          listing_row.location_node_id is null
          and p_governorate_id is not null
          and listing_row.governorate_id = p_governorate_id::text
        )
      )
      and (
        (p_location_node_ids is not null and cardinality(p_location_node_ids) > 0)
        or p_governorate_id is null
        or listing_row.governorate_id = p_governorate_id::text
      )
      and (p_price_min is null or listing_row.price_new_syp_normalized >= p_price_min)
      and (p_price_max is null or listing_row.price_new_syp_normalized <= p_price_max)
      and (p_price_type is null or listing_row.price_type::text = p_price_type)
      and (p_condition is null or listing_row.listing_condition::text = p_condition)
      and (
        v_query is null
        or listing_row.search_text_normalized ilike
        '%' || public.rawaj_normalize_arabic_search(v_query) || '%'
        or listing_row.title ilike '%' || v_query || '%'
        or listing_row.description ilike '%' || v_query || '%'
      )
      and (
        not coalesce(p_with_photos, false)
        or exists (
          select 1
          from public.listing_images image_row
          where image_row.listing_id = listing_row.id
        )
      )
      and not exists (
        select 1
        from jsonb_each(v_filters) filter_row(field_key, filter_value)
        where not exists (
          select 1
          from public.listing_attribute_values attribute_row
          where attribute_row.listing_id = listing_row.id
            and attribute_row.field_key = filter_row.field_key
            and case
              when jsonb_typeof(filter_row.filter_value) = 'array' then
                (
                  attribute_row.value_key is not null
                  and filter_row.filter_value ? attribute_row.value_key
                )
                or (
                  attribute_row.value_json is not null
                  and jsonb_typeof(attribute_row.value_json) = 'array'
                  and exists (
                    select 1
                    from jsonb_array_elements_text(attribute_row.value_json) selected_value(value)
                    where filter_row.filter_value ? selected_value.value
                  )
                )
              when jsonb_typeof(filter_row.filter_value) = 'object'
                and (filter_row.filter_value ? 'min' or filter_row.filter_value ? 'max') then
                attribute_row.value_numeric is not null
                and (
                  not (filter_row.filter_value ? 'min')
                  or attribute_row.value_numeric >= (filter_row.filter_value ->> 'min')::numeric
                )
                and (
                  not (filter_row.filter_value ? 'max')
                  or attribute_row.value_numeric <= (filter_row.filter_value ->> 'max')::numeric
                )
              when jsonb_typeof(filter_row.filter_value) = 'boolean' then
                attribute_row.value_boolean = (filter_row.filter_value #>> '{}')::boolean
              else
                coalesce(
                  attribute_row.value_key,
                  attribute_row.value_text,
                  attribute_row.value_numeric::text,
                  attribute_row.value_date::text,
                  attribute_row.value_boolean::text
                ) = filter_row.filter_value #>> '{}'
            end
        )
      )
  ),
  cursor_filtered as (
    select candidate_row.*
    from candidate_listings candidate_row
    where p_cursor is null
      or case v_sort
        when 'latest' then
          candidate_row.created_at < (p_cursor ->> 'created_at')::timestamptz
          or (
            candidate_row.created_at = (p_cursor ->> 'created_at')::timestamptz
            and candidate_row.id < (p_cursor ->> 'id')::uuid
          )
        when 'featured' then
          case when coalesce((p_cursor ->> 'is_featured')::boolean, false) then
            not candidate_row.is_featured
            or (
              candidate_row.is_featured
              and candidate_row.created_at < (p_cursor ->> 'created_at')::timestamptz
            )
            or (
              candidate_row.is_featured
              and candidate_row.created_at = (p_cursor ->> 'created_at')::timestamptz
              and candidate_row.id < (p_cursor ->> 'id')::uuid
            )
          else
            not candidate_row.is_featured
            and (
              candidate_row.created_at < (p_cursor ->> 'created_at')::timestamptz
              or (
                candidate_row.created_at = (p_cursor ->> 'created_at')::timestamptz
                and candidate_row.id < (p_cursor ->> 'id')::uuid
              )
            )
          end
        when 'cheapest' then
          case when p_cursor ->> 'price' is null then
            candidate_row.price is null
            and candidate_row.id > (p_cursor ->> 'id')::uuid
          else
            candidate_row.price > (p_cursor ->> 'price')::numeric
            or candidate_row.price is null
            or (
              candidate_row.price = (p_cursor ->> 'price')::numeric
              and candidate_row.id > (p_cursor ->> 'id')::uuid
            )
          end
        when 'expensive' then
          case when p_cursor ->> 'price' is null then
            candidate_row.price is null
            and candidate_row.id > (p_cursor ->> 'id')::uuid
          else
            candidate_row.price < (p_cursor ->> 'price')::numeric
            or candidate_row.price is null
            or (
              candidate_row.price = (p_cursor ->> 'price')::numeric
              and candidate_row.id > (p_cursor ->> 'id')::uuid
            )
          end
      end
  ),
  ordered_rows as (
    select
      cursor_row.*,
      row_number() over (
        order by
          case when v_sort = 'featured' then cursor_row.is_featured end desc,
          case when v_sort in ('latest', 'featured') then cursor_row.created_at end desc,
          case when v_sort = 'cheapest' then cursor_row.price end asc nulls last,
          case when v_sort = 'expensive' then cursor_row.price end desc nulls last,
          case when v_sort in ('cheapest', 'expensive') then cursor_row.id end asc,
          case when v_sort in ('latest', 'featured') then cursor_row.id end desc
      ) as ordinal
    from cursor_filtered cursor_row
  ),
  page_rows as (
    select ordered_row.*
    from ordered_rows ordered_row
    where ordered_row.ordinal <= v_page_size + 1
  ),
  visible_rows as (
    select page_row.*
    from page_rows page_row
    where page_row.ordinal <= v_page_size
  )
  select
    (select count(*) from candidate_listings),
    coalesce(
      (select jsonb_agg(visible_row.id order by visible_row.ordinal) from visible_rows visible_row),
      '[]'::jsonb
    ),
    exists (select 1 from page_rows page_row where page_row.ordinal = v_page_size + 1),
    (
      select to_jsonb(visible_row)
      from visible_rows visible_row
      order by visible_row.ordinal desc
      limit 1
    )
    into v_total_count, v_listing_ids, v_has_more, v_last;

  if v_has_more and v_last is not null then
    v_next_cursor := case v_sort
      when 'latest' then jsonb_build_object(
        'type', 'latest',
        'created_at', v_last ->> 'created_at',
        'id', v_last ->> 'id'
      )
      when 'featured' then jsonb_build_object(
        'type', 'featured',
        'is_featured', (v_last ->> 'is_featured')::boolean,
        'created_at', v_last ->> 'created_at',
        'id', v_last ->> 'id'
      )
      when 'cheapest' then jsonb_build_object(
        'type', 'cheapest',
        'price', v_last -> 'price',
        'id', v_last ->> 'id'
      )
      when 'expensive' then jsonb_build_object(
        'type', 'expensive',
        'price', v_last -> 'price',
        'id', v_last ->> 'id'
      )
    end;
  end if;

  return jsonb_build_object(
    'taxonomyVersionId', v_version_id,
    'totalCount', coalesce(v_total_count, 0),
    'listingIds', v_listing_ids,
    'nextCursor', v_next_cursor
  );
end;
$$;

revoke all on function public.rawaj_public_listing_search_page_v1_impl(
  text[], jsonb, uuid, uuid[], numeric, numeric, text, text, text, boolean, text, jsonb, integer
) from public, anon, authenticated;

create or replace function public.rawaj_owner_reduce_listing_price(
  p_listing_id uuid,
  p_new_price numeric
)
returns table (
  listing_id uuid,
  old_price numeric,
  new_price numeric,
  discount_percent numeric,
  dropped_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_listing public.listings%rowtype;
  v_drop public.listing_price_changes%rowtype;
begin
  if v_actor is null then
    raise exception 'listing_price_drop_auth_required';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.account_status in ('frozen', 'disabled')
  ) then
    raise exception 'listing_price_drop_account_restricted';
  end if;

  if p_listing_id is null then
    raise exception 'listing_price_drop_invalid_listing';
  end if;

  select l.*
  into v_listing
  from public.listings l
  where l.id = p_listing_id
    and l.owner_id = v_actor
  for update;

  if not found then
    raise exception 'listing_price_drop_not_found';
  end if;

  if v_listing.status <> 'approved'
     or v_listing.archived_at is not null
     or (v_listing.expires_at is not null and v_listing.expires_at <= now())
  then
    raise exception 'listing_price_drop_requires_public_listing';
  end if;

  if v_listing.price_type::text not in ('fixed', 'negotiable')
     or v_listing.price is null
     or v_listing.price <= 0
  then
    raise exception 'listing_price_drop_requires_numeric_price';
  end if;

  if v_listing.price_denomination not in ('old', 'new')
     or v_listing.price_new_syp_normalized is null
  then
    raise exception 'syp_price_denomination_required';
  end if;

  if p_new_price is null
     or p_new_price <= 0
     or p_new_price >= v_listing.price
  then
    raise exception 'listing_price_drop_invalid_price';
  end if;

  -- Require at least a 1% real reduction so trivial rounding changes never become offers.
  if p_new_price > round(v_listing.price * 0.99, 2) then
    raise exception 'listing_price_drop_too_small';
  end if;

  perform set_config('rawaj.owner_price_drop_write', 'on', true);

  update public.listings l
  set price = p_new_price,
      updated_at = now()
  where l.id = p_listing_id;

  perform set_config('rawaj.owner_price_drop_write', 'off', true);

  insert into public.listing_price_changes (
    listing_id,
    owner_id,
    old_price,
    new_price,
    currency,
    old_price_denomination,
    new_price_denomination
  )
  values (
    p_listing_id,
    v_actor,
    v_listing.price,
    p_new_price,
    'SYP',
    v_listing.price_denomination,
    v_listing.price_denomination
  )
  returning * into v_drop;

  begin
    perform public.rawaj_insert_audit_log(
      'listing.price_reduced',
      'listings',
      p_listing_id::text,
      jsonb_build_object(
        'old_price', v_listing.price,
        'new_price', p_new_price,
        'price_denomination', v_listing.price_denomination,
        'discount_percent', round(((v_listing.price - p_new_price) / v_listing.price) * 100, 1)
      )
    );
  exception when others then null;
  end;

  return query
  select
    p_listing_id,
    v_listing.price,
    p_new_price,
    round(((v_listing.price - p_new_price) / v_listing.price) * 100, 1),
    v_drop.created_at;
end;
$$;

create or replace function public.rawaj_get_active_price_drop_offers(
  p_limit integer default 30
)
returns table (
  listing_id uuid,
  old_price numeric,
  new_price numeric,
  discount_percent numeric,
  dropped_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with latest_drop as (
    select distinct on (c.listing_id)
      c.listing_id,
      c.old_price,
      c.new_price,
      c.old_price_new_syp_normalized,
      c.new_price_new_syp_normalized,
      c.created_at
    from public.listing_price_changes c
    order by c.listing_id, c.created_at desc, c.id desc
  )
  select
    l.id,
    d.old_price,
    d.new_price,
    round(((d.old_price - d.new_price) / d.old_price) * 100, 1),
    d.created_at
  from latest_drop d
  join public.listings l on l.id = d.listing_id
  where l.status = 'approved'
    and l.archived_at is null
    and (l.expires_at is null or l.expires_at > now())
    and l.price_type::text in ('fixed', 'negotiable')
    and l.price is not null
    and l.price_new_syp_normalized = d.new_price_new_syp_normalized
    and d.old_price_new_syp_normalized is not null
    and d.new_price_new_syp_normalized is not null
    and d.new_price > 0
    and d.old_price > d.new_price
    and d.created_at >= now() - interval '30 days'
    and round(((d.old_price - d.new_price) / d.old_price) * 100, 1) >= 1
  order by d.created_at desc, l.id desc
  limit greatest(1, least(coalesce(p_limit, 30), 50));
$$;

create or replace function public.rawaj_sync_favorite_snapshot_syp_denomination()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_denomination text;
begin
  if new.currency_snapshot = 'SYP' and new.price_snapshot is not null then
    select l.price_denomination
      into v_denomination
    from public.listings l
    where l.id = new.listing_id
      and l.price is not distinct from new.price_snapshot
      and l.currency is not distinct from new.currency_snapshot;

    if found then
      new.price_denomination_snapshot := coalesce(v_denomination, 'unclassified');
    end if;
  else
    new.price_denomination_snapshot := 'unclassified';
  end if;
  return new;
end;
$$;

revoke all on function public.rawaj_sync_favorite_snapshot_syp_denomination() from public, anon, authenticated;

drop trigger if exists rawaj_sync_favorite_snapshot_syp_denomination
  on public.favorite_listing_snapshots;
create trigger rawaj_sync_favorite_snapshot_syp_denomination
before insert or update of listing_id, price_snapshot, currency_snapshot
on public.favorite_listing_snapshots
for each row execute function public.rawaj_sync_favorite_snapshot_syp_denomination();

notify pgrst, 'reload schema';
