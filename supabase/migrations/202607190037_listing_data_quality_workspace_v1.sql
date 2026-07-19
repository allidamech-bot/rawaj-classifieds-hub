-- RAWAJ Taxonomy, Data & Search Foundation V1: cross-category listing data quality workspace.
-- This migration is additive and review-only. It never rewrites listing values automatically.
-- Every marketplace category is evaluated through its governed taxonomy leaf and field rules.

create table if not exists public.listing_data_quality_issues (
  id uuid primary key default gen_random_uuid(),
  issue_key text not null unique,
  listing_id uuid not null references public.listings(id) on delete cascade,
  taxonomy_version_id uuid not null references public.taxonomy_versions(id) on delete cascade,
  taxonomy_node_id text,
  category_id text not null references public.categories(id) on delete restrict,
  subcategory_id text references public.subcategories(id) on delete set null,
  field_key text references public.field_definitions(key) on delete set null,
  issue_type text not null,
  issue_code text not null,
  severity text not null default 'warning',
  status text not null default 'open',
  evidence jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_data_quality_issue_type_check check (
    issue_type in (
      'taxonomy',
      'required_field',
      'unexpected_field',
      'invalid_value',
      'legacy_payload',
      'specialized_reference'
    )
  ),
  constraint listing_data_quality_issue_code_format check (
    issue_code ~ '^[a-z0-9_]{3,120}$'
  ),
  constraint listing_data_quality_severity_check check (
    severity in ('info', 'warning', 'error', 'blocking')
  ),
  constraint listing_data_quality_status_check check (
    status in ('open', 'needs_review', 'seller_action', 'dismissed', 'resolved')
  ),
  constraint listing_data_quality_evidence_object check (jsonb_typeof(evidence) = 'object'),
  constraint listing_data_quality_review_note_length check (
    review_note is null or char_length(review_note) <= 2000
  )
);

create index if not exists listing_data_quality_status_severity_idx
  on public.listing_data_quality_issues(status, severity, updated_at desc, id);
create index if not exists listing_data_quality_category_status_idx
  on public.listing_data_quality_issues(category_id, status, updated_at desc, id);
create index if not exists listing_data_quality_listing_idx
  on public.listing_data_quality_issues(listing_id, taxonomy_version_id, status);
create index if not exists listing_data_quality_field_idx
  on public.listing_data_quality_issues(field_key, status)
  where field_key is not null;

alter table public.listing_data_quality_issues enable row level security;
revoke all on table public.listing_data_quality_issues from public, anon, authenticated;

create or replace function public.rawaj_upsert_listing_data_quality_issue_v1(
  p_listing_id uuid,
  p_taxonomy_version_id uuid,
  p_taxonomy_node_id text,
  p_category_id text,
  p_subcategory_id text,
  p_field_key text,
  p_issue_type text,
  p_issue_code text,
  p_severity text,
  p_evidence jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_issue_key text;
begin
  v_issue_key := concat_ws(
    ':',
    p_listing_id::text,
    p_taxonomy_version_id::text,
    p_issue_code,
    coalesce(p_field_key, '-')
  );

  insert into public.listing_data_quality_issues (
    issue_key,
    listing_id,
    taxonomy_version_id,
    taxonomy_node_id,
    category_id,
    subcategory_id,
    field_key,
    issue_type,
    issue_code,
    severity,
    status,
    evidence,
    detected_at,
    last_seen_at,
    created_at,
    updated_at
  ) values (
    v_issue_key,
    p_listing_id,
    p_taxonomy_version_id,
    p_taxonomy_node_id,
    p_category_id,
    p_subcategory_id,
    p_field_key,
    p_issue_type,
    p_issue_code,
    p_severity,
    'open',
    coalesce(p_evidence, '{}'::jsonb),
    now(),
    now(),
    now(),
    now()
  )
  on conflict (issue_key) do update
  set taxonomy_node_id = excluded.taxonomy_node_id,
      category_id = excluded.category_id,
      subcategory_id = excluded.subcategory_id,
      field_key = excluded.field_key,
      issue_type = excluded.issue_type,
      severity = excluded.severity,
      status = case
        when listing_data_quality_issues.status in ('dismissed', 'seller_action')
          then listing_data_quality_issues.status
        else 'open'
      end,
      evidence = excluded.evidence,
      last_seen_at = now(),
      resolved_at = case
        when listing_data_quality_issues.status in ('dismissed', 'seller_action')
          then listing_data_quality_issues.resolved_at
        else null
      end,
      updated_at = now();
end;
$$;

revoke all on function public.rawaj_upsert_listing_data_quality_issue_v1(
  uuid, uuid, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;

create or replace function public.rawaj_owner_refresh_listing_data_quality_v1(
  p_version_id uuid,
  p_limit integer default 500,
  p_offset integer default 0
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 500), 1), 1000);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_version_status text;
  v_listing record;
  v_target_node_id text;
  v_target_node public.taxonomy_version_nodes%rowtype;
  v_root_category_id text;
  v_queue_status text;
  v_field record;
  v_scanned integer := 0;
  v_open_issues integer := 0;
  v_blocking_issues integer := 0;
begin
  if v_actor is null or not public.current_user_has_role('owner') then
    raise exception 'owner_permission_required' using errcode = '42501';
  end if;

  select version_row.status
    into v_version_status
  from public.taxonomy_versions version_row
  where version_row.id = p_version_id;

  if v_version_status is null then
    raise exception 'taxonomy_version_not_found' using errcode = 'P0002';
  end if;

  if v_version_status not in ('draft', 'published') then
    raise exception 'taxonomy_version_not_scannable' using errcode = '55000';
  end if;

  create temporary table if not exists pg_temp.rawaj_quality_scanned_listings (
    listing_id uuid primary key
  ) on commit drop;
  truncate table pg_temp.rawaj_quality_scanned_listings;

  for v_listing in
    select listing_row.*
    from public.listings listing_row
    order by listing_row.created_at, listing_row.id
    limit v_limit
    offset v_offset
  loop
    v_scanned := v_scanned + 1;
    insert into pg_temp.rawaj_quality_scanned_listings(listing_id)
    values (v_listing.id)
    on conflict do nothing;

    update public.listing_data_quality_issues issue_row
    set status = 'resolved',
        resolved_at = now(),
        updated_at = now()
    where issue_row.listing_id = v_listing.id
      and issue_row.taxonomy_version_id = p_version_id
      and issue_row.status in ('open', 'needs_review');

    v_target_node_id := null;
    v_queue_status := null;
    v_root_category_id := null;

    select queue_row.suggested_taxonomy_node_id, queue_row.status
      into v_target_node_id, v_queue_status
    from public.taxonomy_mapping_queue queue_row
    where queue_row.listing_id = v_listing.id
      and queue_row.suggested_version_id = p_version_id
      and queue_row.status not in ('rejected', 'unresolved')
    order by
      case queue_row.status
        when 'confirmed' then 1
        when 'auto_mapped' then 2
        when 'needs_review' then 3
        else 4
      end,
      queue_row.confidence desc nulls last
    limit 1;

    if v_target_node_id is null then
      select mapping_row.taxonomy_node_id
        into v_target_node_id
      from public.taxonomy_legacy_mappings mapping_row
      where mapping_row.version_id = p_version_id
        and mapping_row.legacy_category_id = v_listing.category_id
        and (
          mapping_row.legacy_subcategory_id is not distinct from v_listing.subcategory_id
          or mapping_row.legacy_subcategory_id is null
        )
        and mapping_row.is_active
      order by
        (mapping_row.legacy_subcategory_id is not null) desc,
        mapping_row.priority desc,
        mapping_row.created_at
      limit 1;
    end if;

    if v_target_node_id is null and v_version_status = 'published' then
      select assignment_row.taxonomy_node_id
        into v_target_node_id
      from public.listing_taxonomy_assignments assignment_row
      join public.taxonomy_version_nodes version_node
        on version_node.version_id = p_version_id
       and version_node.node_id = assignment_row.taxonomy_node_id
      where assignment_row.listing_id = v_listing.id
      limit 1;
    end if;

    if v_target_node_id is null then
      perform public.rawaj_upsert_listing_data_quality_issue_v1(
        v_listing.id,
        p_version_id,
        null,
        v_listing.category_id,
        v_listing.subcategory_id,
        null,
        'taxonomy',
        'taxonomy_unresolved',
        'blocking',
        jsonb_build_object(
          'listingCategoryId', v_listing.category_id,
          'listingSubcategoryId', v_listing.subcategory_id,
          'queueStatus', v_queue_status
        )
      );
      continue;
    end if;

    select node_row.*
      into v_target_node
    from public.taxonomy_version_nodes node_row
    where node_row.version_id = p_version_id
      and node_row.node_id = v_target_node_id;

    if not found or not v_target_node.is_active or not v_target_node.is_leaf then
      perform public.rawaj_upsert_listing_data_quality_issue_v1(
        v_listing.id,
        p_version_id,
        v_target_node_id,
        v_listing.category_id,
        v_listing.subcategory_id,
        null,
        'taxonomy',
        'taxonomy_target_not_active_leaf',
        'blocking',
        jsonb_build_object('targetNodeId', v_target_node_id)
      );
      continue;
    end if;

    with recursive lineage as (
      select node_row.node_id, node_row.parent_node_id, node_row.depth, node_row.legacy_category_id
      from public.taxonomy_version_nodes node_row
      where node_row.version_id = p_version_id
        and node_row.node_id = v_target_node_id

      union all

      select parent_row.node_id, parent_row.parent_node_id, parent_row.depth, parent_row.legacy_category_id
      from public.taxonomy_version_nodes parent_row
      join lineage child_row on child_row.parent_node_id = parent_row.node_id
      where parent_row.version_id = p_version_id
    )
    select lineage.legacy_category_id
      into v_root_category_id
    from lineage
    where lineage.legacy_category_id is not null
    order by lineage.depth asc
    limit 1;

    if v_root_category_id is null or v_root_category_id is distinct from v_listing.category_id then
      perform public.rawaj_upsert_listing_data_quality_issue_v1(
        v_listing.id,
        p_version_id,
        v_target_node_id,
        v_listing.category_id,
        v_listing.subcategory_id,
        null,
        'taxonomy',
        'taxonomy_category_mismatch',
        'blocking',
        jsonb_build_object(
          'listingCategoryId', v_listing.category_id,
          'targetRootCategoryId', v_root_category_id
        )
      );
    end if;

    if v_queue_status in ('pending', 'needs_review') then
      perform public.rawaj_upsert_listing_data_quality_issue_v1(
        v_listing.id,
        p_version_id,
        v_target_node_id,
        v_listing.category_id,
        v_listing.subcategory_id,
        null,
        'taxonomy',
        'taxonomy_mapping_needs_review',
        'warning',
        jsonb_build_object('queueStatus', v_queue_status)
      );
    end if;

    for v_field in
      select rule_row.field_key, field_row.label_ar, field_row.label_en
      from public.taxonomy_field_rules rule_row
      join public.field_definitions field_row
        on field_row.key = rule_row.field_key
       and field_row.is_active
      left join public.listing_attribute_values attribute_row
        on attribute_row.listing_id = v_listing.id
       and attribute_row.field_key = rule_row.field_key
      where rule_row.version_id = p_version_id
        and rule_row.taxonomy_node_id = v_target_node_id
        and rule_row.is_required
        and attribute_row.field_key is null
    loop
      perform public.rawaj_upsert_listing_data_quality_issue_v1(
        v_listing.id,
        p_version_id,
        v_target_node_id,
        v_listing.category_id,
        v_listing.subcategory_id,
        v_field.field_key,
        'required_field',
        'required_field_missing',
        'blocking',
        jsonb_build_object('labelAr', v_field.label_ar, 'labelEn', v_field.label_en)
      );
    end loop;

    for v_field in
      select attribute_row.field_key
      from public.listing_attribute_values attribute_row
      where attribute_row.listing_id = v_listing.id
        and not exists (
          select 1
          from public.taxonomy_field_rules rule_row
          where rule_row.version_id = p_version_id
            and rule_row.taxonomy_node_id = v_target_node_id
            and rule_row.field_key = attribute_row.field_key
        )
    loop
      perform public.rawaj_upsert_listing_data_quality_issue_v1(
        v_listing.id,
        p_version_id,
        v_target_node_id,
        v_listing.category_id,
        v_listing.subcategory_id,
        v_field.field_key,
        'unexpected_field',
        'field_not_allowed_for_leaf',
        'error',
        jsonb_build_object('fieldKey', v_field.field_key)
      );
    end loop;

    for v_field in
      select
        attribute_row.field_key,
        attribute_row.value_key,
        field_row.option_set_key
      from public.listing_attribute_values attribute_row
      join public.field_definitions field_row
        on field_row.key = attribute_row.field_key
       and field_row.option_set_key is not null
      where attribute_row.listing_id = v_listing.id
        and (
          attribute_row.value_key is null
          or not exists (
            select 1
            from public.option_values option_row
            where option_row.option_set_key = field_row.option_set_key
              and option_row.value_key = attribute_row.value_key
              and option_row.is_active
          )
        )
    loop
      perform public.rawaj_upsert_listing_data_quality_issue_v1(
        v_listing.id,
        p_version_id,
        v_target_node_id,
        v_listing.category_id,
        v_listing.subcategory_id,
        v_field.field_key,
        'invalid_value',
        'controlled_option_invalid',
        'error',
        jsonb_build_object(
          'valueKey', v_field.value_key,
          'optionSetKey', v_field.option_set_key
        )
      );
    end loop;

    for v_field in
      select
        attribute_row.field_key,
        attribute_row.value_numeric,
        field_row.validation_schema ->> 'minimum' as minimum_value,
        field_row.validation_schema ->> 'maximum' as maximum_value
      from public.listing_attribute_values attribute_row
      join public.field_definitions field_row
        on field_row.key = attribute_row.field_key
      where attribute_row.listing_id = v_listing.id
        and attribute_row.value_numeric is not null
        and (
          (
            field_row.validation_schema ? 'minimum'
            and attribute_row.value_numeric < (field_row.validation_schema ->> 'minimum')::numeric
          )
          or (
            field_row.validation_schema ? 'maximum'
            and attribute_row.value_numeric > (field_row.validation_schema ->> 'maximum')::numeric
          )
        )
    loop
      perform public.rawaj_upsert_listing_data_quality_issue_v1(
        v_listing.id,
        p_version_id,
        v_target_node_id,
        v_listing.category_id,
        v_listing.subcategory_id,
        v_field.field_key,
        'invalid_value',
        'numeric_value_out_of_range',
        'error',
        jsonb_build_object(
          'value', v_field.value_numeric,
          'minimum', v_field.minimum_value,
          'maximum', v_field.maximum_value
        )
      );
    end loop;

    for v_field in
      select
        attribute_row.field_key,
        char_length(attribute_row.value_text) as actual_length,
        (field_row.validation_schema ->> 'maxLength')::integer as maximum_length
      from public.listing_attribute_values attribute_row
      join public.field_definitions field_row
        on field_row.key = attribute_row.field_key
      where attribute_row.listing_id = v_listing.id
        and attribute_row.value_text is not null
        and field_row.validation_schema ? 'maxLength'
        and char_length(attribute_row.value_text) > (field_row.validation_schema ->> 'maxLength')::integer
    loop
      perform public.rawaj_upsert_listing_data_quality_issue_v1(
        v_listing.id,
        p_version_id,
        v_target_node_id,
        v_listing.category_id,
        v_listing.subcategory_id,
        v_field.field_key,
        'invalid_value',
        'text_value_too_long',
        'error',
        jsonb_build_object(
          'actualLength', v_field.actual_length,
          'maximumLength', v_field.maximum_length
        )
      );
    end loop;

    if jsonb_typeof(v_listing.details) <> 'object' then
      perform public.rawaj_upsert_listing_data_quality_issue_v1(
        v_listing.id,
        p_version_id,
        v_target_node_id,
        v_listing.category_id,
        v_listing.subcategory_id,
        null,
        'legacy_payload',
        'legacy_details_not_object',
        'error',
        jsonb_build_object('jsonType', jsonb_typeof(v_listing.details))
      );
    elsif v_listing.details <> '{}'::jsonb then
      perform public.rawaj_upsert_listing_data_quality_issue_v1(
        v_listing.id,
        p_version_id,
        v_target_node_id,
        v_listing.category_id,
        v_listing.subcategory_id,
        null,
        'legacy_payload',
        'legacy_details_require_mapping',
        case
          when exists (
            select 1
            from public.listing_attribute_values attribute_row
            where attribute_row.listing_id = v_listing.id
          ) then 'warning'
          else 'error'
        end,
        jsonb_build_object(
          'legacyKeys', coalesce(
            (select jsonb_agg(detail_key order by detail_key) from jsonb_object_keys(v_listing.details) detail_key),
            '[]'::jsonb
          ),
          'canonicalAttributeCount', (
            select count(*)
            from public.listing_attribute_values attribute_row
            where attribute_row.listing_id = v_listing.id
          )
        )
      );
    end if;

    if exists (
      select 1
      from public.vehicle_reference_review_queue vehicle_queue
      where vehicle_queue.listing_id = v_listing.id
        and vehicle_queue.status in ('pending', 'matched', 'created')
    ) then
      perform public.rawaj_upsert_listing_data_quality_issue_v1(
        v_listing.id,
        p_version_id,
        v_target_node_id,
        v_listing.category_id,
        v_listing.subcategory_id,
        null,
        'specialized_reference',
        'vehicle_reference_resolution_pending',
        'warning',
        jsonb_build_object(
          'pendingCount', (
            select count(*)
            from public.vehicle_reference_review_queue vehicle_queue
            where vehicle_queue.listing_id = v_listing.id
              and vehicle_queue.status in ('pending', 'matched', 'created')
          )
        )
      );
    end if;
  end loop;

  select count(*), count(*) filter (where issue_row.severity = 'blocking')
    into v_open_issues, v_blocking_issues
  from public.listing_data_quality_issues issue_row
  join pg_temp.rawaj_quality_scanned_listings scanned_row
    on scanned_row.listing_id = issue_row.listing_id
  where issue_row.taxonomy_version_id = p_version_id
    and issue_row.status in ('open', 'needs_review', 'seller_action');

  perform public.rawaj_insert_audit_log(
    'data_quality.listings_scanned',
    'taxonomy_versions',
    p_version_id::text,
    jsonb_build_object(
      'versionStatus', v_version_status,
      'limit', v_limit,
      'offset', v_offset,
      'scannedCount', v_scanned,
      'openIssueCount', v_open_issues,
      'blockingIssueCount', v_blocking_issues
    )
  );

  return jsonb_build_object(
    'versionId', p_version_id,
    'versionStatus', v_version_status,
    'scannedCount', v_scanned,
    'limit', v_limit,
    'offset', v_offset,
    'openIssueCount', v_open_issues,
    'blockingIssueCount', v_blocking_issues
  );
end;
$$;

create or replace function public.rawaj_admin_fetch_listing_data_quality_v1(
  p_status text default null,
  p_issue_type text default null,
  p_category_id text default null,
  p_severity text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
  v_issue_type text := nullif(lower(btrim(coalesce(p_issue_type, ''))), '');
  v_category_id text := nullif(btrim(coalesce(p_category_id, '')), '');
  v_severity text := nullif(lower(btrim(coalesce(p_severity, ''))), '');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if auth.uid() is null or not public.current_user_is_admin_like() then
    raise exception 'admin_permission_required' using errcode = '42501';
  end if;

  if v_status is not null
     and v_status not in ('open', 'needs_review', 'seller_action', 'dismissed', 'resolved') then
    raise exception 'invalid_data_quality_status' using errcode = '22023';
  end if;

  if v_issue_type is not null
     and v_issue_type not in (
       'taxonomy', 'required_field', 'unexpected_field',
       'invalid_value', 'legacy_payload', 'specialized_reference'
     ) then
    raise exception 'invalid_data_quality_issue_type' using errcode = '22023';
  end if;

  if v_severity is not null
     and v_severity not in ('info', 'warning', 'error', 'blocking') then
    raise exception 'invalid_data_quality_severity' using errcode = '22023';
  end if;

  with filtered as (
    select issue_row.*
    from public.listing_data_quality_issues issue_row
    where (v_status is null or issue_row.status = v_status)
      and (v_issue_type is null or issue_row.issue_type = v_issue_type)
      and (v_category_id is null or issue_row.category_id = v_category_id)
      and (v_severity is null or issue_row.severity = v_severity)
  ),
  page_rows as (
    select filtered.*
    from filtered
    order by
      case filtered.severity
        when 'blocking' then 1
        when 'error' then 2
        when 'warning' then 3
        else 4
      end,
      case filtered.status
        when 'open' then 1
        when 'needs_review' then 2
        when 'seller_action' then 3
        when 'dismissed' then 4
        else 5
      end,
      filtered.updated_at desc,
      filtered.id
    limit v_limit
    offset v_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'limit', v_limit,
    'offset', v_offset,
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', page_row.id,
          'listingId', page_row.listing_id,
          'listingTitle', listing_row.title,
          'listingStatus', listing_row.status,
          'ownerId', listing_row.owner_id,
          'categoryId', page_row.category_id,
          'categoryNameAr', category_row.name_ar,
          'categoryNameEn', category_row.name_en,
          'subcategoryId', page_row.subcategory_id,
          'subcategoryNameAr', subcategory_row.name_ar,
          'subcategoryNameEn', subcategory_row.name_en,
          'taxonomyVersionId', page_row.taxonomy_version_id,
          'taxonomyVersionNumber', version_row.version_number,
          'taxonomyVersionStatus', version_row.status,
          'taxonomyNodeId', page_row.taxonomy_node_id,
          'taxonomyNameAr', node_row.name_ar,
          'taxonomyNameEn', node_row.name_en,
          'fieldKey', page_row.field_key,
          'fieldLabelAr', field_row.label_ar,
          'fieldLabelEn', field_row.label_en,
          'issueType', page_row.issue_type,
          'issueCode', page_row.issue_code,
          'severity', page_row.severity,
          'status', page_row.status,
          'evidence', page_row.evidence,
          'detectedAt', page_row.detected_at,
          'lastSeenAt', page_row.last_seen_at,
          'reviewedBy', page_row.reviewed_by,
          'reviewedAt', page_row.reviewed_at,
          'reviewNote', page_row.review_note,
          'resolvedAt', page_row.resolved_at,
          'createdAt', page_row.created_at,
          'updatedAt', page_row.updated_at
        )
        order by
          case page_row.severity
            when 'blocking' then 1
            when 'error' then 2
            when 'warning' then 3
            else 4
          end,
          page_row.updated_at desc,
          page_row.id
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from page_rows page_row
  join public.listings listing_row on listing_row.id = page_row.listing_id
  join public.categories category_row on category_row.id = page_row.category_id
  left join public.subcategories subcategory_row on subcategory_row.id = page_row.subcategory_id
  join public.taxonomy_versions version_row on version_row.id = page_row.taxonomy_version_id
  left join public.taxonomy_version_nodes node_row
    on node_row.version_id = page_row.taxonomy_version_id
   and node_row.node_id = page_row.taxonomy_node_id
  left join public.field_definitions field_row on field_row.key = page_row.field_key;

  return coalesce(
    v_result,
    jsonb_build_object('total', 0, 'limit', v_limit, 'offset', v_offset, 'items', '[]'::jsonb)
  );
end;
$$;

create or replace function public.rawaj_admin_review_listing_data_quality_v1(
  p_issue_id uuid,
  p_decision text,
  p_note text default null,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_issue public.listing_data_quality_issues%rowtype;
  v_next_status text;
  v_updated_at timestamptz;
begin
  if v_actor is null or not public.current_user_is_admin_like() then
    raise exception 'admin_permission_required' using errcode = '42501';
  end if;

  if p_issue_id is null then
    raise exception 'data_quality_issue_id_required' using errcode = '22023';
  end if;

  if v_decision not in ('needs_review', 'seller_action', 'dismiss', 'resolve', 'reopen') then
    raise exception 'data_quality_review_decision_invalid' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'data_quality_review_note_too_long' using errcode = '22023';
  end if;

  select issue_row.*
    into v_issue
  from public.listing_data_quality_issues issue_row
  where issue_row.id = p_issue_id
  for update;

  if not found then
    raise exception 'data_quality_issue_not_found' using errcode = 'P0002';
  end if;

  if p_expected_updated_at is null
     or v_issue.updated_at is distinct from p_expected_updated_at then
    raise exception 'stale_data_quality_review' using errcode = '40001';
  end if;

  v_next_status := case v_decision
    when 'needs_review' then 'needs_review'
    when 'seller_action' then 'seller_action'
    when 'dismiss' then 'dismissed'
    when 'resolve' then 'resolved'
    else 'open'
  end;

  update public.listing_data_quality_issues
  set status = v_next_status,
      reviewed_by = v_actor,
      reviewed_at = now(),
      review_note = v_note,
      resolved_at = case
        when v_next_status in ('dismissed', 'resolved') then now()
        else null
      end,
      updated_at = now()
  where id = p_issue_id
  returning updated_at into v_updated_at;

  perform public.rawaj_insert_audit_log(
    'data_quality.issue_reviewed',
    'listing_data_quality_issues',
    p_issue_id::text,
    jsonb_build_object(
      'listingId', v_issue.listing_id,
      'categoryId', v_issue.category_id,
      'issueType', v_issue.issue_type,
      'issueCode', v_issue.issue_code,
      'fieldKey', v_issue.field_key,
      'previousStatus', v_issue.status,
      'nextStatus', v_next_status,
      'decision', v_decision,
      'note', v_note
    )
  );

  return jsonb_build_object(
    'id', p_issue_id,
    'listingId', v_issue.listing_id,
    'status', v_next_status,
    'reviewedAt', now(),
    'updatedAt', v_updated_at
  );
end;
$$;

revoke all on function public.rawaj_owner_refresh_listing_data_quality_v1(uuid, integer, integer)
  from public, anon;
grant execute on function public.rawaj_owner_refresh_listing_data_quality_v1(uuid, integer, integer)
  to authenticated;

revoke all on function public.rawaj_admin_fetch_listing_data_quality_v1(
  text, text, text, text, integer, integer
) from public, anon;
grant execute on function public.rawaj_admin_fetch_listing_data_quality_v1(
  text, text, text, text, integer, integer
) to authenticated;

revoke all on function public.rawaj_admin_review_listing_data_quality_v1(
  uuid, text, text, timestamptz
) from public, anon;
grant execute on function public.rawaj_admin_review_listing_data_quality_v1(
  uuid, text, text, timestamptz
) to authenticated;

comment on table public.listing_data_quality_issues is
  'Cross-category listing quality findings derived from governed taxonomy and field schemas. Review-only; no automatic listing mutation.';
comment on function public.rawaj_owner_refresh_listing_data_quality_v1(uuid, integer, integer) is
  'Scans listings across every marketplace category against a selected draft or published taxonomy version without changing listing values.';
comment on function public.rawaj_admin_fetch_listing_data_quality_v1(text, text, text, text, integer, integer) is
  'Returns the governed cross-category data-quality work queue to admin-like users.';
comment on function public.rawaj_admin_review_listing_data_quality_v1(uuid, text, text, timestamptz) is
  'Records a stale-safe administrative disposition for a data-quality issue without rewriting the listing.';
