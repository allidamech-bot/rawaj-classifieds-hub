-- RAWAJ Owner Authority Truth.
-- Establishes one database-enforced owner identity and owner-only staff provisioning.

create unique index if not exists user_roles_single_owner_idx
  on public.user_roles ((role))
  where role = 'owner';

create or replace function public.rawaj_enforce_owner_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if new.role <> 'owner' then
    return new;
  end if;

  select lower(btrim(coalesce(p.email, '')))
    into v_email
  from public.profiles p
  where p.id = new.user_id;

  if v_email <> 'allidamech@gmail.com' then
    raise exception 'The RAWAJ owner role is reserved for the configured owner identity.';
  end if;

  return new;
end;
$$;

drop trigger if exists user_roles_enforce_owner_identity on public.user_roles;
create trigger user_roles_enforce_owner_identity
before insert or update on public.user_roles
for each row execute function public.rawaj_enforce_owner_identity();

create or replace function public.rawaj_owner_assign_staff_role(
  p_user_id uuid,
  p_role public.rawaj_user_role,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.current_user_has_role('owner') then
    raise exception 'Owner permission required.';
  end if;

  if p_user_id is null or p_user_id = v_actor then
    raise exception 'Invalid staff target.';
  end if;

  if p_role not in ('admin', 'moderator') then
    raise exception 'Only admin or moderator staff roles may be provisioned here.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'Target profile does not exist.';
  end if;

  insert into public.user_roles (user_id, role, assigned_by, note)
  values (p_user_id, p_role, v_actor, nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (user_id, role) do update
    set assigned_by = excluded.assigned_by,
        assigned_at = now(),
        note = excluded.note;

  perform public.rawaj_insert_audit_log(
    'staff.role_assigned',
    'user_roles',
    p_user_id::text,
    jsonb_build_object('role', p_role, 'note', nullif(btrim(coalesce(p_note, '')), ''))
  );
end;
$$;

create or replace function public.rawaj_owner_remove_staff_role(
  p_user_id uuid,
  p_role public.rawaj_user_role,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_deleted integer := 0;
begin
  if v_actor is null or not public.current_user_has_role('owner') then
    raise exception 'Owner permission required.';
  end if;

  if p_role not in ('admin', 'moderator') then
    raise exception 'Only admin or moderator staff roles may be removed here.';
  end if;

  delete from public.user_roles
  where user_id = p_user_id
    and role = p_role;

  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    return;
  end if;

  perform public.rawaj_insert_audit_log(
    'staff.role_removed',
    'user_roles',
    p_user_id::text,
    jsonb_build_object('role', p_role, 'reason', nullif(btrim(coalesce(p_reason, '')), ''))
  );
end;
$$;

revoke all on function public.rawaj_owner_assign_staff_role(uuid, public.rawaj_user_role, text) from public;
revoke all on function public.rawaj_owner_assign_staff_role(uuid, public.rawaj_user_role, text) from anon;
grant execute on function public.rawaj_owner_assign_staff_role(uuid, public.rawaj_user_role, text) to authenticated;

revoke all on function public.rawaj_owner_remove_staff_role(uuid, public.rawaj_user_role, text) from public;
revoke all on function public.rawaj_owner_remove_staff_role(uuid, public.rawaj_user_role, text) from anon;
grant execute on function public.rawaj_owner_remove_staff_role(uuid, public.rawaj_user_role, text) to authenticated;

comment on index public.user_roles_single_owner_idx is
  'Guarantees that RAWAJ has at most one persisted owner role.';

comment on function public.rawaj_owner_assign_staff_role(uuid, public.rawaj_user_role, text) is
  'Owner-only provisioning for admin and moderator roles with audit logging.';

comment on function public.rawaj_owner_remove_staff_role(uuid, public.rawaj_user_role, text) is
  'Owner-only removal of admin and moderator roles with audit logging.';
