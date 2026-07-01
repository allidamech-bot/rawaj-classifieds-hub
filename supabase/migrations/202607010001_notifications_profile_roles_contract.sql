-- RAWAJ Sprint 2A backend contract:
-- notifications foundation, protected role contract, and audit logs for
-- moderation and role changes.
--
-- Review and run manually in the Supabase SQL Editor. Do not execute from
-- Lovable or from the frontend.

create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  title_ar text not null,
  body_ar text,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_type_not_blank'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_type_not_blank check (length(btrim(type)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_title_ar_not_blank'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_title_ar_not_blank check (length(btrim(title_ar)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_target_type_not_blank_when_present'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_target_type_not_blank_when_present
      check (target_type is null or length(btrim(target_type)) > 0);
  end if;
end $$;

create index if not exists idx_notifications_recipient_created
  on public.notifications (recipient_id, created_at desc);

create index if not exists idx_notifications_recipient_unread_created
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

create index if not exists idx_user_roles_role_assigned
  on public.user_roles (role, assigned_at desc);

create index if not exists idx_audit_logs_target_created
  on public.audit_logs (target_table, target_id, created_at desc);

create index if not exists idx_audit_logs_actor_created
  on public.audit_logs (actor_id, created_at desc);

drop function if exists public.create_user_notification(uuid, text, text, text, text, text, jsonb, uuid);
drop function if exists public.assign_user_role(uuid, text, text);
drop function if exists public.remove_user_role(uuid, text, text);
drop function if exists public.moderate_listing_with_notification(uuid, text, text);
drop function if exists public.moderate_report_with_notification(uuid, text, text);

-- Ensure existing owner/admin profiles remain admin-capable after this migration.
-- The new admin-like helper requires account_status = 'active'.
update public.profiles
set account_status = 'active'
where id in (
  select user_id
  from public.user_roles
  where role in ('owner'::public.rawaj_user_role, 'admin'::public.rawaj_user_role)
)
and account_status != 'active';

create or replace function public.current_user_is_admin_like()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.role in (
        'owner'::public.rawaj_user_role,
        'admin'::public.rawaj_user_role
      )
      and p.account_status = 'active'
  );
$$;

create or replace function public.current_user_can_moderate()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.role in (
        'owner'::public.rawaj_user_role,
        'admin'::public.rawaj_user_role,
        'moderator'::public.rawaj_user_role
      )
      and p.account_status = 'active'
  );
$$;

create or replace function public.current_user_can_manage_roles()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.role = 'owner'::public.rawaj_user_role
      and p.account_status = 'active'
  );
$$;

create or replace function public.rawaj_current_user_primary_role()
returns public.rawaj_user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select ur.role
      from public.user_roles ur
      join public.profiles p on p.id = ur.user_id
      where ur.user_id = auth.uid()
        and p.account_status = 'active'
      order by case ur.role
        when 'owner'::public.rawaj_user_role then 1
        when 'admin'::public.rawaj_user_role then 2
        when 'moderator'::public.rawaj_user_role then 3
        else 4
      end
      limit 1
    ),
    'user'::public.rawaj_user_role
  );
$$;

create or replace function public.rawaj_insert_audit_log(
  action_name text,
  target_table_name text default null,
  target_id_value text default null,
  metadata_value jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_audit_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required for audit logging.';
  end if;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    target_table,
    target_id,
    metadata
  )
  values (
    auth.uid(),
    public.rawaj_current_user_primary_role(),
    action_name,
    target_table_name,
    target_id_value,
    coalesce(metadata_value, '{}'::jsonb)
  )
  returning id into new_audit_id;

  return new_audit_id;
end;
$$;

revoke execute on function public.rawaj_insert_audit_log(text, text, text, jsonb) from public;
revoke execute on function public.rawaj_insert_audit_log(text, text, text, jsonb) from anon;
revoke execute on function public.rawaj_insert_audit_log(text, text, text, jsonb) from authenticated;

create or replace function public.rawaj_audit_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_action text;
  audit_target_id text;
  audit_metadata jsonb;
begin
  if not public.current_user_can_manage_roles() then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    audit_action := 'role.assigned';
    audit_target_id := new.user_id::text;
    audit_metadata := jsonb_build_object('role', new.role::text);
  elsif tg_op = 'UPDATE' then
    audit_action := 'role.updated';
    audit_target_id := new.user_id::text;
    audit_metadata := jsonb_build_object(
      'old_role', old.role::text,
      'new_role', new.role::text
    );
  else
    audit_action := 'role.removed';
    audit_target_id := old.user_id::text;
    audit_metadata := jsonb_build_object('role', old.role::text);
  end if;

  perform public.rawaj_insert_audit_log(
    audit_action,
    'user_roles',
    audit_target_id,
    audit_metadata
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists user_roles_audit_role_change on public.user_roles;
create trigger user_roles_audit_role_change
after insert or update or delete on public.user_roles
for each row execute function public.rawaj_audit_role_change();

create or replace function public.rawaj_audit_listing_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_can_moderate() then
    return new;
  end if;

  if new.status is distinct from old.status
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
    or new.rejection_reason is distinct from old.rejection_reason
    or new.published_at is distinct from old.published_at
    or new.archived_at is distinct from old.archived_at
  then
    perform public.rawaj_insert_audit_log(
      'listing.moderated',
      'listings',
      new.id::text,
      jsonb_build_object(
        'old_status', old.status::text,
        'new_status', new.status::text
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists listings_audit_moderation on public.listings;
create trigger listings_audit_moderation
after update on public.listings
for each row execute function public.rawaj_audit_listing_moderation();

create or replace function public.rawaj_protect_notification_recipient_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.recipient_id then
    if new.id is distinct from old.id
      or new.recipient_id is distinct from old.recipient_id
      or new.actor_id is distinct from old.actor_id
      or new.type is distinct from old.type
      or new.title_ar is distinct from old.title_ar
      or new.body_ar is distinct from old.body_ar
      or new.target_type is distinct from old.target_type
      or new.target_id is distinct from old.target_id
      or new.metadata is distinct from old.metadata
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Notification recipients can only update read_at.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_notification_recipient_update on public.notifications;
create trigger protect_notification_recipient_update
before update on public.notifications
for each row execute function public.rawaj_protect_notification_recipient_update();

alter table public.user_roles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "roles_owner_insert" on public.user_roles;
create policy "roles_owner_insert"
on public.user_roles
for insert
to authenticated
with check (
  public.current_user_can_manage_roles()
  and user_id <> auth.uid()
  and role in (
    'admin'::public.rawaj_user_role,
    'moderator'::public.rawaj_user_role,
    'user'::public.rawaj_user_role
  )
);

drop policy if exists "roles_owner_update" on public.user_roles;
create policy "roles_owner_update"
on public.user_roles
for update
to authenticated
using (
  public.current_user_can_manage_roles()
  and role <> 'owner'::public.rawaj_user_role
)
with check (
  public.current_user_can_manage_roles()
  and user_id <> auth.uid()
  and role in (
    'admin'::public.rawaj_user_role,
    'moderator'::public.rawaj_user_role,
    'user'::public.rawaj_user_role
  )
);

drop policy if exists "roles_owner_delete" on public.user_roles;
create policy "roles_owner_delete"
on public.user_roles
for delete
to authenticated
using (
  public.current_user_can_manage_roles()
  and role <> 'owner'::public.rawaj_user_role
);

drop policy if exists "audit_logs_admin_select" on public.audit_logs;
create policy "audit_logs_admin_select"
on public.audit_logs
for select
to authenticated
using (public.current_user_is_admin_like());

drop policy if exists "audit_logs_admin_insert" on public.audit_logs;
drop policy if exists "audit_logs_privileged_insert" on public.audit_logs;
drop policy if exists "audit_logs_no_direct_client_insert" on public.audit_logs;
create policy "audit_logs_no_direct_client_insert"
on public.audit_logs
for insert
to authenticated
with check (false);

drop policy if exists "Recipients read own notifications" on public.notifications;
create policy "Recipients read own notifications"
on public.notifications
for select
to authenticated
using (recipient_id = auth.uid());

drop policy if exists "Recipients mark own notifications read" on public.notifications;
create policy "Recipients mark own notifications read"
on public.notifications
for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

drop policy if exists "Privileged create notifications" on public.notifications;
drop policy if exists "Notifications no direct client insert" on public.notifications;
create policy "Notifications no direct client insert"
on public.notifications
for insert
to authenticated
with check (false);

create or replace function public.rawaj_create_notification(
  recipient_id uuid,
  notification_type text,
  title_ar text,
  body_ar text default null,
  target_type text default null,
  target_id text default null,
  metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_notification_id uuid;
begin
  if not public.current_user_can_moderate() then
    raise exception 'Only privileged users can create notifications.';
  end if;

  if recipient_id is null
    or not exists (select 1 from public.profiles p where p.id = recipient_id)
  then
    raise exception 'Notification recipient does not exist.';
  end if;

  if length(btrim(coalesce(notification_type, ''))) = 0 then
    raise exception 'Notification type is required.';
  end if;

  if length(btrim(coalesce(title_ar, ''))) = 0 then
    raise exception 'Notification title is required.';
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    title_ar,
    body_ar,
    target_type,
    target_id,
    metadata
  )
  values (
    recipient_id,
    auth.uid(),
    btrim(notification_type),
    btrim(title_ar),
    nullif(btrim(coalesce(body_ar, '')), ''),
    nullif(btrim(coalesce(target_type, '')), ''),
    nullif(btrim(coalesce(target_id, '')), ''),
    coalesce(metadata, '{}'::jsonb)
  )
  returning id into new_notification_id;

  perform public.rawaj_insert_audit_log(
    'notification.created',
    'notifications',
    new_notification_id::text,
    jsonb_build_object(
      'recipient_id', recipient_id,
      'type', btrim(notification_type),
      'target_type', nullif(btrim(coalesce(target_type, '')), ''),
      'target_id', nullif(btrim(coalesce(target_id, '')), '')
    )
  );

  return new_notification_id;
end;
$$;

revoke execute on function public.rawaj_create_notification(uuid, text, text, text, text, text, jsonb) from public;
revoke execute on function public.rawaj_create_notification(uuid, text, text, text, text, text, jsonb) from anon;
grant execute on function public.rawaj_create_notification(uuid, text, text, text, text, text, jsonb) to authenticated;

comment on table public.notifications is
  'User-specific RAWAJ notifications. Recipients can read and mark read; privileged users can create real notifications.';

comment on function public.rawaj_create_notification(uuid, text, text, text, text, text, jsonb) is
  'Creates a real notification for an existing profile. Restricted to active owner/admin/moderator roles.';
