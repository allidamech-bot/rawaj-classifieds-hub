-- RAWAJ owner bootstrap.
-- Run manually in Supabase SQL editor after allidamech@gmail.com has signed up
-- and exists in auth.users. This file must not be run from frontend code.

do $$
declare
  owner_user_id uuid;
begin
  select id
  into owner_user_id
  from auth.users
  where lower(email) = lower('allidamech@gmail.com')
  limit 1;

  if owner_user_id is null then
    raise notice 'Owner bootstrap skipped: allidamech@gmail.com does not exist in auth.users yet.';
    return;
  end if;

  insert into public.profiles (
    id,
    email,
    display_name,
    account_status,
    verification_status
  )
  values (
    owner_user_id,
    'allidamech@gmail.com',
    'صاحب التطبيق',
    'active',
    'verified'
  )
  on conflict (id) do update
    set email = excluded.email,
        account_status = 'active',
        verification_status = 'verified',
        updated_at = now();

  insert into public.user_roles (
    user_id,
    role,
    assigned_by,
    note
  )
  values (
    owner_user_id,
    'owner',
    owner_user_id,
    'Manual RAWAJ owner bootstrap for allidamech@gmail.com'
  )
  on conflict (user_id, role) do nothing;
end $$;
