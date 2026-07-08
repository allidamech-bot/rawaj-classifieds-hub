-- RAWAJ conversation list freshness query indexes.
-- Keep the current full conversation history while improving latest-first ordering and unread counts.

create index if not exists idx_conversation_messages_visible_created
  on public.conversation_messages (conversation_id, created_at)
  where deleted_at is null;

create index if not exists idx_conversations_buyer_activity
  on public.conversations (
    buyer_user_id,
    (coalesce(last_message_at, updated_at, created_at)) desc
  );

create index if not exists idx_conversations_seller_activity
  on public.conversations (
    seller_user_id,
    (coalesce(last_message_at, updated_at, created_at)) desc
  );

comment on index public.idx_conversation_messages_visible_created is
  'Supports visible-message windows and per-conversation unread counts without indexing soft-deleted rows.';

comment on index public.idx_conversations_buyer_activity is
  'Supports latest-activity conversation ordering for buyers without truncating conversation history.';

comment on index public.idx_conversations_seller_activity is
  'Supports latest-activity conversation ordering for sellers without truncating conversation history.';
