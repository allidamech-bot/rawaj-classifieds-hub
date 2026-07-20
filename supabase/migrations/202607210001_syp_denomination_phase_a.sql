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

notify pgrst, 'reload schema';
