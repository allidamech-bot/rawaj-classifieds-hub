-- RAWAJ Notification Delivery Integrity.
-- Makes the privileged notification RPC respect persisted in-app category preferences.
-- Unknown notification types remain enabled by default so uncategorized system notices are not silently lost.

create or replace function public.rawaj_create_notification(
  recipient_id uuid,
  notification_type text,
  title_ar text,
  body_ar text default null,
  target_type text default null,
  target_id text default null,
  metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_notification_id uuid;
  normalized_type text := btrim(coalesce(notification_type, ''));
  preference_enabled boolean := true;
begin
  if not public.current_user_can_moderate() then
    raise exception 'Only privileged users can create notifications.';
  end if;

  if recipient_id is null
    or not exists (select 1 from public.profiles p where p.id = recipient_id)
  then
    raise exception 'Notification recipient does not exist.';
  end if;

  if length(normalized_type) = 0 then
    raise exception 'Notification type is required.';
  end if;

  if length(btrim(coalesce(title_ar, ''))) = 0 then
    raise exception 'Notification title is required.';
  end if;

  select case
    when normalized_type like 'message.%' or normalized_type like 'conversation.%'
      then p.messages_enabled
    when normalized_type like 'price.%' or normalized_type = 'price_change'
      then p.price_changes_enabled
    when normalized_type like 'saved_search.%' or normalized_type = 'saved_search_match'
      then p.saved_search_matches_enabled
    when normalized_type like 'listing.%'
      then p.listing_status_enabled
    when normalized_type like 'review.%'
      then p.reviews_enabled
    when normalized_type like 'promotion.%' or normalized_type like 'offer.%'
      then p.promotions_enabled
    else true
  end
  into preference_enabled
  from public.notification_preferences p
  where p.user_id = recipient_id;

  if coalesce(preference_enabled, true) is not true then
    return null;
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    title_ar,
    body_ar,
    target_type,
    target_id,
    metadata
  )
  values (
    recipient_id,
    auth.uid(),
    normalized_type,
    btrim(title_ar),
    nullif(btrim(coalesce(body_ar, '')), ''),
    nullif(btrim(coalesce(target_type, '')), ''),
    nullif(btrim(coalesce(target_id, '')), ''),
    coalesce(metadata, '{}'::jsonb)
  )
  returning id into new_notification_id;

  perform public.rawaj_insert_audit_log(
    'notification.created',
    'notifications',
    new_notification_id::text,
    jsonb_build_object(
      'recipient_id', recipient_id,
      'type', normalized_type,
      'target_type', nullif(btrim(coalesce(target_type, '')), ''),
      'target_id', nullif(btrim(coalesce(target_id, '')), '')
    )
  );

  return new_notification_id;
end;
$$;

revoke all on function public.rawaj_create_notification(uuid, text, text, text, text, text, jsonb) from public;
revoke all on function public.rawaj_create_notification(uuid, text, text, text, text, text, jsonb) from anon;
grant execute on function public.rawaj_create_notification(uuid, text, text, text, text, text, jsonb) to authenticated;

comment on function public.rawaj_create_notification(uuid, text, text, text, text, text, jsonb) is
  'Creates a privileged in-app notification only when the recipient category preference allows it; unknown types remain enabled.';
