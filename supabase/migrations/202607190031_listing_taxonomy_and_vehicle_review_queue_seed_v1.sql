-- RAWAJ Taxonomy, Data & Search Foundation V1: non-destructive listing mapping and vehicle-value review seeds.
-- This migration never changes listing taxonomy assignments, subcategories, or details.

DO $queue_seed$
declare
  v_draft_version_id uuid;
begin
  select id
    into v_draft_version_id
  from public.taxonomy_versions
  where version_number = 2
    and status = 'draft';

  if v_draft_version_id is null then
    raise exception 'Taxonomy draft V2 is required before seeding mapping review.';
  end if;

  with listing_candidates as (
    select
      listing_row.id as listing_id,
      listing_row.category_id,
      listing_row.subcategory_id,
      listing_row.details,
      assignment_row.taxonomy_node_id as current_taxonomy_node_id,
      explicit_mapping.taxonomy_node_id as explicit_target,
      case
        when explicit_mapping.taxonomy_node_id is not null then explicit_mapping.taxonomy_node_id
        when listing_row.category_id = 'cars' then 'cars-sale'
        when listing_row.category_id = 'mobiles'
          and (
            listing_row.details ? 'electronics_brand'
            or listing_row.details ? 'electronics_model'
            or listing_row.details ? 'brand'
            or listing_row.details ? 'model'
          ) then 'mobiles-phones'
        when listing_row.category_id = 'jobs' then 'jobs-opportunities'
        when listing_row.category_id = 'realestate' then
          case
            when lower(coalesce(listing_row.details ->> 'property_type', '')) = 'apartment'
              and lower(coalesce(listing_row.details ->> 'listing_purpose', 'sale')) = 'rent'
              then 'realestate-apartments-rent'
            when lower(coalesce(listing_row.details ->> 'property_type', '')) = 'apartment'
              then 'realestate-apartments-sale'
            when lower(coalesce(listing_row.details ->> 'property_type', '')) = 'house'
              and lower(coalesce(listing_row.details ->> 'listing_purpose', 'sale')) = 'rent'
              then 'realestate-houses-rent'
            when lower(coalesce(listing_row.details ->> 'property_type', '')) = 'house'
              then 'realestate-houses-sale'
            when lower(coalesce(listing_row.details ->> 'property_type', '')) = 'villa'
              then 'realestate-villas'
            when lower(coalesce(listing_row.details ->> 'property_type', '')) = 'land'
              then 'realestate-land'
            when lower(coalesce(listing_row.details ->> 'property_type', '')) = 'shop'
              then 'realestate-shops'
            when lower(coalesce(listing_row.details ->> 'property_type', '')) = 'office'
              then 'realestate-offices'
            when lower(coalesce(listing_row.details ->> 'property_type', '')) = 'warehouse'
              then 'realestate-warehouses'
            when lower(coalesce(listing_row.details ->> 'property_type', '')) = 'farm'
              then 'realestate-farms'
            else null
          end
        else null
      end as suggested_target
    from public.listings listing_row
    left join public.listing_taxonomy_assignments assignment_row
      on assignment_row.listing_id = listing_row.id
    left join public.taxonomy_legacy_mappings explicit_mapping
      on explicit_mapping.version_id = v_draft_version_id
     and explicit_mapping.legacy_category_id = listing_row.category_id
     and explicit_mapping.legacy_subcategory_id = listing_row.subcategory_id
     and explicit_mapping.is_active
  )
  insert into public.taxonomy_mapping_queue (
    listing_id,
    current_taxonomy_node_id,
    suggested_version_id,
    suggested_taxonomy_node_id,
    confidence,
    status,
    mapping_source,
    evidence,
    attempt_count
  )
  select
    candidate.listing_id,
    candidate.current_taxonomy_node_id,
    case when candidate.suggested_target is not null then v_draft_version_id else null end,
    candidate.suggested_target,
    case
      when candidate.explicit_target is not null then 0.9900
      when candidate.category_id = 'realestate' and candidate.suggested_target is not null then 0.8500
      when candidate.suggested_target is not null then 0.6500
      else null
    end,
    case
      when candidate.explicit_target is not null then 'auto_mapped'
      when candidate.suggested_target is not null then 'needs_review'
      else 'unresolved'
    end,
    case
      when candidate.explicit_target is not null then 'legacy_rule'
      when candidate.suggested_target is not null then 'structured_fields'
      else 'unknown'
    end,
    jsonb_build_object(
      'categoryId', candidate.category_id,
      'subcategoryId', candidate.subcategory_id,
      'detailKeys', coalesce(
        (select jsonb_agg(detail_key order by detail_key)
         from jsonb_object_keys(coalesce(candidate.details, '{}'::jsonb)) detail_key),
        '[]'::jsonb
      ),
      'draftVersion', 2
    ),
    1
  from listing_candidates candidate
  on conflict (listing_id) do update set
    current_taxonomy_node_id = excluded.current_taxonomy_node_id,
    suggested_version_id = excluded.suggested_version_id,
    suggested_taxonomy_node_id = excluded.suggested_taxonomy_node_id,
    confidence = excluded.confidence,
    status = excluded.status,
    mapping_source = excluded.mapping_source,
    evidence = excluded.evidence,
    attempt_count = public.taxonomy_mapping_queue.attempt_count + 1,
    updated_at = now()
  where public.taxonomy_mapping_queue.status in ('pending', 'auto_mapped', 'needs_review', 'unresolved');

  -- Queue unknown makes from both current and legacy detail keys.
  with raw_vehicle_values as (
    select
      listing_row.id as listing_id,
      listing_row.owner_id,
      nullif(btrim(coalesce(listing_row.details ->> 'car_make', listing_row.details ->> 'brand')), '') as raw_make,
      nullif(btrim(coalesce(listing_row.details ->> 'car_model', listing_row.details ->> 'model')), '') as raw_model
    from public.listings listing_row
    where listing_row.category_id = 'cars'
  ),
  normalized as (
    select
      raw_values.*,
      lower(regexp_replace(raw_values.raw_make, '[^[:alnum:]]+', '', 'g')) as normalized_make,
      lower(regexp_replace(raw_values.raw_model, '[^[:alnum:]]+', '', 'g')) as normalized_model
    from raw_vehicle_values raw_values
    where raw_values.raw_make is not null or raw_values.raw_model is not null
  ),
  resolved as (
    select
      normalized.*,
      resolved_make.id as make_id,
      resolved_model.id as model_id
    from normalized
    left join lateral (
      select make_row.id
      from public.vehicle_makes make_row
      where make_row.is_active
        and (
          lower(regexp_replace(make_row.name_en, '[^[:alnum:]]+', '', 'g')) = normalized.normalized_make
          or lower(regexp_replace(make_row.name_ar, '[^[:alnum:]]+', '', 'g')) = normalized.normalized_make
          or exists (
            select 1
            from unnest(make_row.aliases) alias_value
            where lower(regexp_replace(alias_value, '[^[:alnum:]]+', '', 'g')) = normalized.normalized_make
          )
        )
      order by make_row.sort_order, make_row.id
      limit 1
    ) resolved_make on true
    left join lateral (
      select model_row.id
      from public.vehicle_models model_row
      where model_row.make_id = resolved_make.id
        and model_row.is_active
        and (
          lower(regexp_replace(model_row.name_en, '[^[:alnum:]]+', '', 'g')) = normalized.normalized_model
          or lower(regexp_replace(model_row.name_ar, '[^[:alnum:]]+', '', 'g')) = normalized.normalized_model
          or exists (
            select 1
            from unnest(model_row.aliases) alias_value
            where lower(regexp_replace(alias_value, '[^[:alnum:]]+', '', 'g')) = normalized.normalized_model
          )
        )
      order by model_row.sort_order, model_row.id
      limit 1
    ) resolved_model on true
  )
  insert into public.vehicle_reference_review_queue (
    entity_type,
    raw_value,
    normalized_value,
    listing_id,
    requested_by,
    status
  )
  select
    'make',
    resolved.raw_make,
    resolved.normalized_make,
    resolved.listing_id,
    resolved.owner_id,
    'pending'
  from resolved
  where resolved.raw_make is not null
    and resolved.make_id is null
  on conflict (
    entity_type,
    (coalesce(parent_make_id, '')),
    (coalesce(parent_model_id, '')),
    normalized_value
  ) where status = 'pending'
  do update set
    occurrence_count = public.vehicle_reference_review_queue.occurrence_count + 1,
    listing_id = coalesce(public.vehicle_reference_review_queue.listing_id, excluded.listing_id),
    updated_at = now();

  -- A known make with an unknown or mismatched model is queued beneath that make.
  with raw_vehicle_values as (
    select
      listing_row.id as listing_id,
      listing_row.owner_id,
      nullif(btrim(coalesce(listing_row.details ->> 'car_make', listing_row.details ->> 'brand')), '') as raw_make,
      nullif(btrim(coalesce(listing_row.details ->> 'car_model', listing_row.details ->> 'model')), '') as raw_model
    from public.listings listing_row
    where listing_row.category_id = 'cars'
  ),
  normalized as (
    select
      raw_values.*,
      lower(regexp_replace(raw_values.raw_make, '[^[:alnum:]]+', '', 'g')) as normalized_make,
      lower(regexp_replace(raw_values.raw_model, '[^[:alnum:]]+', '', 'g')) as normalized_model
    from raw_vehicle_values raw_values
    where raw_values.raw_make is not null and raw_values.raw_model is not null
  ),
  resolved as (
    select
      normalized.*,
      resolved_make.id as make_id,
      resolved_model.id as model_id
    from normalized
    left join lateral (
      select make_row.id
      from public.vehicle_makes make_row
      where make_row.is_active
        and (
          lower(regexp_replace(make_row.name_en, '[^[:alnum:]]+', '', 'g')) = normalized.normalized_make
          or lower(regexp_replace(make_row.name_ar, '[^[:alnum:]]+', '', 'g')) = normalized.normalized_make
          or exists (
            select 1 from unnest(make_row.aliases) alias_value
            where lower(regexp_replace(alias_value, '[^[:alnum:]]+', '', 'g')) = normalized.normalized_make
          )
        )
      order by make_row.sort_order, make_row.id
      limit 1
    ) resolved_make on true
    left join lateral (
      select model_row.id
      from public.vehicle_models model_row
      where model_row.make_id = resolved_make.id
        and model_row.is_active
        and (
          lower(regexp_replace(model_row.name_en, '[^[:alnum:]]+', '', 'g')) = normalized.normalized_model
          or lower(regexp_replace(model_row.name_ar, '[^[:alnum:]]+', '', 'g')) = normalized.normalized_model
          or exists (
            select 1 from unnest(model_row.aliases) alias_value
            where lower(regexp_replace(alias_value, '[^[:alnum:]]+', '', 'g')) = normalized.normalized_model
          )
        )
      order by model_row.sort_order, model_row.id
      limit 1
    ) resolved_model on true
  )
  insert into public.vehicle_reference_review_queue (
    entity_type,
    parent_make_id,
    raw_value,
    normalized_value,
    listing_id,
    requested_by,
    status
  )
  select
    'model',
    resolved.make_id,
    resolved.raw_model,
    resolved.normalized_model,
    resolved.listing_id,
    resolved.owner_id,
    'pending'
  from resolved
  where resolved.make_id is not null
    and resolved.model_id is null
  on conflict (
    entity_type,
    (coalesce(parent_make_id, '')),
    (coalesce(parent_model_id, '')),
    normalized_value
  ) where status = 'pending'
  do update set
    occurrence_count = public.vehicle_reference_review_queue.occurrence_count + 1,
    listing_id = coalesce(public.vehicle_reference_review_queue.listing_id, excluded.listing_id),
    updated_at = now();
end;
$queue_seed$;

comment on table public.taxonomy_mapping_queue is
  'Private non-destructive migration queue. Seeded suggestions never change listings until a reviewed mapping is applied after taxonomy publication.';
