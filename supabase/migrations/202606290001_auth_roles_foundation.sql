-- RAWAJ auth/roles foundation.
-- Run in Supabase after Auth is enabled. This does not create real listing CRUD.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'rawaj_user_role') then
    create type public.rawaj_user_role as enum ('owner', 'admin', 'moderator', 'seller', 'user');
  end if;

  if not exists (select 1 from pg_type where typname = 'rawaj_account_status') then
    create type public.rawaj_account_status as enum ('active', 'frozen', 'disabled', 'pending_review');
  end if;

  if not exists (select 1 from pg_type where typname = 'rawaj_verification_status') then
    create type public.rawaj_verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  governorate text,
  account_status public.rawaj_account_status not null default 'pending_review',
  verification_status public.rawaj_verification_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.rawaj_user_role not null default 'user',
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  note text,
  primary key (user_id, role)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role public.rawaj_user_role,
  action text not null,
  target_table text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create or replace function public.current_user_has_role(required_role public.rawaj_user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = required_role
  );
$$;

create or replace function public.current_user_is_admin_like()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.prevent_owner_demote_or_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'owner' then
    raise exception 'Owner role cannot be removed or demoted by this operation.';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_owner_role_delete on public.user_roles;
create trigger protect_owner_role_delete
before delete on public.user_roles
for each row execute function public.prevent_owner_demote_or_delete();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
using (id = auth.uid() or public.current_user_is_admin_like());

drop policy if exists "profiles_update_own_limited" on public.profiles;
create policy "profiles_update_own_limited"
on public.profiles
for update
using (id = auth.uid())
with check (
  id = auth.uid()
  and account_status = (select account_status from public.profiles where id = auth.uid())
  and verification_status = (select verification_status from public.profiles where id = auth.uid())
);

drop policy if exists "profiles_owner_admin_update" on public.profiles;
create policy "profiles_owner_admin_update"
on public.profiles
for update
using (public.current_user_is_admin_like())
with check (
  public.current_user_has_role('owner')
  or not exists (
    select 1
    from public.user_roles
    where user_id = profiles.id
      and role = 'owner'
  )
);

drop policy if exists "roles_select_own_or_admin" on public.user_roles;
create policy "roles_select_own_or_admin"
on public.user_roles
for select
using (user_id = auth.uid() or public.current_user_is_admin_like());

drop policy if exists "roles_owner_insert" on public.user_roles;
create policy "roles_owner_insert"
on public.user_roles
for insert
with check (
  public.current_user_has_role('owner')
  and user_id <> auth.uid()
);

drop policy if exists "roles_owner_update" on public.user_roles;
create policy "roles_owner_update"
on public.user_roles
for update
using (public.current_user_has_role('owner'))
with check (public.current_user_has_role('owner'));

drop policy if exists "roles_owner_delete" on public.user_roles;
create policy "roles_owner_delete"
on public.user_roles
for delete
using (
  public.current_user_has_role('owner')
  and role <> 'owner'
);

drop policy if exists "audit_logs_admin_select" on public.audit_logs;
create policy "audit_logs_admin_select"
on public.audit_logs
for select
using (public.current_user_is_admin_like());

drop policy if exists "audit_logs_admin_insert" on public.audit_logs;
create policy "audit_logs_admin_insert"
on public.audit_logs
for insert
with check (public.current_user_is_admin_like());
