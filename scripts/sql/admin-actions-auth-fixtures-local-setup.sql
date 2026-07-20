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

commit;

DO $verification$
DECLARE
  v_count bigint;
BEGIN
  SELECT count(*) INTO v_count
  FROM auth.users
  WHERE id::text LIKE 'a1100000-0000-4000-8000-%';

  IF v_count <> 4 THEN
    RAISE EXCEPTION 'admin_auth_fixture_setup_count_invalid_%', v_count;
  END IF;

  RAISE NOTICE 'RAWAJ disposable admin auth fixtures created: 4 users.';
END;
$verification$;
