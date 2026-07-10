-- RAWAJ Production Schema Truth Extractor
-- Purpose: read-only evidence collection from Supabase Production.
-- Safety: SELECT statements only. No schema or data mutation.
--
-- Supabase SQL Editor displays only the final result grid when multiple SELECTs
-- are executed. This extractor therefore returns one JSONB object containing all
-- catalog sections required for Production reconciliation.

with
public_tables as (
  select
    c.oid,
    n.nspname as schema_name,
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced,
    c.relreplident
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
),
columns_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', t.schema_name,
        'table', t.table_name,
        'columns', t.columns
      ) order by t.schema_name, t.table_name
    ),
    '[]'::jsonb
  ) as value
  from (
    select
      pt.schema_name,
      pt.table_name,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'position', a.attnum,
            'name', a.attname,
            'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
            'nullable', not a.attnotnull,
            'default', pg_catalog.pg_get_expr(d.adbin, d.adrelid)
          ) order by a.attnum
        ) filter (where a.attname is not null),
        '[]'::jsonb
      ) as columns
    from public_tables pt
    left join pg_catalog.pg_attribute a
      on a.attrelid = pt.oid
     and a.attnum > 0
     and not a.attisdropped
    left join pg_catalog.pg_attrdef d
      on d.adrelid = a.attrelid
     and d.adnum = a.attnum
    group by pt.schema_name, pt.table_name
  ) t
),
constraints_json as (
  select jsonb_build_object(
    'all', coalesce(jsonb_agg(
      jsonb_build_object(
        'schema', n.nspname,
        'table', c.relname,
        'name', con.conname,
        'type', con.contype,
        'validated', con.convalidated,
        'definition', pg_catalog.pg_get_constraintdef(con.oid, true)
      ) order by n.nspname, c.relname, con.conname
    ), '[]'::jsonb),
    'non_validated', coalesce(jsonb_agg(
      jsonb_build_object(
        'schema', n.nspname,
        'table', c.relname,
        'name', con.conname,
        'type', con.contype,
        'definition', pg_catalog.pg_get_constraintdef(con.oid, true)
      ) order by n.nspname, c.relname, con.conname
    ) filter (where not con.convalidated), '[]'::jsonb)
  ) as value
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_class c on c.oid = con.conrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
),
indexes_json as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'schema', n.nspname,
      'table', c.relname,
      'name', i.relname,
      'unique', x.indisunique,
      'primary', x.indisprimary,
      'valid', x.indisvalid,
      'ready', x.indisready,
      'definition', pg_catalog.pg_get_indexdef(x.indexrelid)
    ) order by n.nspname, c.relname, i.relname
  ), '[]'::jsonb) as value
  from pg_catalog.pg_index x
  join pg_catalog.pg_class c on c.oid = x.indrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_class i on i.oid = x.indexrelid
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
),
triggers_json as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'schema', n.nspname,
      'table', c.relname,
      'name', t.tgname,
      'enabled', t.tgenabled,
      'definition', pg_catalog.pg_get_triggerdef(t.oid, true)
    ) order by n.nspname, c.relname, t.tgname
  ), '[]'::jsonb) as value
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and not t.tgisinternal
),
routines_json as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'schema', n.nspname,
      'name', p.proname,
      'arguments', pg_catalog.pg_get_function_identity_arguments(p.oid),
      'kind', case p.prokind when 'f' then 'function' when 'p' then 'procedure' else p.prokind::text end,
      'security_definer', p.prosecdef,
      'volatility', p.provolatile,
      'config', coalesce(p.proconfig, array[]::text[]),
      'definition', pg_catalog.pg_get_functiondef(p.oid)
    ) order by n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid)
  ), '[]'::jsonb) as value
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind in ('f', 'p')
),
security_definer_warnings_json as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'schema', n.nspname,
      'name', p.proname,
      'arguments', pg_catalog.pg_get_function_identity_arguments(p.oid)
    ) order by n.nspname, p.proname
  ), '[]'::jsonb) as value
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind in ('f', 'p')
    and p.prosecdef
    and not exists (
      select 1
      from unnest(coalesce(p.proconfig, array[]::text[])) as cfg(setting)
      where cfg.setting like 'search_path=%'
    )
),
table_grants_json as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'schema', table_schema,
      'table', table_name,
      'grantee', grantee,
      'privilege', privilege_type,
      'grantable', is_grantable
    ) order by table_schema, table_name, grantee, privilege_type
  ), '[]'::jsonb) as value
  from information_schema.role_table_grants
  where table_schema in ('public', 'storage')
),
routine_grants_json as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'schema', routine_schema,
      'routine', routine_name,
      'specific_name', specific_name,
      'grantee', grantee,
      'privilege', privilege_type,
      'grantable', is_grantable
    ) order by routine_schema, routine_name, specific_name, grantee, privilege_type
  ), '[]'::jsonb) as value
  from information_schema.role_routine_grants
  where routine_schema in ('public', 'storage')
),
policies_json as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'schema', schemaname,
      'table', tablename,
      'name', policyname,
      'permissive', permissive,
      'roles', roles,
      'command', cmd,
      'using', qual,
      'with_check', with_check
    ) order by schemaname, tablename, policyname
  ), '[]'::jsonb) as value
  from pg_catalog.pg_policies
  where schemaname in ('public', 'storage')
),
enums_json as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'schema', n.nspname,
      'name', t.typname,
      'labels', (
        select coalesce(jsonb_agg(e.enumlabel order by e.enumsortorder), '[]'::jsonb)
        from pg_catalog.pg_enum e
        where e.enumtypid = t.oid
      )
    ) order by n.nspname, t.typname
  ), '[]'::jsonb) as value
  from pg_catalog.pg_type t
  join pg_catalog.pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typtype = 'e'
),
buckets_json as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'public', public,
      'file_size_limit', file_size_limit,
      'allowed_mime_types', allowed_mime_types,
      'created_at', created_at,
      'updated_at', updated_at
    ) order by name
  ), '[]'::jsonb) as value
  from storage.buckets
),
extensions_json as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name', e.extname,
      'version', e.extversion,
      'schema', n.nspname
    ) order by e.extname
  ), '[]'::jsonb) as value
  from pg_catalog.pg_extension e
  join pg_catalog.pg_namespace n on n.oid = e.extnamespace
),
realtime_json as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'publication', p.pubname,
      'schema', n.nspname,
      'table', c.relname
    ) order by n.nspname, c.relname
  ), '[]'::jsonb) as value
  from pg_catalog.pg_publication p
  join pg_catalog.pg_publication_rel pr on pr.prpubid = p.oid
  join pg_catalog.pg_class c on c.oid = pr.prrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where p.pubname = 'supabase_realtime'
),
table_state_json as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'schema', pt.schema_name,
      'table', pt.table_name,
      'rls_enabled', pt.rls_enabled,
      'rls_forced', pt.rls_forced,
      'has_primary_key', exists (
        select 1 from pg_catalog.pg_constraint con
        where con.conrelid = pt.oid and con.contype = 'p'
      ),
      'replica_identity', case pt.relreplident
        when 'd' then 'default'
        when 'n' then 'nothing'
        when 'f' then 'full'
        when 'i' then 'index'
        else pt.relreplident::text
      end
    ) order by pt.table_name
  ), '[]'::jsonb) as value
  from public_tables pt
),
table_warnings_json as (
  select jsonb_build_object(
    'without_primary_key', coalesce(jsonb_agg(
      jsonb_build_object('schema', pt.schema_name, 'table', pt.table_name)
      order by pt.table_name
    ) filter (where not exists (
      select 1 from pg_catalog.pg_constraint con
      where con.conrelid = pt.oid and con.contype = 'p'
    )), '[]'::jsonb),
    'without_rls', coalesce(jsonb_agg(
      jsonb_build_object('schema', pt.schema_name, 'table', pt.table_name)
      order by pt.table_name
    ) filter (where not pt.rls_enabled), '[]'::jsonb)
  ) as value
  from public_tables pt
)
select jsonb_build_object(
  'public_table_state', (select value from table_state_json),
  'columns', (select value from columns_json),
  'constraints', (select value -> 'all' from constraints_json),
  'non_validated_constraints', (select value -> 'non_validated' from constraints_json),
  'indexes', (select value from indexes_json),
  'non_internal_triggers', (select value from triggers_json),
  'public_functions_and_procedures', (select value from routines_json),
  'security_definer_without_explicit_search_path', (select value from security_definer_warnings_json),
  'table_grants', (select value from table_grants_json),
  'routine_grants', (select value from routine_grants_json),
  'public_and_storage_rls_policies', (select value from policies_json),
  'public_enum_types', (select value from enums_json),
  'storage_buckets', (select value from buckets_json),
  'installed_extensions', (select value from extensions_json),
  'supabase_realtime_publication_membership', (select value from realtime_json),
  'table_warnings', (select value from table_warnings_json)
) as result;
