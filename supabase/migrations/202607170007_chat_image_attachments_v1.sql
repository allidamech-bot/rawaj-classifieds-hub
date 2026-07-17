-- RAWAJ private image attachments for conversation messages.
-- Repository-only migration. Apply manually after merge and review.

alter table public.conversation_messages
  add column if not exists attachment_path text,
  add column if not exists attachment_mime_type text,
  add column if not exists attachment_size_bytes integer;

alter table public.conversation_messages
  alter column body set default '';

alter table public.conversation_messages
  drop constraint if exists conversation_messages_body_length;

alter table public.conversation_messages
  add constraint conversation_messages_content_required
  check (
    (char_length(btrim(body)) between 1 and 2000)
    or attachment_path is not null
  );

alter table public.conversation_messages
  drop constraint if exists conversation_messages_attachment_mime_allowed;

alter table public.conversation_messages
  add constraint conversation_messages_attachment_mime_allowed
  check (
    attachment_path is null
    or attachment_mime_type in ('image/jpeg', 'image/png', 'image/webp')
  );

alter table public.conversation_messages
  drop constraint if exists conversation_messages_attachment_size_allowed;

alter table public.conversation_messages
  add constraint conversation_messages_attachment_size_allowed
  check (
    attachment_path is null
    or attachment_size_bytes between 1 and 5242880
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'conversation-images',
  'conversation-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.rawaj_chat_attachment_conversation_id(p_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_value text := split_part(coalesce(p_name, ''), '/', 1);
begin
  if v_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v_value::uuid;
end;
$$;

revoke all on function public.rawaj_chat_attachment_conversation_id(text) from public;
grant execute on function public.rawaj_chat_attachment_conversation_id(text) to authenticated;

drop policy if exists conversation_images_participant_read on storage.objects;
create policy conversation_images_participant_read
on storage.objects for select
to authenticated
using (
  bucket_id = 'conversation-images'
  and public.rawaj_is_conversation_participant(
    public.rawaj_chat_attachment_conversation_id(name)
  )
);

drop policy if exists conversation_images_sender_insert on storage.objects;
create policy conversation_images_sender_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'conversation-images'
  and split_part(name, '/', 2) = auth.uid()::text
  and public.rawaj_is_conversation_participant(
    public.rawaj_chat_attachment_conversation_id(name)
  )
);

drop policy if exists conversation_images_sender_delete on storage.objects;
create policy conversation_images_sender_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'conversation-images'
  and split_part(name, '/', 2) = auth.uid()::text
  and public.rawaj_is_conversation_participant(
    public.rawaj_chat_attachment_conversation_id(name)
  )
);

create or replace function public.rawaj_send_conversation_message_v3(
  p_conversation_id uuid,
  p_client_request_id uuid,
  p_body text,
  p_attachment_path text default null,
  p_attachment_mime_type text default null,
  p_attachment_size_bytes integer default null
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
  v_path text := nullif(btrim(coalesce(p_attachment_path, '')), '');
  v_mime text := nullif(btrim(coalesce(p_attachment_mime_type, '')), '');
  v_message public.conversation_messages%rowtype;
begin
  if v_actor is null then
    raise exception 'Authentication is required to send messages.';
  end if;
  if p_conversation_id is null or p_client_request_id is null then
    raise exception 'Conversation and message request id are required.';
  end if;
  if char_length(v_body) > 2000 then
    raise exception 'Message body must contain at most 2000 characters.';
  end if;
  if v_path is null and char_length(v_body) < 1 then
    raise exception 'A message body or image attachment is required.';
  end if;
  if v_path is not null then
    if v_mime not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'Unsupported chat attachment type.';
    end if;
    if p_attachment_size_bytes is null or p_attachment_size_bytes not between 1 and 5242880 then
      raise exception 'Chat attachment size is invalid.';
    end if;
    if v_path !~ ('^' || p_conversation_id::text || '/' || v_actor::text || '/' || p_client_request_id::text || '\.(jpg|jpeg|png|webp)$') then
      raise exception 'Chat attachment path is invalid.';
    end if;
  end if;

  select m.* into v_message
  from public.conversation_messages m
  where m.sender_user_id = v_actor
    and m.client_request_id = p_client_request_id
  for update;

  if found then
    if v_message.conversation_id is distinct from p_conversation_id
      or v_message.body is distinct from v_body
      or v_message.attachment_path is distinct from v_path
      or v_message.attachment_mime_type is distinct from v_mime
      or v_message.attachment_size_bytes is distinct from p_attachment_size_bytes
    then
      raise exception 'message_request_payload_mismatch';
    end if;
    return next v_message;
    return;
  end if;

  insert into public.conversation_messages (
    conversation_id,
    sender_user_id,
    body,
    client_request_id,
    attachment_path,
    attachment_mime_type,
    attachment_size_bytes
  ) values (
    p_conversation_id,
    v_actor,
    v_body,
    p_client_request_id,
    v_path,
    v_mime,
    p_attachment_size_bytes
  )
  returning * into v_message;

  return next v_message;
end;
$$;

revoke all on function public.rawaj_send_conversation_message_v3(uuid, uuid, text, text, text, integer) from public;
revoke all on function public.rawaj_send_conversation_message_v3(uuid, uuid, text, text, text, integer) from anon;
grant execute on function public.rawaj_send_conversation_message_v3(uuid, uuid, text, text, text, integer) to authenticated;

comment on function public.rawaj_send_conversation_message_v3(uuid, uuid, text, text, text, integer) is
  'Sends one idempotent text and/or private image message for an authenticated conversation participant.';

notify pgrst, 'reload schema';
