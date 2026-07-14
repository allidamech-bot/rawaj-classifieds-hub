-- RAWAJ idempotent conversation message delivery.
--
-- A client-generated UUID identifies one logical send attempt. Repeating the
-- same request returns the original message instead of inserting a duplicate.

alter table public.conversation_messages
  add column if not exists client_request_id uuid;

create unique index if not exists conversation_messages_sender_request_uidx
  on public.conversation_messages (sender_user_id, client_request_id)
  where client_request_id is not null;

create or replace function public.rawaj_send_conversation_message_v2(
  p_conversation_id uuid,
  p_client_request_id uuid,
  p_body text
)
returns setof public.conversation_messages
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_message public.conversation_messages%rowtype;
begin
  if v_actor is null then
    raise exception 'Authentication is required to send messages.';
  end if;

  if p_conversation_id is null or p_client_request_id is null then
    raise exception 'Conversation and message request id are required.';
  end if;

  if char_length(v_body) not between 1 and 2000 then
    raise exception 'Message body must contain between 1 and 2000 characters.';
  end if;

  select m.*
    into v_message
  from public.conversation_messages m
  where m.sender_user_id = v_actor
    and m.client_request_id = p_client_request_id
  for update;

  if found then
    if v_message.conversation_id is distinct from p_conversation_id
      or v_message.body is distinct from v_body
    then
      raise exception 'message_request_payload_mismatch';
    end if;

    return next v_message;
    return;
  end if;

  begin
    insert into public.conversation_messages (
      conversation_id,
      sender_user_id,
      body,
      client_request_id
    ) values (
      p_conversation_id,
      v_actor,
      v_body,
      p_client_request_id
    )
    returning * into v_message;
  exception
    when unique_violation then
      select m.*
        into v_message
      from public.conversation_messages m
      where m.sender_user_id = v_actor
        and m.client_request_id = p_client_request_id
      for update;

      if not found then
        raise;
      end if;

      if v_message.conversation_id is distinct from p_conversation_id
        or v_message.body is distinct from v_body
      then
        raise exception 'message_request_payload_mismatch';
      end if;
  end;

  return next v_message;
end;
$$;

revoke all on function public.rawaj_send_conversation_message_v2(uuid, uuid, text) from public;
revoke all on function public.rawaj_send_conversation_message_v2(uuid, uuid, text) from anon;
grant execute on function public.rawaj_send_conversation_message_v2(uuid, uuid, text) to authenticated;

comment on function public.rawaj_send_conversation_message_v2(uuid, uuid, text) is
  'Sends exactly one conversation message for one authenticated client request UUID.';

notify pgrst, 'reload schema';
