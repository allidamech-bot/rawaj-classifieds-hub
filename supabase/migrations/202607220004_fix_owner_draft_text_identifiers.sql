-- Repair owner draft creation so legacy taxonomy and governorate identifiers remain text.
-- category_id, subcategory_id, and governorate_id are text columns; only location_node_id is uuid.

create or replace function public.rawaj_create_owner_draft_v2(
  p_creation_request_id uuid,
  p_patch jsonb default '{}'::jsonb
)
returns setof public.listings
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  v_allowed_keys text[] := array[
    'category_id', 'subcategory_id', 'governorate_id', 'location_node_id',
    'title', 'description', 'price', 'price_type', 'listing_condition',
    'district_ar', 'contact_name', 'contact_options', 'details'
  ];
  v_unknown_keys text[];
  v_listing public.listings%rowtype;
begin
  if v_actor is null then
    raise exception 'Authentication required.';
  end if;

  if p_creation_request_id is null then
    raise exception 'Draft creation request id is required.';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.account_status in ('frozen', 'disabled')
  ) then
    raise exception 'Account is not allowed to publish.';
  end if;

  if to_regclass('public.user_restrictions') is not null and exists (
    select 1
    from public.user_restrictions r
    where r.user_id = v_actor
      and r.restriction_type = 'posting'
      and r.lifted_at is null
      and (r.ends_at is null or r.ends_at > now())
  ) then
    raise exception 'Posting is restricted for this account.';
  end if;

  select array_agg(k)
    into v_unknown_keys
  from jsonb_object_keys(v_patch) as k
  where not (k = any(v_allowed_keys));

  if coalesce(array_length(v_unknown_keys, 1), 0) > 0 then
    raise exception 'Unsupported listing creation fields: %',
      array_to_string(v_unknown_keys, ',');
  end if;

  if nullif(btrim(v_patch->>'category_id'), '') is null
    or nullif(btrim(v_patch->>'governorate_id'), '') is null
    or char_length(btrim(coalesce(v_patch->>'title', ''))) < 4
  then
    raise exception 'Listing category, governorate, and title are required.';
  end if;

  select l.*
    into v_listing
  from public.listings l
  where l.owner_id = v_actor
    and l.creation_request_id = p_creation_request_id
  for update;

  if found then
    if v_listing.status <> 'draft' then
      raise exception 'creation_request_completed';
    end if;

    return query
    select *
    from public.rawaj_owner_update_listing(v_listing.id, v_patch);
    return;
  end if;

  begin
    insert into public.listings (
      owner_id,
      creation_request_id,
      category_id,
      subcategory_id,
      governorate_id,
      location_node_id,
      title,
      description,
      price,
      price_type,
      listing_condition,
      status,
      district_ar,
      contact_name,
      contact_options,
      details
    ) values (
      v_actor,
      p_creation_request_id,
      nullif(btrim(v_patch->>'category_id'), ''),
      nullif(btrim(v_patch->>'subcategory_id'), ''),
      nullif(btrim(v_patch->>'governorate_id'), ''),
      nullif(btrim(v_patch->>'location_node_id'), '')::uuid,
      btrim(v_patch->>'title'),
      coalesce(btrim(v_patch->>'description'), ''),
      case
        when not (v_patch ? 'price') or jsonb_typeof(v_patch->'price') = 'null' then null
        else (v_patch->>'price')::numeric
      end,
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
      select l.*
        into v_listing
      from public.listings l
      where l.owner_id = v_actor
        and l.creation_request_id = p_creation_request_id
      for update;

      if not found then
        raise;
      end if;

      if v_listing.status <> 'draft' then
        raise exception 'creation_request_completed';
      end if;

      return query
      select *
      from public.rawaj_owner_update_listing(v_listing.id, v_patch);
      return;
  end;

  return next v_listing;
end;
$$;

revoke all on function public.rawaj_create_owner_draft_v2(uuid, jsonb) from public;
revoke all on function public.rawaj_create_owner_draft_v2(uuid, jsonb) from anon;
grant execute on function public.rawaj_create_owner_draft_v2(uuid, jsonb) to authenticated;

comment on function public.rawaj_create_owner_draft_v2(uuid, jsonb) is
  'Creates or updates exactly one owner draft for one client creation request UUID while preserving text taxonomy identifiers.';

do $$
declare
  v_bad_function text;
  v_bad_line text;
begin
  select
    p.proname,
    btrim(function_line.line)
  into
    v_bad_function,
    v_bad_line
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral regexp_split_to_table(
    pg_get_functiondef(p.oid),
    E'\n'
  ) as function_line(line)
  where n.nspname = 'public'
    and p.proname = any(array[
      'rawaj_create_owner_draft_v2',
      'rawaj_owner_update_listing',
      'rawaj_owner_update_listing_v2',
      'rawaj_owner_update_listing_v3',
      'rawaj_submit_listing_for_review'
    ])
    and function_line.line ~* '(category_id|subcategory_id|governorate_id)'
    and function_line.line ~* '::uuid'
  order by p.proname
  limit 1;

  if v_bad_function is not null then
    raise exception 'Listing text identifier contract violated in %: %',
      v_bad_function,
      v_bad_line;
  end if;
end;
$$;

notify pgrst, 'reload schema';
