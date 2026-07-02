-- RAWAJ message report RPC hardening.
--
-- Manual-only migration: review and run from Supabase Dashboard SQL Editor.
-- Do not execute from Lovable or from the frontend.
--
-- Goal:
-- Create a server-side entry point for message reports so the reported user is
-- derived from the message/conversation instead of being trusted from UI state.

create or replace function public.rawaj_create_message_report(
  p_message_id uuid,
  p_conversation_id uuid,
  p_reason text,
  p_details text default null
)
returns public.message_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_sender uuid;
  v_conversation_buyer uuid;
  v_conversation_seller uuid;
  v_reason text;
  v_details text;
  v_report public.message_reports%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to report a message.';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 3 or char_length(v_reason) > 80 then
    raise exception 'Report reason must be between 3 and 80 characters.';
  end if;

  v_details := nullif(btrim(coalesce(p_details, '')), '');
  if v_details is not null and char_length(v_details) > 1000 then
    raise exception 'Report details must be 1000 characters or fewer.';
  end if;

  select m.sender_user_id, c.buyer_user_id, c.seller_user_id
    into v_message_sender, v_conversation_buyer, v_conversation_seller
  from public.conversation_messages m
  join public.conversations c on c.id = m.conversation_id
  where m.id = p_message_id
    and m.conversation_id = p_conversation_id
    and m.deleted_at is null;

  if v_message_sender is null then
    raise exception 'Message was not found in the selected conversation.';
  end if;

  if auth.uid() is distinct from v_conversation_buyer
     and auth.uid() is distinct from v_conversation_seller then
    raise exception 'Only conversation participants can report messages.';
  end if;

  if v_message_sender = auth.uid() then
    raise exception 'Users cannot report their own message.';
  end if;

  if exists (
    select 1
    from public.message_reports
    where message_id = p_message_id
      and reporter_user_id = auth.uid()
      and status in ('new', 'under_review')
  ) then
    raise exception 'This message has already been reported by this account.';
  end if;

  insert into public.message_reports (
    message_id,
    conversation_id,
    reporter_user_id,
    reported_user_id,
    reason,
    details,
    status
  )
  values (
    p_message_id,
    p_conversation_id,
    auth.uid(),
    v_message_sender,
    v_reason,
    v_details,
    'new'
  )
  returning * into v_report;

  return v_report;
exception
  when unique_violation then
    raise exception 'This message has already been reported by this account.';
end;
$$;

revoke execute on function public.rawaj_create_message_report(uuid, uuid, text, text) from public;
revoke execute on function public.rawaj_create_message_report(uuid, uuid, text, text) from anon;
grant execute on function public.rawaj_create_message_report(uuid, uuid, text, text) to authenticated;

comment on function public.rawaj_create_message_report(uuid, uuid, text, text) is
  'Creates a message report after verifying conversation membership and deriving reported_user_id from the reported message sender.';
