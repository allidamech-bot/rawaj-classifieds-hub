-- RAWAJ push device and delivery lifecycle hardening.
--
-- Prevents disabled or permanently invalid devices from leaving retryable
-- deliveries stranded forever. This migration is forward-only and preserves
-- the existing public RPC signatures used by the application and worker.

begin;

-- Reconcile any queue rows already stranded behind inactive devices.
update public.notification_push_deliveries delivery
set status = 'failed',
    next_attempt_at = now(),
    locked_at = null,
    last_error = coalesce(nullif(delivery.last_error, ''), 'push_device_inactive'),
    updated_at = now()
from public.push_devices device
where device.id = delivery.device_id
  and not device.active
  and delivery.status in ('pending', 'retry', 'processing');

create or replace function public.rawaj_disable_push_device_v1(
  p_device_key text,
  p_disable_channel boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_device_id uuid;
  v_updated integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  update public.push_devices
  set active = false,
      permission_status = case when permission_status = 'denied' then 'denied' else 'prompt' end,
      updated_at = now()
  where user_id = v_user_id
    and device_key = btrim(coalesce(p_device_key, ''))
  returning id into v_device_id;
  get diagnostics v_updated = row_count;

  if v_device_id is not null then
    update public.notification_push_deliveries
    set status = 'failed',
        next_attempt_at = now(),
        locked_at = null,
        last_error = 'push_device_disabled',
        updated_at = now()
    where device_id = v_device_id
      and status in ('pending', 'retry', 'processing');
  end if;

  if coalesce(p_disable_channel, true) then
    insert into public.notification_preferences (user_id, push_enabled)
    values (v_user_id, false)
    on conflict (user_id)
    do update set push_enabled = false, updated_at = now();

    update public.notification_push_deliveries
    set status = 'failed',
        next_attempt_at = now(),
        locked_at = null,
        last_error = 'push_channel_disabled',
        updated_at = now()
    where recipient_id = v_user_id
      and status in ('pending', 'retry', 'processing');
  end if;

  return v_updated > 0;
end;
$$;

create or replace function public.rawaj_mark_push_delivery_v1(
  p_delivery_id uuid,
  p_success boolean,
  p_error text default null,
  p_disable_device boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_delivery public.notification_push_deliveries;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;

  select * into v_delivery
  from public.notification_push_deliveries
  where id = p_delivery_id
  for update;

  if v_delivery.id is null then return false; end if;

  if coalesce(p_success, false) then
    update public.notification_push_deliveries
    set status = 'sent',
        sent_at = now(),
        locked_at = null,
        last_error = null,
        updated_at = now()
    where id = p_delivery_id;
  else
    update public.notification_push_deliveries
    set status = case
          when coalesce(p_disable_device, false) then 'failed'
          when attempt_count >= 5 then 'failed'
          else 'retry'
        end,
        next_attempt_at = case
          when coalesce(p_disable_device, false) then now()
          else now() + case
            when attempt_count <= 1 then interval '1 minute'
            when attempt_count = 2 then interval '5 minutes'
            when attempt_count = 3 then interval '15 minutes'
            else interval '1 hour'
          end
        end,
        locked_at = null,
        last_error = left(coalesce(p_error, 'Unknown push delivery error'), 1000),
        updated_at = now()
    where id = p_delivery_id;
  end if;

  if coalesce(p_disable_device, false) then
    update public.push_devices
    set active = false,
        updated_at = now()
    where id = v_delivery.device_id;

    update public.notification_push_deliveries
    set status = 'failed',
        next_attempt_at = now(),
        locked_at = null,
        last_error = 'push_device_invalidated',
        updated_at = now()
    where device_id = v_delivery.device_id
      and id <> p_delivery_id
      and status in ('pending', 'retry', 'processing');
  end if;

  return true;
end;
$$;

revoke all on function public.rawaj_disable_push_device_v1(text, boolean) from public, anon;
revoke all on function public.rawaj_mark_push_delivery_v1(uuid, boolean, text, boolean) from public, anon, authenticated;

grant execute on function public.rawaj_disable_push_device_v1(text, boolean) to authenticated;
grant execute on function public.rawaj_mark_push_delivery_v1(uuid, boolean, text, boolean) to service_role;

comment on function public.rawaj_disable_push_device_v1(text, boolean) is
  'Disables the authenticated user device, closes its queued deliveries, and optionally disables the global push channel.';
comment on function public.rawaj_mark_push_delivery_v1(uuid, boolean, text, boolean) is
  'Marks a claimed push delivery and closes all remaining queue rows when the target device is permanently invalid.';

commit;
