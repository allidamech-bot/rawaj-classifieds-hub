-- RAWAJ owner-only system controls.
-- Sensitive operational switches are explicit, versioned, audited, and owner-authorized.

create table if not exists public.owner_system_controls (
  key text primary key,
  enabled boolean not null default false,
  reason text not null default '',
  version bigint not null default 1,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check (key in (
    'freeze_new_listings',
    'freeze_new_messages',
    'freeze_promotions',
    'freeze_verifications',
    'maintenance_mode',
    'emergency_read_only'
  )),
  check (char_length(reason) <= 1000)
);

alter table public.owner_system_controls enable row level security;

insert into public.owner_system_controls (key, enabled, reason, updated_by)
select seed.key, false, '', owner_row.user_id
from (
  values
    ('freeze_new_listings'),
    ('freeze_new_messages'),
    ('freeze_promotions'),
    ('freeze_verifications'),
    ('maintenance_mode'),
    ('emergency_read_only')
) as seed(key)
cross join lateral (
  select ur.user_id
  from public.user_roles ur
  where ur.role = 'owner'
  order by ur.user_id
  limit 1
) owner_row
on conflict (key) do nothing;

create or replace function public.rawaj_owner_list_system_controls()
returns table (
  key text,
  enabled boolean,
  reason text,
  version bigint,
  updated_by uuid,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.key, c.enabled, c.reason, c.version, c.updated_by, c.updated_at
  from public.owner_system_controls c
  where public.current_user_has_role('owner')
  order by c.key;
$$;

create or replace function public.rawaj_owner_set_system_control(
  p_key text,
  p_enabled boolean,
  p_reason text,
  p_expected_version bigint
)
returns table (
  key text,
  enabled boolean,
  version bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_key text;
  v_enabled boolean;
  v_version bigint;
  v_updated_at timestamptz;
begin
  if v_actor is null or not public.current_user_has_role('owner') then
    raise exception 'Owner permission required.';
  end if;

  if p_key not in (
    'freeze_new_listings',
    'freeze_new_messages',
    'freeze_promotions',
    'freeze_verifications',
    'maintenance_mode',
    'emergency_read_only'
  ) then
    raise exception 'Unsupported system control.';
  end if;

  if char_length(v_reason) < 3 then
    raise exception 'A clear reason is required.';
  end if;

  update public.owner_system_controls
  set
    enabled = p_enabled,
    reason = v_reason,
    version = version + 1,
    updated_by = v_actor,
    updated_at = now()
  where owner_system_controls.key = p_key
    and owner_system_controls.version = p_expected_version
  returning owner_system_controls.key, owner_system_controls.enabled,
    owner_system_controls.version, owner_system_controls.updated_at
  into v_key, v_enabled, v_version, v_updated_at;

  if v_key is null then
    if exists (select 1 from public.owner_system_controls c where c.key = p_key) then
      raise exception 'stale_system_control';
    end if;
    raise exception 'System control does not exist.';
  end if;

  perform public.rawaj_insert_audit_log(
    'owner_system_control.changed',
    'owner_system_controls',
    v_key,
    jsonb_build_object(
      'enabled', v_enabled,
      'reason', v_reason,
      'version', v_version
    )
  );

  return query select v_key, v_enabled, v_version, v_updated_at;
end;
$$;

create or replace function public.rawaj_system_control_enabled(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select c.enabled
    from public.owner_system_controls c
    where c.key = p_key
  ), false);
$$;

revoke all on function public.rawaj_owner_list_system_controls() from public;
revoke all on function public.rawaj_owner_list_system_controls() from anon;
grant execute on function public.rawaj_owner_list_system_controls() to authenticated;

revoke all on function public.rawaj_owner_set_system_control(text, boolean, text, bigint) from public;
revoke all on function public.rawaj_owner_set_system_control(text, boolean, text, bigint) from anon;
grant execute on function public.rawaj_owner_set_system_control(text, boolean, text, bigint) to authenticated;

revoke all on function public.rawaj_system_control_enabled(text) from public;
grant execute on function public.rawaj_system_control_enabled(text) to anon, authenticated;

comment on table public.owner_system_controls is
  'Owner-only audited operational switches for emergency freezes and maintenance controls.';
