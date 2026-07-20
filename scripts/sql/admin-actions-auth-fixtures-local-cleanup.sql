\set ON_ERROR_STOP on

begin;
set local session_replication_role = replica;

delete from public.taxonomy_versions
where id = 'a1100000-0000-4000-8000-000000000099';

delete from auth.users
where id::text like 'a1100000-0000-4000-8000-%';

commit;

DO $verification$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id::text LIKE 'a1100000-0000-4000-8000-%'
  ) THEN
    RAISE EXCEPTION 'admin_auth_fixture_cleanup_failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.taxonomy_versions
    WHERE id = 'a1100000-0000-4000-8000-000000000099'
  ) THEN
    RAISE EXCEPTION 'admin_taxonomy_fixture_cleanup_failed';
  END IF;

  RAISE NOTICE 'RAWAJ disposable admin auth and taxonomy fixture cleanup passed.';
END;
$verification$;
