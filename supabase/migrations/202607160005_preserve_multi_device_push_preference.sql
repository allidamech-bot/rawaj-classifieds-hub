-- RAWAJ multi-device push preference reconciliation.
--
-- Keeps the account-level push opt-in independent from any one device's
-- permission or registration state. Registering a granted device enables the
-- account channel; a denied or prompt device never disables other devices.

begin;

create or replace function public.rawaj_upsert_push_device_v1(
  p_device_key text,
  p_device_token text,
  p_platform text default 'android',
  p_permission_status text default 'granted',
  p_app_version text default null,
  p_locale text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_device_id uuid;
  v_device_key text := btrim(coalesce(p_device_key, ''));
  v_token text := btrim(coalesce(p_device_token, ''));
  v_platform text := lower(btrim(coalesce(p_platform, 'android')));
  v_permission text := lower(btrim(coalesce(p_permission_status, 'granted')));
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if length(v_device_key) < 8 or length(v_token) < 20 then
    raise exception 'Invalid push device registration.' using errcode = '22023';
  end if;
  if v_platform not in ('android', 'ios', 'web') then v_platform := 'android'; end if;
  if v_permission not in ('granted', 'denied', 'prompt') then v_permission := 'prompt'; end if;

  delete from public.push_devices
  where device_token = v_token
    and (user_id <> v_user_id or device_key <> v_device_key);

  insert into public.push_devices (
    user_id,
    device_key,
    device_token,
    platform,
    permission_status,
    app_version,
    locale,
    active,
    last_seen_at,
    updated_at
  ) values (
    v_user_id,
    v_device_key,
    v_token,
    v_platform,
    v_permission,
    nullif(btrim(coalesce(p_app_version, '')), ''),
    nullif(btrim(coalesce(p_locale, '')), ''),
    v_permission = 'granted',
    now(),
    now()
  )
  on conflict (user_id, device_key)
  do update set
    device_token = excluded.device_token,
    platform = excluded.platform,
    permission_status = excluded.permission_status,
    app_version = excluded.app_version,
    locale = excluded.locale,
    active = excluded.active,
    last_seen_at = now(),
    updated_at = now()
  returning id into v_device_id;

  if v_permission = 'granted' then
    insert into public.notification_preferences (user_id, push_enabled)
    values (v_user_id, true)
    on conflict (user_id)
    do update set push_enabled = true, updated_at = now();
  end if;

  return v_device_id;
end;
$$;

revoke all on function public.rawaj_upsert_push_device_v1(text, text, text, text, text, text)
  from public, anon;
grant execute on function public.rawaj_upsert_push_device_v1(text, text, text, text, text, text)
  to authenticated;

comment on function public.rawaj_upsert_push_device_v1(text, text, text, text, text, text) is
  'Registers one authenticated user device; granted registration enables the account channel without allowing another device state to disable it.';

commit;
