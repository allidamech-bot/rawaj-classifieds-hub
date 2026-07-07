-- RAWAJ hotfix: preserve conversation history when a listing is deleted.
--
-- The historical conversations.listing_id FK used ON DELETE RESTRICT, which made
-- owner self-delete fail as soon as an approved listing had a conversation.
--
-- This migration deliberately preserves conversations and messages instead of
-- cascading deletion. Deleted listings become a historical snapshot inside chat.

alter table public.conversations
  add column if not exists listing_title_snapshot text;

alter table public.conversations
  alter column listing_id drop not null;

alter table public.conversations
  drop constraint if exists conversations_listing_id_fkey;

alter table public.conversations
  add constraint conversations_listing_id_fkey
  foreign key (listing_id)
  references public.listings(id)
  on delete set null;

create or replace function public.rawaj_snapshot_conversation_listing_title()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.listing_id is not null then
    select l.title
      into new.listing_title_snapshot
    from public.listings l
    where l.id = new.listing_id;
  end if;

  return new;
end;
$$;

drop trigger if exists conversations_snapshot_listing_title on public.conversations;
create trigger conversations_snapshot_listing_title
before insert or update of listing_id on public.conversations
for each row execute function public.rawaj_snapshot_conversation_listing_title();

create or replace function public.rawaj_preserve_conversations_before_listing_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set listing_title_snapshot = coalesce(nullif(btrim(listing_title_snapshot), ''), old.title),
      status = case when status = 'active' then 'archived' else status end
  where listing_id = old.id;

  return old;
end;
$$;

drop trigger if exists listings_preserve_conversations_before_delete on public.listings;
create trigger listings_preserve_conversations_before_delete
before delete on public.listings
for each row execute function public.rawaj_preserve_conversations_before_listing_delete();

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
    coalesce(l.title, c.listing_title_snapshot, 'إعلان محذوف') as listing_title,
    c.buyer_user_id,
    c.seller_user_id,
    c.status,
    case when auth.uid() = c.buyer_user_id then c.seller_user_id else c.buyer_user_id end as other_user_id,
    coalesce(other_profile.display_name, 'مستخدم رواج') as other_display_name,
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
  left join public.listings l on l.id = c.listing_id
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

create or replace function public.rawaj_fetch_message_reports_for_admin()
returns table (
  id uuid,
  message_id uuid,
  conversation_id uuid,
  reporter_user_id uuid,
  reported_user_id uuid,
  reason text,
  details text,
  status text,
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  message_body text,
  listing_id uuid,
  listing_title text,
  reporter_display_name text,
  reported_display_name text
)
language sql
security definer
set search_path = public
as $$
  select
    r.id,
    r.message_id,
    r.conversation_id,
    r.reporter_user_id,
    r.reported_user_id,
    r.reason,
    r.details,
    r.status,
    r.admin_note,
    r.reviewed_by,
    r.reviewed_at,
    r.created_at,
    r.updated_at,
    m.body as message_body,
    c.listing_id,
    coalesce(l.title, c.listing_title_snapshot, 'إعلان محذوف') as listing_title,
    coalesce(reporter.display_name, reporter.first_name, 'RAWAJ user') as reporter_display_name,
    coalesce(reported.display_name, reported.first_name, 'RAWAJ user') as reported_display_name
  from public.message_reports r
  join public.conversation_messages m on m.id = r.message_id
  join public.conversations c on c.id = r.conversation_id
  left join public.listings l on l.id = c.listing_id
  left join public.profiles reporter on reporter.id = r.reporter_user_id
  left join public.profiles reported on reported.id = r.reported_user_id
  where public.current_user_can_moderate()
  order by r.created_at desc
  limit 100;
$$;

revoke execute on function public.rawaj_fetch_message_reports_for_admin() from public;
revoke execute on function public.rawaj_fetch_message_reports_for_admin() from anon;
grant execute on function public.rawaj_fetch_message_reports_for_admin() to authenticated;

comment on column public.conversations.listing_title_snapshot is
  'Fallback title preserved for chat history after the referenced listing is deleted.';
