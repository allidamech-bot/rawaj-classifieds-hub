-- Phase 12 notification integrity reconciliation.
-- Repository-only migration: this file must be reviewed and applied manually.

begin;

alter table public.notifications
  add column if not exists dedupe_key text;

create or replace function public.rawaj_notification_event_key_v1(
  p_type text,
  p_target_type text,
  p_target_id text,
  p_metadata jsonb
)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select case
    when nullif(btrim(coalesce(p_metadata ->> 'message_id', '')), '') is not null
      then concat_ws(':', lower(btrim(p_type)), 'message', p_metadata ->> 'message_id')
    when nullif(btrim(coalesce(p_metadata ->> 'review_id', '')), '') is not null
      then concat_ws(':', lower(btrim(p_type)), 'review', p_metadata ->> 'review_id')
    when nullif(btrim(coalesce(p_metadata ->> 'request_id', '')), '') is not null
      then concat_ws(':', lower(btrim(p_type)), 'request', p_metadata ->> 'request_id', p_metadata ->> 'status')
    when nullif(btrim(coalesce(p_metadata ->> 'saved_search_id', '')), '') is not null
      then concat_ws(':', lower(btrim(p_type)), 'saved-search', p_metadata ->> 'saved_search_id', nullif(btrim(p_target_id), ''))
    when lower(btrim(coalesce(p_type, ''))) in (
      'approved', 'rejected', 'expired', 'listing.approved', 'listing.rejected',
      'listing.expired', 'listing.status_changed', 'promotion.status_changed'
    ) and nullif(btrim(coalesce(p_target_id, '')), '') is not null
      then concat_ws(':', lower(btrim(p_type)), lower(btrim(coalesce(p_target_type, 'target'))), btrim(p_target_id), p_metadata ->> 'status')
    else null
  end;
$$;

with candidates as (
  select
    id,
    public.rawaj_notification_event_key_v1(type, target_type, target_id, metadata) as event_key,
    row_number() over (
      partition by recipient_id, public.rawaj_notification_event_key_v1(type, target_type, target_id, metadata)
      order by created_at, id
    ) as occurrence
  from public.notifications
), safe_backfill as (
  select id, event_key
  from candidates
  where event_key is not null and occurrence = 1
)
update public.notifications as notification
set dedupe_key = safe_backfill.event_key
from safe_backfill
where notification.id = safe_backfill.id
  and notification.dedupe_key is null;

create unique index if not exists notifications_recipient_dedupe_key_idx
  on public.notifications (recipient_id, dedupe_key)
  where dedupe_key is not null;

create or replace function public.rawaj_dedupe_notification_insert_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.dedupe_key := coalesce(
    nullif(btrim(new.dedupe_key), ''),
    public.rawaj_notification_event_key_v1(new.type, new.target_type, new.target_id, new.metadata)
  );

  if new.dedupe_key is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.recipient_id::text || ':' || new.dedupe_key, 0)
  );
  if exists (
    select 1
    from public.notifications existing
    where existing.recipient_id = new.recipient_id
      and existing.dedupe_key = new.dedupe_key
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists dedupe_notification_insert_v1 on public.notifications;
create trigger dedupe_notification_insert_v1
before insert on public.notifications
for each row execute function public.rawaj_dedupe_notification_insert_v1();

create or replace function public.rawaj_protect_notification_recipient_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
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
      or new.dedupe_key is distinct from old.dedupe_key
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Notification recipients can only update read_at.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.rawaj_mark_all_notifications_read_v1()
returns table(cutoff_at timestamptz, updated_count bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_cutoff timestamptz := clock_timestamp();
  v_count bigint;
begin
  if v_actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  update public.notifications
  set read_at = v_cutoff
  where recipient_id = v_actor
    and read_at is null
    and created_at <= v_cutoff;
  get diagnostics v_count = row_count;
  return query select v_cutoff, v_count;
end;
$$;

revoke all on function public.rawaj_mark_all_notifications_read_v1() from public, anon;
grant execute on function public.rawaj_mark_all_notifications_read_v1() to authenticated;

comment on column public.notifications.dedupe_key is
  'Stable server-derived event key for idempotent notification production.';
comment on function public.rawaj_mark_all_notifications_read_v1() is
  'Marks only the authenticated recipient notifications at or before one server cutoff.';

commit;
