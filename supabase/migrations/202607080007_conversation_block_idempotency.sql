-- RAWAJ conversation block idempotency.
-- Repeated or concurrent identical block actions resolve successfully instead of surfacing unique violations.

create or replace function public.rawaj_protect_user_block_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_buyer uuid;
  conversation_seller uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to block a user.';
  end if;

  if new.blocker_user_id is distinct from auth.uid() then
    raise exception 'Blocker cannot be spoofed.';
  end if;

  select buyer_user_id, seller_user_id into conversation_buyer, conversation_seller
  from public.conversations
  where id = new.conversation_id;

  if conversation_buyer is null then
    raise exception 'Conversation was not found.';
  end if;

  if auth.uid() not in (conversation_buyer, conversation_seller) then
    raise exception 'Only conversation participants can block users here.';
  end if;

  if new.blocked_user_id not in (conversation_buyer, conversation_seller) then
    raise exception 'Blocked user must be the other conversation participant.';
  end if;

  if new.blocked_user_id = auth.uid() then
    raise exception 'Users cannot block themselves.';
  end if;

  -- Serialize identical block actions so simultaneous retries cannot race the unique index.
  perform pg_advisory_xact_lock(
    hashtextextended(
      new.conversation_id::text || ':' || new.blocker_user_id::text || ':' || new.blocked_user_id::text,
      0
    )
  );

  update public.conversations
  set status = 'blocked',
      updated_at = now()
  where id = new.conversation_id
    and status is distinct from 'blocked';

  if exists (
    select 1
    from public.user_blocks b
    where b.conversation_id = new.conversation_id
      and b.blocker_user_id = new.blocker_user_id
      and b.blocked_user_id = new.blocked_user_id
  ) then
    return null;
  end if;

  return new;
end;
$$;

comment on function public.rawaj_protect_user_block_insert() is
  'Validates conversation-scoped blocks and makes identical repeated or concurrent block actions idempotent.';
