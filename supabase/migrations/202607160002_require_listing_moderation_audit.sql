-- RAWAJ Phase 0 security hardening — require moderation history and audit records.
--
-- A listing review decision is a privileged state transition. The decision, its immutable
-- moderation action, and its audit record must commit or roll back together. Owner-facing
-- notification delivery remains best-effort so a transient notification failure does not block
-- an otherwise fully audited moderation decision.

create or replace function public.rawaj_review_listing_decision(
  p_listing_id uuid,
  p_decision text,
  p_reason text,
  p_expected_updated_at timestamptz
)
returns table (listing_id uuid, next_status text, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_owner_id uuid;
  v_title text;
  v_current_updated_at timestamptz;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_updated_at timestamptz;
begin
  if v_actor is null or not public.rawaj_current_user_can_review_listings() then
    raise exception 'Listing review permission required.';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Unsupported listing decision.';
  end if;

  if p_decision = 'rejected' and char_length(v_reason) < 3 then
    raise exception 'A clear rejection reason is required.';
  end if;

  select l.owner_id, l.title, l.updated_at
    into v_owner_id, v_title, v_current_updated_at
  from public.listings l
  where l.id = p_listing_id
    and l.status = 'pending_review'
  for update;

  if v_owner_id is null then
    raise exception 'Pending listing does not exist.';
  end if;

  if p_expected_updated_at is null or v_current_updated_at <> p_expected_updated_at then
    raise exception 'stale_review';
  end if;

  update public.listings l
  set
    status = p_decision,
    reviewed_by = v_actor,
    reviewed_at = now(),
    rejection_reason = case when p_decision = 'rejected' then v_reason else null end,
    published_at = case when p_decision = 'approved' then now() else null end,
    archived_at = null,
    updated_at = now()
  where l.id = p_listing_id
  returning l.updated_at into v_updated_at;

  -- Required: failure rolls back the listing state transition.
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
    case when p_decision = 'approved' then 'approve' else 'reject' end,
    'pending_review',
    p_decision,
    case
      when p_decision = 'approved' then coalesce(nullif(v_reason, ''), 'Approved after review')
      else v_reason
    end,
    p_expected_updated_at,
    jsonb_build_object('source', 'pending_queue')
  );

  -- Required: failure rolls back both the state transition and moderation action.
  perform public.rawaj_insert_audit_log(
    case
      when p_decision = 'approved' then 'listing.moderation.approve'
      else 'listing.moderation.reject'
    end,
    'listings',
    p_listing_id::text,
    jsonb_build_object(
      'previous_status', 'pending_review',
      'next_status', p_decision,
      'reason', v_reason
    )
  );

  -- Best-effort only: notification delivery must not erase an already audited decision.
  begin
    perform public.rawaj_create_notification(
      v_owner_id,
      case when p_decision = 'approved' then 'listing.approved' else 'listing.rejected' end,
      case when p_decision = 'approved' then 'تمت الموافقة على إعلانك' else 'تم رفض إعلانك' end,
      case
        when p_decision = 'approved' then
          'تمت الموافقة على إعلان "' || v_title || '" وأصبح ظاهراً للعامة.'
        else
          'تم رفض إعلان "' || v_title || '". السبب: ' || v_reason
      end,
      'listing',
      p_listing_id::text,
      jsonb_build_object('listing_id', p_listing_id, 'status', p_decision)
    );
  exception
    when others then
      null;
  end;

  return query select p_listing_id, p_decision, v_updated_at;
end;
$$;

revoke all on function public.rawaj_review_listing_decision(uuid, text, text, timestamptz) from public;
revoke all on function public.rawaj_review_listing_decision(uuid, text, text, timestamptz) from anon;
grant execute on function public.rawaj_review_listing_decision(uuid, text, text, timestamptz) to authenticated;

comment on function public.rawaj_review_listing_decision(uuid, text, text, timestamptz) is
  'Stale-safe listing review decision whose status transition, moderation action, and audit record commit atomically; owner notification is best-effort.';
