begin;

create or replace function public.rawaj_bootstrap_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_display_name text;
begin
  safe_display_name := nullif(
    left(
      btrim(
        coalesce(
          new.raw_user_meta_data ->> 'display_name',
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          ''
        )
      ),
      120
    ),
    ''
  );

  insert into public.profiles (
    id,
    email,
    display_name,
    account_status,
    verification_status
  )
  values (
    new.id,
    new.email,
    safe_display_name,
    'pending_review',
    'unverified'
  )
  on conflict (id) do update
  set
    email = coalesce(excluded.email, public.profiles.email),
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    updated_at = now();

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

revoke all on function public.rawaj_bootstrap_auth_user() from public;

drop trigger if exists rawaj_auth_user_bootstrap on auth.users;
create trigger rawaj_auth_user_bootstrap
after insert on auth.users
for each row execute function public.rawaj_bootstrap_auth_user();

insert into public.profiles (
  id,
  email,
  display_name,
  account_status,
  verification_status
)
select
  users.id,
  users.email,
  nullif(
    left(
      btrim(
        coalesce(
          users.raw_user_meta_data ->> 'display_name',
          users.raw_user_meta_data ->> 'full_name',
          users.raw_user_meta_data ->> 'name',
          ''
        )
      ),
      120
    ),
    ''
  ),
  'pending_review',
  'unverified'
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
where profiles.id is null
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select profiles.id, 'user'::public.rawaj_user_role
from public.profiles as profiles
left join public.user_roles as roles
  on roles.user_id = profiles.id
 and roles.role = 'user'
where roles.user_id is null
on conflict (user_id, role) do nothing;

comment on function public.rawaj_bootstrap_auth_user() is
  'Creates the minimum RAWAJ profile and default user role for every new Supabase Auth identity without changing existing administrative roles or verification state.';

commit;
