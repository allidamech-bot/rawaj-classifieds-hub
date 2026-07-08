-- RAWAJ message notification read coupling.
-- Reading a conversation advances the participant read cursor and clears matching unread in-app message notifications.

create or replace function public.rawaj_mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_read_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Authentication is required to mark a conversation read.';
  end if;

  update public.conversations
  set
    buyer_last_read_at = case
      when v_user_id = buyer_user_id then greatest(coalesce(buyer_last_read_at, '-infinity'::timestamptz), v_read_at)
      else buyer_last_read_at
    end,
    seller_last_read_at = case
      when v_user_id = seller_user_id then greatest(coalesce(seller_last_read_at, '-infinity'::timestamptz), v_read_at)
      else seller_last_read_at
    end
  where id = p_conversation_id
    and v_user_id in (buyer_user_id, seller_user_id);

  if not found then
    raise exception 'Conversation not found or not accessible.';
  end if;

  update public.notifications
  set read_at = v_read_at
  where recipient_id = v_user_id
    and read_at is null
    and target_type = 'conversation'
    and target_id = p_conversation_id::text
    and (
      type like 'message.%'
      or type like 'conversation.%'
    );
end;
$$;

revoke execute on function public.rawaj_mark_conversation_read(uuid) from public;
revoke execute on function public.rawaj_mark_conversation_read(uuid) from anon;
grant execute on function public.rawaj_mark_conversation_read(uuid) to authenticated;

comment on function public.rawaj_mark_conversation_read(uuid) is
  'Advances the authenticated participant read cursor and marks matching unread in-app message/conversation notifications read.';
