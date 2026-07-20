\set ON_ERROR_STOP on

begin;
set local session_replication_role = replica;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  ('00000000-0000-0000-0000-000000000000', 'a1100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner.rollback@rawaj.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a1100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'seller.rollback@rawaj.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a1100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'reporter.rollback@rawaj.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a1100000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'third.rollback@rawaj.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do update set
  email = excluded.email,
  updated_at = now();

insert into public.taxonomy_versions (
  id,
  version_number,
  status,
  based_on_version_id,
  change_summary,
  created_at,
  updated_at
)
select
  'a1100000-0000-4000-8000-000000000099',
  coalesce(max(version_number), 0) + 1000,
  'draft',
  (select id from public.taxonomy_versions where status = 'published' order by version_number desc limit 1),
  'Disposable admin Data Quality rollback fixture',
  now(),
  now()
from public.taxonomy_versions
on conflict (id) do nothing;

commit;

DO $verification$
DECLARE
  v_user_count bigint;
  v_taxonomy_count bigint;
BEGIN
  SELECT count(*) INTO v_user_count
  FROM auth.users
  WHERE id::text LIKE 'a1100000-0000-4000-8000-%';

  SELECT count(*) INTO v_taxonomy_count
  FROM public.taxonomy_versions
  WHERE id = 'a1100000-0000-4000-8000-000000000099';

  IF v_user_count <> 4 THEN
    RAISE EXCEPTION 'admin_auth_fixture_setup_count_invalid_%', v_user_count;
  END IF;

  IF v_taxonomy_count <> 1 THEN
    RAISE EXCEPTION 'admin_taxonomy_fixture_setup_count_invalid_%', v_taxonomy_count;
  END IF;

  RAISE NOTICE 'RAWAJ disposable admin fixtures created: 4 auth users and 1 taxonomy version.';
END;
$verification$;
