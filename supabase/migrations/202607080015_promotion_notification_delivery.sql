-- RAWAJ real in-app promotion notification delivery.
-- Notifies requesters about externally applied or automated promotion status changes.
-- Requester-initiated status actions are not echoed back as redundant notifications.

create or replace function public.rawaj_deliver_promotion_status_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean := true;
  v_title text;
  v_body text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status not in ('approved', 'rejected', 'expired', 'cancelled') then
    return new;
  end if;

  if auth.uid() is not null and auth.uid() = new.requester_user_id then
    return new;
  end if;

  select p.promotions_enabled
    into v_enabled
  from public.notification_preferences p
  where p.user_id = new.requester_user_id;

  if coalesce(v_enabled, true) is not true then
    return new;
  end if;

  v_title := case new.status
    when 'approved' then 'تمت الموافقة على طلب الترويج'
    when 'rejected' then 'تمت مراجعة طلب الترويج'
    when 'expired' then 'انتهت مدة الترويج'
    when 'cancelled' then 'تم إلغاء طلب الترويج'
    else 'تم تحديث طلب الترويج'
  end;

  v_body := case new.status
    when 'approved' then 'تم اعتماد طلب الترويج لإعلانك وأصبحت حالة الترويج محدثة.'
    when 'rejected' then coalesce(
      nullif(btrim(new.admin_note), ''),
      'لم تتم الموافقة على طلب الترويج الحالي.'
    )
    when 'expired' then 'انتهت مدة الترويج المرتبطة بإعلانك.'
    when 'cancelled' then 'تم إلغاء طلب الترويج المرتبط بإعلانك.'
    else 'تغيرت حالة طلب الترويج.'
  end;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    title_ar,
    body_ar,
    target_type,
    target_id,
    metadata
  ) values (
    new.requester_user_id,
    auth.uid(),
    'promotion.status_changed',
    v_title,
    v_body,
    'listing',
    new.listing_id::text,
    jsonb_build_object(
      'promotion_request_id', new.id,
      'listing_id', new.listing_id,
      'previous_status', old.status,
      'status', new.status,
      'promotion_type', new.promotion_type,
      'starts_at', new.starts_at,
      'ends_at', new.ends_at
    )
  );

  return new;
end;
$$;

drop trigger if exists listing_promotion_requests_deliver_status_notification
  on public.listing_promotion_requests;
create trigger listing_promotion_requests_deliver_status_notification
after update of status on public.listing_promotion_requests
for each row execute function public.rawaj_deliver_promotion_status_notification();

comment on function public.rawaj_deliver_promotion_status_notification() is
  'Delivers real preference-aware in-app notifications for external or automated promotion status changes without echoing requester actions.';
