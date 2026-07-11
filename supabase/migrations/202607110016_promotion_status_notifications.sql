-- Notify promotion request owners after a governed approval or rejection.
--
-- Keeps the existing stale-safe moderation authority and audit event, while
-- delivering an in-app notification through the canonical preference-aware
-- notification RPC. Promotion notification preferences remain authoritative.

create or replace function public.rawaj_admin_moderate_promotion_request(
  p_request_id uuid,
  p_status text,
  p_admin_note text,
  p_expected_updated_at timestamptz
)
returns table (
  request_id uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_request_id uuid;
  v_updated_at timestamptz;
  v_requester_user_id uuid;
  v_listing_id uuid;
  v_promotion_type text;
  v_listing_title text;
  v_notification_type text;
  v_notification_title text;
  v_notification_body text;
begin
  if v_actor is null
     or not public.current_user_can_moderate() then
    raise exception 'Promotion moderation permission required.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Unsupported promotion status.';
  end if;

  if p_expected_updated_at is null then
    raise exception 'Expected promotion timestamp is required.';
  end if;

  update public.listing_promotion_requests
  set
    status = p_status,
    admin_note = nullif(btrim(coalesce(p_admin_note, '')), '')
  where listing_promotion_requests.id = p_request_id
    and listing_promotion_requests.status = 'pending_review'
    and listing_promotion_requests.updated_at = p_expected_updated_at
  returning
    listing_promotion_requests.id,
    listing_promotion_requests.updated_at,
    listing_promotion_requests.requester_user_id,
    listing_promotion_requests.listing_id,
    listing_promotion_requests.promotion_type
  into
    v_request_id,
    v_updated_at,
    v_requester_user_id,
    v_listing_id,
    v_promotion_type;

  if v_request_id is null then
    if exists (
      select 1
      from public.listing_promotion_requests r
      where r.id = p_request_id
    ) then
      raise exception 'stale_promotion_request';
    end if;

    raise exception 'Promotion request does not exist.';
  end if;

  select nullif(btrim(l.title), '')
  into v_listing_title
  from public.listings l
  where l.id = v_listing_id;

  if p_status = 'approved' then
    v_notification_type := 'promotion.approved';
    v_notification_title := 'تمت الموافقة على طلب الترويج';
    v_notification_body := case
      when v_listing_title is not null
        then format('تمت الموافقة على ترويج إعلانك «%s».', v_listing_title)
      else 'تمت الموافقة على طلب ترويج إعلانك.'
    end;
  else
    v_notification_type := 'promotion.rejected';
    v_notification_title := 'تم رفض طلب الترويج';
    v_notification_body := case
      when nullif(btrim(coalesce(p_admin_note, '')), '') is not null
        then format('تم رفض طلب ترويج إعلانك. ملاحظة الإدارة: %s', btrim(p_admin_note))
      when v_listing_title is not null
        then format('تم رفض طلب ترويج إعلانك «%s».', v_listing_title)
      else 'تم رفض طلب ترويج إعلانك.'
    end;
  end if;

  perform public.rawaj_create_notification(
    v_requester_user_id,
    v_notification_type,
    v_notification_title,
    v_notification_body,
    'listing_promotion_request',
    v_request_id::text,
    jsonb_build_object(
      'request_id', v_request_id,
      'listing_id', v_listing_id,
      'promotion_type', v_promotion_type,
      'status', p_status
    )
  );

  perform public.rawaj_insert_audit_log(
    'listing_promotion.moderated',
    'listing_promotion_requests',
    v_request_id::text,
    jsonb_build_object(
      'status', p_status,
      'has_admin_note', nullif(btrim(coalesce(p_admin_note, '')), '') is not null,
      'notification_type', v_notification_type
    )
  );

  return query
  select
    v_request_id,
    v_updated_at;
end;
$$;

revoke all on function public.rawaj_admin_moderate_promotion_request(
  uuid,
  text,
  text,
  timestamptz
) from public;

revoke all on function public.rawaj_admin_moderate_promotion_request(
  uuid,
  text,
  text,
  timestamptz
) from anon;

grant execute on function public.rawaj_admin_moderate_promotion_request(
  uuid,
  text,
  text,
  timestamptz
) to authenticated;

comment on function public.rawaj_admin_moderate_promotion_request(uuid, text, text, timestamptz) is
  'Moderates a pending promotion request with stale-write protection, audit logging, and preference-aware owner notification.';
