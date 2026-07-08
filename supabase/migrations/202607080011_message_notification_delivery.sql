-- RAWAJ real in-app message notification delivery.
-- Creates one preference-aware in-app notification per successfully inserted conversation message.
-- No push, email, or background-delivery claim is made here.

create or replace function public.rawaj_deliver_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_user_id uuid;
  v_seller_user_id uuid;
  v_recipient_id uuid;
  v_messages_enabled boolean := true;
  v_sender_name text;
  v_preview text;
begin
  select c.buyer_user_id, c.seller_user_id
    into v_buyer_user_id, v_seller_user_id
  from public.conversations c
  where c.id = new.conversation_id;

  if v_buyer_user_id is null or v_seller_user_id is null then
    return new;
  end if;

  v_recipient_id := case
    when new.sender_user_id = v_buyer_user_id then v_seller_user_id
    when new.sender_user_id = v_seller_user_id then v_buyer_user_id
    else null
  end;

  if v_recipient_id is null or v_recipient_id = new.sender_user_id then
    return new;
  end if;

  select p.messages_enabled
    into v_messages_enabled
  from public.notification_preferences p
  where p.user_id = v_recipient_id;

  if coalesce(v_messages_enabled, true) is not true then
    return new;
  end if;

  select coalesce(
    nullif(btrim(p.display_name), ''),
    nullif(btrim(p.first_name), ''),
    'مستخدم رواج'
  )
    into v_sender_name
  from public.profiles p
  where p.id = new.sender_user_id;

  v_preview := left(btrim(new.body), 160);

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
    v_recipient_id,
    new.sender_user_id,
    'message.received',
    'رسالة جديدة من ' || coalesce(v_sender_name, 'مستخدم رواج'),
    nullif(v_preview, ''),
    'conversation',
    new.conversation_id::text,
    jsonb_build_object(
      'conversation_id', new.conversation_id,
      'message_id', new.id,
      'sender_user_id', new.sender_user_id
    )
  );

  return new;
end;
$$;

drop trigger if exists conversation_messages_deliver_notification
  on public.conversation_messages;
create trigger conversation_messages_deliver_notification
after insert on public.conversation_messages
for each row execute function public.rawaj_deliver_message_notification();

comment on function public.rawaj_deliver_message_notification() is
  'Delivers a real in-app notification to the other conversation participant after a successful message insert when message notifications are enabled.';
