-- RAWAJ Taxonomy, Data & Search Foundation V1: governed owner/admin listing attribute hydration.
-- Read-only and category-agnostic. Values are returned according to each field's declared type.

create or replace function public.rawaj_owner_fetch_listing_attributes_v1(
  p_listing_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_listing public.listings%rowtype;
  v_version_id uuid;
  v_version_number integer;
  v_taxonomy_node_id text;
  v_values jsonb := '{}'::jsonb;
  v_value_count integer := 0;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'listing_id_required' using errcode = '22023';
  end if;

  select listing_row.*
    into v_listing
  from public.listings listing_row
  where listing_row.id = p_listing_id;

  if not found then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;

  if v_listing.owner_id <> v_actor and not public.current_user_is_admin_like() then
    raise exception 'listing_attribute_read_forbidden' using errcode = '42501';
  end if;

  select
    version_row.id,
    version_row.version_number,
    assignment_row.taxonomy_node_id
    into v_version_id, v_version_number, v_taxonomy_node_id
  from public.taxonomy_versions version_row
  join public.listing_taxonomy_assignments assignment_row
    on assignment_row.listing_id = p_listing_id
  join public.taxonomy_version_nodes node_row
    on node_row.version_id = version_row.id
   and node_row.node_id = assignment_row.taxonomy_node_id
  where version_row.status = 'published'
    and node_row.is_active
    and node_row.is_leaf
  order by version_row.version_number desc
  limit 1;

  select
    coalesce(
      jsonb_object_agg(
        attribute_row.field_key,
        case field_row.field_type
          when 'text' then to_jsonb(attribute_row.value_text)
          when 'textarea' then to_jsonb(attribute_row.value_text)
          when 'integer' then to_jsonb(attribute_row.value_numeric::bigint)
          when 'year' then to_jsonb(attribute_row.value_numeric::integer)
          when 'numeric' then to_jsonb(attribute_row.value_numeric)
          when 'boolean' then to_jsonb(attribute_row.value_boolean)
          when 'date' then to_jsonb(attribute_row.value_date::text)
          when 'multi_select' then attribute_row.value_json
          else to_jsonb(attribute_row.value_key)
        end
        order by rule_row.sort_order, attribute_row.field_key
      ),
      '{}'::jsonb
    ),
    count(*)
    into v_values, v_value_count
  from public.listing_attribute_values attribute_row
  join public.field_definitions field_row
    on field_row.key = attribute_row.field_key
   and field_row.is_active
  left join public.taxonomy_field_rules rule_row
    on rule_row.version_id = v_version_id
   and rule_row.taxonomy_node_id = v_taxonomy_node_id
   and rule_row.field_key = attribute_row.field_key
  where attribute_row.listing_id = p_listing_id
    and (
      v_version_id is null
      or rule_row.field_key is not null
    );

  return jsonb_build_object(
    'listingId', v_listing.id,
    'listingUpdatedAt', v_listing.updated_at,
    'listingStatus', v_listing.status,
    'taxonomyVersionId', v_version_id,
    'taxonomyVersionNumber', v_version_number,
    'taxonomyNodeId', v_taxonomy_node_id,
    'valueCount', v_value_count,
    'values', v_values
  );
end;
$$;

revoke all on function public.rawaj_owner_fetch_listing_attributes_v1(uuid)
  from public, anon;
grant execute on function public.rawaj_owner_fetch_listing_attributes_v1(uuid)
  to authenticated;

comment on function public.rawaj_owner_fetch_listing_attributes_v1(uuid) is
  'Returns typed governed attribute values for an owned listing, or to admin-like staff, without direct table access or category-specific logic.';
