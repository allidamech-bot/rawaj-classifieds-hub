-- RAWAJ Taxonomy, Data & Search Foundation V1: admin context for the cross-category quality workspace.
-- Read-only metadata. No taxonomy version is published and no listing data is changed here.

create or replace function public.rawaj_admin_fetch_data_quality_context_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_versions jsonb;
  v_categories jsonb;
  v_summary jsonb;
begin
  if auth.uid() is null or not public.current_user_is_admin_like() then
    raise exception 'admin_permission_required' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', version_row.id,
        'versionNumber', version_row.version_number,
        'status', version_row.status,
        'changeSummary', version_row.change_summary,
        'publishedAt', version_row.published_at,
        'createdAt', version_row.created_at,
        'updatedAt', version_row.updated_at,
        'nodeCount', (
          select count(*)
          from public.taxonomy_version_nodes node_row
          where node_row.version_id = version_row.id
        ),
        'activeLeafCount', (
          select count(*)
          from public.taxonomy_version_nodes node_row
          where node_row.version_id = version_row.id
            and node_row.is_active
            and node_row.is_leaf
        ),
        'fieldRuleCount', (
          select count(*)
          from public.taxonomy_field_rules rule_row
          where rule_row.version_id = version_row.id
        ),
        'openIssueCount', (
          select count(*)
          from public.listing_data_quality_issues issue_row
          where issue_row.taxonomy_version_id = version_row.id
            and issue_row.status in ('open', 'needs_review', 'seller_action')
        ),
        'blockingIssueCount', (
          select count(*)
          from public.listing_data_quality_issues issue_row
          where issue_row.taxonomy_version_id = version_row.id
            and issue_row.status in ('open', 'needs_review', 'seller_action')
            and issue_row.severity = 'blocking'
        )
      )
      order by
        case version_row.status when 'draft' then 1 when 'published' then 2 else 3 end,
        version_row.version_number desc
    ),
    '[]'::jsonb
  )
  into v_versions
  from public.taxonomy_versions version_row
  where version_row.status in ('draft', 'published');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', category_row.id,
        'nameAr', category_row.name_ar,
        'nameEn', category_row.name_en,
        'sortOrder', category_row.sort_order,
        'openIssueCount', (
          select count(*)
          from public.listing_data_quality_issues issue_row
          where issue_row.category_id = category_row.id
            and issue_row.status in ('open', 'needs_review', 'seller_action')
        ),
        'blockingIssueCount', (
          select count(*)
          from public.listing_data_quality_issues issue_row
          where issue_row.category_id = category_row.id
            and issue_row.status in ('open', 'needs_review', 'seller_action')
            and issue_row.severity = 'blocking'
        )
      )
      order by category_row.sort_order, category_row.id
    ),
    '[]'::jsonb
  )
  into v_categories
  from public.categories category_row
  where category_row.is_active;

  select jsonb_build_object(
    'total', count(*),
    'open', count(*) filter (where issue_row.status = 'open'),
    'needsReview', count(*) filter (where issue_row.status = 'needs_review'),
    'sellerAction', count(*) filter (where issue_row.status = 'seller_action'),
    'dismissed', count(*) filter (where issue_row.status = 'dismissed'),
    'resolved', count(*) filter (where issue_row.status = 'resolved'),
    'blocking', count(*) filter (
      where issue_row.severity = 'blocking'
        and issue_row.status in ('open', 'needs_review', 'seller_action')
    ),
    'errors', count(*) filter (
      where issue_row.severity = 'error'
        and issue_row.status in ('open', 'needs_review', 'seller_action')
    ),
    'warnings', count(*) filter (
      where issue_row.severity = 'warning'
        and issue_row.status in ('open', 'needs_review', 'seller_action')
    ),
    'affectedCategories', count(distinct issue_row.category_id) filter (
      where issue_row.status in ('open', 'needs_review', 'seller_action')
    ),
    'affectedListings', count(distinct issue_row.listing_id) filter (
      where issue_row.status in ('open', 'needs_review', 'seller_action')
    )
  )
  into v_summary
  from public.listing_data_quality_issues issue_row;

  return jsonb_build_object(
    'versions', v_versions,
    'categories', v_categories,
    'summary', coalesce(
      v_summary,
      jsonb_build_object(
        'total', 0,
        'open', 0,
        'needsReview', 0,
        'sellerAction', 0,
        'dismissed', 0,
        'resolved', 0,
        'blocking', 0,
        'errors', 0,
        'warnings', 0,
        'affectedCategories', 0,
        'affectedListings', 0
      )
    )
  );
end;
$$;

revoke all on function public.rawaj_admin_fetch_data_quality_context_v1()
  from public, anon;
grant execute on function public.rawaj_admin_fetch_data_quality_context_v1()
  to authenticated;

comment on function public.rawaj_admin_fetch_data_quality_context_v1() is
  'Returns draft/published taxonomy versions, all active marketplace categories, and cross-category data-quality counts to admin-like users.';
