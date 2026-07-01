-- RAWAJ Sprint 5A messaging and public seller search contract.
--
-- Manual-only migration: review and run from Supabase Dashboard SQL Editor.
-- Do not execute from Lovable or from the frontend.

create extension if not exists pgcrypto;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  buyer_user_id uuid not null references public.profiles(id) on delete cascade,
  seller_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active',
  last_message_at timestamptz,
  last_message_preview text,
  buyer_last_read_at timestamptz,
  seller_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations drop constraint if exists conversations_status_allowed;
alter table public.conversations
  add constraint conversations_status_allowed
  check (status in ('active', 'archived', 'blocked'));

alter table public.conversations drop constraint if exists conversations_no_self;
alter table public.conversations
  add constraint conversations_no_self check (buyer_user_id <> seller_user_id);

create unique index if not exists idx_conversations_unique_active
  on public.conversations (listing_id, buyer_user_id, seller_user_id)
  where status = 'active';

create index if not exists idx_conversations_buyer_updated
  on public.conversations (buyer_user_id, updated_at desc);

create index if not exists idx_conversations_seller_updated
  on public.conversations (seller_user_id, updated_at desc);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

alter table public.conversation_messages drop constraint if exists conversation_messages_body_length;
alter table public.conversation_messages
  add constraint conversation_messages_body_length
  check (char_length(btrim(body)) between 1 and 2000);

create index if not exists idx_conversation_messages_conversation_created
  on public.conversation_messages (conversation_id, created_at asc);

create or replace function public.rawaj_is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and auth.uid() in (c.buyer_user_id, c.seller_user_id)
  );
$$;

create or replace function public.rawaj_touch_conversations_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists conversations_touch_updated_at on public.conversations;
create trigger conversations_touch_updated_at
before update on public.conversations
for each row execute function public.rawaj_touch_conversations_updated_at();

create or replace function public.rawaj_validate_conversation_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_owner uuid;
  listing_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to start a conversation.';
  end if;

  select owner_id, status
  into listing_owner, listing_status
  from public.listings
  where id = new.listing_id;

  if listing_owner is null then
    raise exception 'Listing does not exist.';
  end if;

  if listing_status <> 'approved' then
    raise exception 'Conversations can only be started for approved listings.';
  end if;

  if new.seller_user_id is distinct from listing_owner then
    raise exception 'Conversation seller must match listing owner.';
  end if;

  if new.buyer_user_id is distinct from auth.uid() then
    raise exception 'Buyer cannot be spoofed.';
  end if;

  if new.buyer_user_id = new.seller_user_id then
    raise exception 'Users cannot start conversations with themselves.';
  end if;

  new.status := coalesce(new.status, 'active');
  new.last_message_at := null;
  new.last_message_preview := null;
  new.buyer_last_read_at := null;
  new.seller_last_read_at := null;

  return new;
end;
$$;

drop trigger if exists conversations_validate_insert on public.conversations;
create trigger conversations_validate_insert
before insert on public.conversations
for each row execute function public.rawaj_validate_conversation_insert();

create or replace function public.rawaj_validate_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_row public.conversations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to send messages.';
  end if;

  select *
  into conversation_row
  from public.conversations
  where id = new.conversation_id;

  if conversation_row.id is null then
    raise exception 'Conversation does not exist.';
  end if;

  if conversation_row.status <> 'active' then
    raise exception 'Conversation is not active.';
  end if;

  if new.sender_user_id is distinct from auth.uid() then
    raise exception 'Sender cannot be spoofed.';
  end if;

  if new.sender_user_id not in (conversation_row.buyer_user_id, conversation_row.seller_user_id) then
    raise exception 'Only conversation participants can send messages.';
  end if;

  new.body := btrim(new.body);
  new.edited_at := null;
  new.deleted_at := null;

  return new;
end;
$$;

drop trigger if exists conversation_messages_validate_insert on public.conversation_messages;
create trigger conversation_messages_validate_insert
before insert on public.conversation_messages
for each row execute function public.rawaj_validate_message_insert();

create or replace function public.rawaj_update_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    last_message_at = new.created_at,
    last_message_preview = left(new.body, 160),
    buyer_last_read_at = case
      when new.sender_user_id = buyer_user_id then new.created_at
      else buyer_last_read_at
    end,
    seller_last_read_at = case
      when new.sender_user_id = seller_user_id then new.created_at
      else seller_last_read_at
    end
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists conversation_messages_update_conversation on public.conversation_messages;
create trigger conversation_messages_update_conversation
after insert on public.conversation_messages
for each row execute function public.rawaj_update_conversation_after_message();

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

drop policy if exists "conversations_participant_select" on public.conversations;
create policy "conversations_participant_select"
on public.conversations
for select
to authenticated
using (auth.uid() in (buyer_user_id, seller_user_id));

drop policy if exists "conversations_buyer_insert" on public.conversations;
create policy "conversations_buyer_insert"
on public.conversations
for insert
to authenticated
with check (
  buyer_user_id = auth.uid()
  and buyer_user_id <> seller_user_id
);

drop policy if exists "conversations_participant_update_read" on public.conversations;

drop policy if exists "conversation_messages_participant_select" on public.conversation_messages;
create policy "conversation_messages_participant_select"
on public.conversation_messages
for select
to authenticated
using (public.rawaj_is_conversation_participant(conversation_id));

drop policy if exists "conversation_messages_participant_insert" on public.conversation_messages;
create policy "conversation_messages_participant_insert"
on public.conversation_messages
for insert
to authenticated
with check (
  sender_user_id = auth.uid()
  and public.rawaj_is_conversation_participant(conversation_id)
);

create or replace function public.rawaj_start_listing_conversation(p_listing_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_owner uuid;
  listing_status text;
  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to start a conversation.';
  end if;

  select owner_id, status
  into listing_owner, listing_status
  from public.listings
  where id = p_listing_id;

  if listing_owner is null then
    raise exception 'Listing does not exist.';
  end if;

  if listing_status <> 'approved' then
    raise exception 'Conversations can only be started for approved listings.';
  end if;

  if listing_owner = auth.uid() then
    raise exception 'Users cannot message themselves.';
  end if;

  insert into public.conversations (listing_id, buyer_user_id, seller_user_id)
  values (p_listing_id, auth.uid(), listing_owner)
  on conflict (listing_id, buyer_user_id, seller_user_id) where status = 'active'
  do update set updated_at = public.conversations.updated_at
  returning id into conversation_id;

  return conversation_id;
end;
$$;

revoke execute on function public.rawaj_start_listing_conversation(uuid) from public;
revoke execute on function public.rawaj_start_listing_conversation(uuid) from anon;
grant execute on function public.rawaj_start_listing_conversation(uuid) to authenticated;

create or replace function public.rawaj_fetch_my_conversations()
returns table (
  id uuid,
  listing_id uuid,
  listing_title text,
  buyer_user_id uuid,
  seller_user_id uuid,
  status text,
  other_user_id uuid,
  other_display_name text,
  other_avatar_url text,
  other_governorate text,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.listing_id,
    l.title as listing_title,
    c.buyer_user_id,
    c.seller_user_id,
    c.status,
    case when auth.uid() = c.buyer_user_id then c.seller_user_id else c.buyer_user_id end as other_user_id,
    coalesce(other_profile.display_name, 'مستخدم رواجا') as other_display_name,
    other_profile.avatar_url as other_avatar_url,
    other_profile.governorate as other_governorate,
    c.last_message_at,
    c.last_message_preview,
    (
      select count(*)::integer
      from public.conversation_messages m
      where m.conversation_id = c.id
        and m.sender_user_id <> auth.uid()
        and m.deleted_at is null
        and m.created_at > coalesce(
          case
            when auth.uid() = c.buyer_user_id then c.buyer_last_read_at
            else c.seller_last_read_at
          end,
          '-infinity'::timestamptz
        )
    ) as unread_count,
    c.created_at,
    c.updated_at
  from public.conversations c
  join public.listings l on l.id = c.listing_id
  left join public.profiles other_profile
    on other_profile.id = case
      when auth.uid() = c.buyer_user_id then c.seller_user_id
      else c.buyer_user_id
    end
  where auth.uid() in (c.buyer_user_id, c.seller_user_id)
  order by coalesce(c.last_message_at, c.updated_at, c.created_at) desc;
$$;

revoke execute on function public.rawaj_fetch_my_conversations() from public;
revoke execute on function public.rawaj_fetch_my_conversations() from anon;
grant execute on function public.rawaj_fetch_my_conversations() to authenticated;

create or replace function public.rawaj_mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    buyer_last_read_at = case when auth.uid() = buyer_user_id then now() else buyer_last_read_at end,
    seller_last_read_at = case when auth.uid() = seller_user_id then now() else seller_last_read_at end
  where id = p_conversation_id
    and auth.uid() in (buyer_user_id, seller_user_id);

  if not found then
    raise exception 'Conversation not found or not accessible.';
  end if;
end;
$$;

revoke execute on function public.rawaj_mark_conversation_read(uuid) from public;
revoke execute on function public.rawaj_mark_conversation_read(uuid) from anon;
grant execute on function public.rawaj_mark_conversation_read(uuid) to authenticated;

create or replace function public.search_public_sellers(p_query text, p_limit integer default 8)
returns table (
  id uuid,
  display_name text,
  first_name text,
  last_name text,
  business_name text,
  governorate text,
  bio text,
  avatar_url text,
  approved_listing_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with approved_sellers as (
    select owner_id, count(*)::integer as approved_listing_count
    from public.listings
    where status = 'approved'
    group by owner_id
  )
  select
    p.id,
    p.display_name,
    p.first_name,
    p.last_name,
    p.business_name,
    p.governorate,
    p.bio,
    p.avatar_url,
    s.approved_listing_count
  from approved_sellers s
  join public.profiles p on p.id = s.owner_id
  where length(btrim(coalesce(p_query, ''))) >= 2
    and (
      p.display_name ilike '%' || btrim(p_query) || '%'
      or p.first_name ilike '%' || btrim(p_query) || '%'
      or p.last_name ilike '%' || btrim(p_query) || '%'
      or p.business_name ilike '%' || btrim(p_query) || '%'
      or p.governorate ilike '%' || btrim(p_query) || '%'
      or p.bio ilike '%' || btrim(p_query) || '%'
    )
  order by s.approved_listing_count desc, p.display_name nulls last, p.created_at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

revoke execute on function public.search_public_sellers(text, integer) from public;
grant execute on function public.search_public_sellers(text, integer) to anon, authenticated;

comment on table public.conversations is
  'Participant-only buyer-seller conversations linked to approved listings.';

comment on table public.conversation_messages is
  'Participant-only messages inside RAWAJ listing conversations.';

comment on function public.search_public_sellers(text, integer) is
  'Searches only safe public seller profile fields for users with at least one approved listing.';
