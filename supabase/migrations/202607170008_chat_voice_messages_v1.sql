-- RAWAJ private voice attachments for conversation messages.
-- Repository-only migration. Apply manually after merge and review.

alter table public.conversation_messages
  add column if not exists attachment_kind text,
  add column if not exists attachment_duration_ms integer;

update public.conversation_messages
set attachment_kind = 'image'
where attachment_path is not null
  and attachment_kind is null;

alter table public.conversation_messages
  drop constraint if exists conversation_messages_attachment_metadata_complete;

alter table public.conversation_messages
  add constraint conversation_messages_attachment_metadata_complete
  check (
    (
      attachment_path is null
      and attachment_mime_type is null
      and attachment_size_bytes is null
      and attachment_kind is null
      and attachment_duration_ms is null
    )
    or (
      attachment_path is not null
      and attachment_kind = 'image'
      and attachment_mime_type in ('image/jpeg', 'image/png', 'image/webp')
      and attachment_size_bytes between 1 and 5242880
      and attachment_duration_ms is null
    )
    or (
      attachment_path is not null
      and attachment_kind = 'audio'
      and attachment_mime_type in ('audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg')
      and attachment_size_bytes between 1 and 10485760
      and attachment_duration_ms between 1000 and 120000
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'conversation-audio',
  'conversation-audio',
  false,
  10485760,
  array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists conversation_audio_participant_read on storage.objects;
create policy conversation_audio_participant_read
on storage.objects for select
to authenticated
using (
  bucket_id = 'conversation-audio'
  and public.rawaj_is_conversation_participant(
    public.rawaj_chat_attachment_conversation_id(name)
  )
);

drop policy if exists conversation_audio_sender_insert on storage.objects;
create policy conversation_audio_sender_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'conversation-audio'
  and split_part(name, '/', 2) = auth.uid()::text
  and public.rawaj_is_conversation_participant(
    public.rawaj_chat_attachment_conversation_id(name)
  )
);

drop policy if exists conversation_audio_sender_delete on storage.objects;
create policy conversation_audio_sender_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'conversation-audio'
  and split_part(name, '/', 2) = auth.uid()::text
  and public.rawaj_is_conversation_participant(
    public.rawaj_chat_attachment_conversation_id(name)
  )
);

create or replace function public.rawaj_send_conversation_message_v4(
  p_conversation_id uuid,
  p_client_request_id uuid,
  p_body text,
  p_attachment_path text default null,
  p_attachment_mime_type text default null,
  p_attachment_size_bytes integer default null,
  p_attachment_kind text default null,
  p_attachment_duration_ms integer default null
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
  v_mime text := lower(nullif(btrim(coalesce(p_attachment_mime_type, '')), ''));
  v_kind text := lower(nullif(btrim(coalesce(p_attachment_kind, '')), ''));
  v_bucket text;
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
    raise exception 'A message body or attachment is required.';
  end if;

  if v_path is null then
    if v_mime is not null
      or p_attachment_size_bytes is not null
      or v_kind is not null
      or p_attachment_duration_ms is not null
    then
      raise exception 'Chat attachment metadata is incomplete.';
    end if;
  elsif v_kind = 'image' then
    v_bucket := 'conversation-images';

    if v_mime not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'Unsupported chat image type.';
    end if;

    if p_attachment_size_bytes is null
      or p_attachment_size_bytes not between 1 and 5242880
      or p_attachment_duration_ms is not null
    then
      raise exception 'Chat image metadata is invalid.';
    end if;

    if v_path !~ ('^' || p_conversation_id::text || '/' || v_actor::text || '/' || p_client_request_id::text || '\.(jpg|jpeg|png|webp)$') then
      raise exception 'Chat image path is invalid.';
    end if;
  elsif v_kind = 'audio' then
    v_bucket := 'conversation-audio';

    if v_mime not in ('audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg') then
      raise exception 'Unsupported chat audio type.';
    end if;

    if p_attachment_size_bytes is null
      or p_attachment_size_bytes not between 1 and 10485760
      or p_attachment_duration_ms is null
      or p_attachment_duration_ms not between 1000 and 120000
    then
      raise exception 'Chat audio metadata is invalid.';
    end if;

    if v_path !~ ('^' || p_conversation_id::text || '/' || v_actor::text || '/' || p_client_request_id::text || '\.(webm|m4a|mp3|ogg)$') then
      raise exception 'Chat audio path is invalid.';
    end if;
  else
    raise exception 'Unsupported chat attachment kind.';
  end if;

  if v_path is not null and not exists (
    select 1
    from storage.objects o
    where o.bucket_id = v_bucket
      and o.name = v_path
      and lower(coalesce(o.metadata ->> 'mimetype', '')) = v_mime
  ) then
    raise exception 'Chat attachment upload could not be verified.';
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
      or v_message.attachment_path is distinct from v_path
      or v_message.attachment_mime_type is distinct from v_mime
      or v_message.attachment_size_bytes is distinct from p_attachment_size_bytes
      or v_message.attachment_kind is distinct from v_kind
      or v_message.attachment_duration_ms is distinct from p_attachment_duration_ms
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
      client_request_id,
      attachment_path,
      attachment_mime_type,
      attachment_size_bytes,
      attachment_kind,
      attachment_duration_ms
    ) values (
      p_conversation_id,
      v_actor,
      v_body,
      p_client_request_id,
      v_path,
      v_mime,
      p_attachment_size_bytes,
      v_kind,
      p_attachment_duration_ms
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
        or v_message.attachment_path is distinct from v_path
        or v_message.attachment_mime_type is distinct from v_mime
        or v_message.attachment_size_bytes is distinct from p_attachment_size_bytes
        or v_message.attachment_kind is distinct from v_kind
        or v_message.attachment_duration_ms is distinct from p_attachment_duration_ms
      then
        raise exception 'message_request_payload_mismatch';
      end if;
  end;

  return next v_message;
end;
$$;

revoke all on function public.rawaj_send_conversation_message_v4(uuid, uuid, text, text, text, integer, text, integer) from public;
revoke all on function public.rawaj_send_conversation_message_v4(uuid, uuid, text, text, text, integer, text, integer) from anon;
grant execute on function public.rawaj_send_conversation_message_v4(uuid, uuid, text, text, text, integer, text, integer) to authenticated;

comment on function public.rawaj_send_conversation_message_v4(uuid, uuid, text, text, text, integer, text, integer) is
  'Sends one idempotent text, private image, or private voice message for an authenticated conversation participant.';

notify pgrst, 'reload schema';
