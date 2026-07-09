-- RAWAJ P0 production contract reconciliation: admin listing moderation.
--
-- Production catalog evidence captured on 2026-07-09 showed that the canonical
-- rawaj_admin_moderate_listing RPC was absent while the frontend and main branch
-- depend on it. Re-assert the existing canonical contract idempotently without
-- changing customer listing flows, role taxonomy, or Syria location taxonomy.

create table if not exists public.listing_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  previous_status public.rawaj_listing_status not null,
  next_status public.rawaj_listing_status not null,
  reason text not null,
  expected_updated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (action in (
    'approve',
    'reject',
    'request_changes',
    'suspend',
    'unpublish',
    'archive',
    'expire_now',
    'extend_expiry'
  )),
  check (char_length(btrim(reason)) between 3 and 1200)
);

create index if not exists listing_moderation_actions_listing_idx
  on public.listing_moderation_actions (listing_id, created_at desc);

create index if not exists listing_moderation_actions_actor_idx
  on public.listing_moderation_actions (actor_id, created_at desc);

alter table public.listing_moderation_actions enable row level security;

drop policy if exists "listing_moderation_actions_admin_read" on public.listing_moderation_actions;
create policy "listing_moderation_actions_admin_read"
on public.listing_moderation_actions
for select
to authenticated
using (public.current_user_is_admin_like());

create or replace function public.rawaj_admin_moderate_listing(
  p_listing_id uuid,
  p_action text,
  p_reason text,
  p_expected_updated_at timestamptz,
  p_extend_days integer default null
)
returns table (
  listing_id uuid,
  previous_status public.rawaj_listing_status,
  next_status public.rawaj_listing_status,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_previous public.rawaj_listing_status;
  v_next public.rawaj_listing_status;
  v_now timestamptz := now();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_owner_id uuid;
  v_title text;
  v_updated_at timestamptz;
begin
  if v_actor is null or not public.current_user_is_admin_like() then
    raise exception 'Admin permission required.';
  end if;

  if p_listing_id is null or char_length(v_reason) < 3 then
    raise exception 'Listing and clear reason are required.';
  end if;

  if p_action not in (
    'approve', 'reject', 'request_changes', 'suspend',
    'unpublish', 'archive', 'expire_now', 'extend_expiry'
  ) then
    raise exception 'Unsupported moderation action.';
  end if;

  select l.status, l.owner_id, l.title, l.updated_at
    into v_previous, v_owner_id, v_title, v_updated_at
  from public.listings l
  where l.id = p_listing_id
  for update;

  if v_previous is null then
    raise exception 'Listing does not exist.';
  end if;

  if p_expected_updated_at is null or v_updated_at <> p_expected_updated_at then
    raise exception 'stale_review';
  end if;

  v_next := case p_action
    when 'approve' then 'approved'::public.rawaj_listing_status
    when 'reject' then 'rejected'::public.rawaj_listing_status
    when 'request_changes' then 'rejected'::public.rawaj_listing_status
    when 'suspend' then 'archived'::public.rawaj_listing_status
    when 'unpublish' then 'archived'::public.rawaj_listing_status
    when 'archive' then 'archived'::public.rawaj_listing_status
    when 'expire_now' then 'expired'::public.rawaj_listing_status
    when 'extend_expiry' then v_previous
  end;

  if p_action in ('approve', 'reject', 'request_changes') and v_previous <> 'pending_review' then
    raise exception 'Only pending listings may receive review decisions.';
  end if;

  if p_action in ('suspend', 'unpublish') and v_previous <> 'approved' then
    raise exception 'Only approved listings may be suspended or unpublished.';
  end if;

  if p_action = 'extend_expiry' then
    if p_extend_days is null or p_extend_days < 1 or p_extend_days > 365 then
      raise exception 'Extension days must be between 1 and 365.';
    end if;
    if v_previous not in ('approved', 'expired') then
      raise exception 'Only approved or expired listings may be extended.';
    end if;
  end if;

  update public.listings
  set
    status = v_next,
    reviewed_by = v_actor,
    reviewed_at = v_now,
    rejection_reason = case
      when p_action in ('reject', 'request_changes') then v_reason
      else null
    end,
    published_at = case
      when p_action = 'approve' then coalesce(published_at, v_now)
      else published_at
    end,
    archived_at = case
      when p_action in ('suspend', 'unpublish', 'archive') then v_now
      when p_action = 'approve' then null
      else archived_at
    end,
    expires_at = case
      when p_action = 'expire_now' then v_now
      when p_action = 'extend_expiry' then greatest(coalesce(expires_at, v_now), v_now)
        + make_interval(days => p_extend_days)
      else expires_at
    end,
    updated_at = v_now
  where id = p_listing_id
  returning listings.updated_at into v_updated_at;

  insert into public.listing_moderation_actions (
    listing_id,
    actor_id,
    action,
    previous_status,
    next_status,
    reason,
    expected_updated_at,
    metadata
  ) values (
    p_listing_id,
    v_actor,
    p_action,
    v_previous,
    v_next,
    v_reason,
    p_expected_updated_at,
    jsonb_build_object('extend_days', p_extend_days)
  );

  perform public.rawaj_insert_audit_log(
    'listing.moderation.' || p_action,
    'listings',
    p_listing_id::text,
    jsonb_build_object(
      'previous_status', v_previous,
      'next_status', v_next,
      'reason', v_reason,
      'extend_days', p_extend_days
    )
  );

  if p_action in ('approve', 'reject', 'request_changes') then
    perform public.rawaj_create_notification(
      v_owner_id,
      case p_action
        when 'approve' then 'listing.approved'
        when 'request_changes' then 'listing.changes_requested'
        else 'listing.rejected'
      end,
      case p_action
        when 'approve' then 'تمت الموافقة على إعلانك'
        when 'request_changes' then 'إعلانك يحتاج تعديلات'
        else 'تم رفض إعلانك'
      end,
      case p_action
        when 'approve' then 'تمت الموافقة على إعلان "' || v_title || '" وأصبح جاهزاً للظهور.'
        when 'request_changes' then 'إعلان "' || v_title || '" يحتاج تعديلات. السبب: ' || v_reason
        else 'تم رفض إعلان "' || v_title || '". السبب: ' || v_reason
      end,
      'listing',
      p_listing_id::text,
      jsonb_build_object('listing_id', p_listing_id, 'action', p_action, 'status', v_next)
    );
  end if;

  return query
  select p_listing_id, v_previous, v_next, v_updated_at;
end;
$$;

revoke all on function public.rawaj_admin_moderate_listing(uuid, text, text, timestamptz, integer) from public;
revoke all on function public.rawaj_admin_moderate_listing(uuid, text, text, timestamptz, integer) from anon;
grant execute on function public.rawaj_admin_moderate_listing(uuid, text, text, timestamptz, integer) to authenticated;

comment on table public.listing_moderation_actions is
  'Immutable operational history of protected listing moderation actions.';

comment on function public.rawaj_admin_moderate_listing(uuid, text, text, timestamptz, integer) is
  'Performs validated, stale-safe, audited listing moderation transitions for authorized staff.';
