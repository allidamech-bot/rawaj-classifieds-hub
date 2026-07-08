-- RAWAJ real in-app listing status notification delivery.
-- Notifies owners about externally applied or automated status changes while respecting listing-status preferences.
-- Owner-initiated lifecycle actions are not echoed back as redundant notifications.

create or replace function public.rawaj_deliver_listing_status_notification()
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

  if auth.uid() is not null and auth.uid() = new.owner_id then
    return new;
  end if;

  select p.listing_status_enabled
    into v_enabled
  from public.notification_preferences p
  where p.user_id = new.owner_id;

  if coalesce(v_enabled, true) is not true then
    return new;
  end if;

  v_title := case new.status
    when 'approved' then 'تم اعتماد إعلانك'
    when 'rejected' then 'إعلانك يحتاج مراجعة'
    when 'pending_review' then 'إعلانك قيد المراجعة'
    when 'expired' then 'انتهت مدة إعلانك'
    when 'sold' then 'تم تحديث حالة إعلانك'
    when 'rented' then 'تم تحديث حالة إعلانك'
    when 'unavailable' then 'إعلانك غير متاح حالياً'
    else 'تم تحديث حالة إعلانك'
  end;

  v_body := case new.status
    when 'approved' then 'تم اعتماد إعلان "' || new.title || '" وأصبح متاحاً وفق حالته الحالية.'
    when 'rejected' then coalesce(
      nullif(btrim(new.rejection_reason), ''),
      'إعلان "' || new.title || '" يحتاج تعديلاً قبل إعادة إرساله للمراجعة.'
    )
    when 'pending_review' then 'إعلان "' || new.title || '" أصبح قيد المراجعة.'
    when 'expired' then 'انتهت مدة إعلان "' || new.title || '" ويمكنك مراجعة خيارات إعادة التفعيل.'
    when 'sold' then 'تم تحديث إعلان "' || new.title || '" إلى مباع.'
    when 'rented' then 'تم تحديث إعلان "' || new.title || '" إلى مؤجر.'
    when 'unavailable' then 'إعلان "' || new.title || '" أصبح غير متاح حالياً.'
    else 'تغيرت حالة إعلان "' || new.title || '".'
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
    new.owner_id,
    auth.uid(),
    'listing.status_changed',
    v_title,
    v_body,
    'listing',
    new.id::text,
    jsonb_build_object(
      'listing_id', new.id,
      'previous_status', old.status,
      'status', new.status
    )
  );

  return new;
end;
$$;

drop trigger if exists listings_deliver_status_notification on public.listings;
create trigger listings_deliver_status_notification
after update of status on public.listings
for each row execute function public.rawaj_deliver_listing_status_notification();

comment on function public.rawaj_deliver_listing_status_notification() is
  'Delivers real preference-aware in-app notifications for externally applied or automated listing status changes without echoing owner-initiated actions.';
