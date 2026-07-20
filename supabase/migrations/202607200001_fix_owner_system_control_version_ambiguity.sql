-- RAWAJ admin runtime repair: qualify owner system-control version updates.
-- Forward-only reconciliation for the ambiguous PL/pgSQL output-column reference.

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
set search_path = public, pg_temp
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

  update public.owner_system_controls as control_row
  set
    enabled = p_enabled,
    reason = v_reason,
    version = control_row.version + 1,
    updated_by = v_actor,
    updated_at = now()
  where control_row.key = p_key
    and control_row.version = p_expected_version
  returning
    control_row.key,
    control_row.enabled,
    control_row.version,
    control_row.updated_at
  into
    v_key,
    v_enabled,
    v_version,
    v_updated_at;

  if v_key is null then
    if exists (
      select 1
      from public.owner_system_controls as existing_control
      where existing_control.key = p_key
    ) then
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

  return query
  select v_key, v_enabled, v_version, v_updated_at;
end;
$$;

revoke all on function public.rawaj_owner_set_system_control(text, boolean, text, bigint)
  from public;
revoke all on function public.rawaj_owner_set_system_control(text, boolean, text, bigint)
  from anon;
grant execute on function public.rawaj_owner_set_system_control(text, boolean, text, bigint)
  to authenticated;
