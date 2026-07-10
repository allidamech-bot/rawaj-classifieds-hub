-- RAWAJ Production Schema Truth Extractor
-- Purpose: read-only evidence collection from Supabase Production.
-- Safety: this file contains SELECT statements only and does not mutate schema or data.
-- Run in Supabase Production SQL Editor as a privileged project administrator.
-- Export each result grid as CSV or copy the complete results with section labels.

begin transaction read only;

-- 01. Supabase migration history
select
  '01_migration_history' as evidence_section,
  version,
  name,
  statements
from supabase_migrations.schema_migrations
order by version, name;

-- 02. User-facing schemas, tables, views, and RLS state
select
  '02_relations' as evidence_section,
  n.nspname as schema_name,
  c.relname as relation_name,
  case c.relkind
    when 'r' then 'table'
    when 'p' then 'partitioned_table'
    when 'v' then 'view'
    when 'm' then 'materialized_view'
    when 'f' then 'foreign_table'
    else c.relkind::text
  end as relation_type,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  pg_get_userbyid(c.relowner) as owner
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage')
  and c.relkind in ('r', 'p', 'v', 'm', 'f')
order by n.nspname, c.relname;

-- 03. Columns, defaults, identity, generated state, and nullability
select
  '03_columns' as evidence_section,
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_schema,
  c.udt_name,
  c.is_nullable,
  c.column_default,
  c.is_identity,
  c.identity_generation,
  c.is_generated,
  c.generation_expression
from information_schema.columns c
where c.table_schema in ('public', 'storage')
order by c.table_schema, c.table_name, c.ordinal_position;

-- 04. Primary, unique, foreign-key, exclusion, and check constraints
select
  '04_constraints' as evidence_section,
  n.nspname as schema_name,
  cls.relname as table_name,
  con.conname as constraint_name,
  case con.contype
    when 'p' then 'primary_key'
    when 'u' then 'unique'
    when 'f' then 'foreign_key'
    when 'c' then 'check'
    when 'x' then 'exclusion'
    else con.contype::text
  end as constraint_type,
  con.convalidated as validated,
  pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class cls on cls.oid = con.conrelid
join pg_namespace n on n.oid = cls.relnamespace
where n.nspname in ('public', 'storage')
order by n.nspname, cls.relname, con.conname;

-- 05. Indexes and definitions
select
  '05_indexes' as evidence_section,
  schemaname as schema_name,
  tablename as table_name,
  indexname as index_name,
  indexdef as definition
from pg_indexes
where schemaname in ('public', 'storage')
order by schemaname, tablename, indexname;

-- 06. Non-internal triggers
select
  '06_triggers' as evidence_section,
  n.nspname as schema_name,
  c.relname as table_name,
  t.tgname as trigger_name,
  t.tgenabled as enabled_state,
  pg_get_triggerdef(t.oid, true) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and n.nspname in ('public', 'storage')
order by n.nspname, c.relname, t.tgname;

-- 07. Functions and procedures, including security and search_path configuration
select
  '07_functions' as evidence_section,
  n.nspname as schema_name,
  p.proname as routine_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  case p.prokind
    when 'f' then 'function'
    when 'p' then 'procedure'
    when 'a' then 'aggregate'
    when 'w' then 'window'
    else p.prokind::text
  end as routine_type,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  p.proconfig as routine_config,
  pg_get_userbyid(p.proowner) as owner,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'storage')
order by n.nspname, p.proname, identity_arguments;

-- 08. Table/view grants
select
  '08_table_grants' as evidence_section,
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema in ('public', 'storage')
order by table_schema, table_name, grantee, privilege_type;

-- 09. Routine grants
select
  '09_routine_grants' as evidence_section,
  routine_schema,
  routine_name,
  specific_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_routine_grants
where routine_schema in ('public', 'storage')
order by routine_schema, routine_name, specific_name, grantee, privilege_type;

-- 10. RLS policies, including storage policies
select
  '10_rls_policies' as evidence_section,
  schemaname as schema_name,
  tablename as table_name,
  policyname as policy_name,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- 11. Custom enum/domain/composite/range types
select
  '11_custom_types' as evidence_section,
  n.nspname as schema_name,
  t.typname as type_name,
  case t.typtype
    when 'e' then 'enum'
    when 'd' then 'domain'
    when 'c' then 'composite'
    when 'r' then 'range'
    when 'm' then 'multirange'
    else t.typtype::text
  end as type_kind,
  e.enumsortorder,
  e.enumlabel,
  pg_get_userbyid(t.typowner) as owner
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
left join pg_enum e on e.enumtypid = t.oid
where n.nspname = 'public'
  and t.typtype in ('e', 'd', 'c', 'r', 'm')
order by n.nspname, t.typname, e.enumsortorder nulls first;

-- 12. Storage bucket truth
select
  '12_storage_buckets' as evidence_section,
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
from storage.buckets
order by id;

-- 13. Installed extensions
select
  '13_extensions' as evidence_section,
  e.extname as extension_name,
  e.extversion as extension_version,
  n.nspname as schema_name
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
order by e.extname;

-- 14. Publication membership relevant to Supabase Realtime
select
  '14_realtime_publication' as evidence_section,
  p.pubname as publication_name,
  n.nspname as schema_name,
  c.relname as table_name
from pg_publication p
join pg_publication_rel pr on pr.prpubid = p.oid
join pg_class c on c.oid = pr.prrelid
join pg_namespace n on n.oid = c.relnamespace
where p.pubname = 'supabase_realtime'
order by n.nspname, c.relname;

-- 15. Replica identity, required for some realtime update/delete payloads
select
  '15_replica_identity' as evidence_section,
  n.nspname as schema_name,
  c.relname as table_name,
  case c.relreplident
    when 'd' then 'default'
    when 'n' then 'nothing'
    when 'f' then 'full'
    when 'i' then 'index'
    else c.relreplident::text
  end as replica_identity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by n.nspname, c.relname;

-- Optional scheduled-jobs evidence:
-- Run the following only when extension `pg_cron` appears in section 13.
-- select '16_scheduled_jobs' as evidence_section, * from cron.job order by jobid;

rollback;
