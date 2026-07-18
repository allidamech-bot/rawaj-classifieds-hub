-- RAWAJ chat delivery/read receipt projection.
-- Forward-only migration. Apply manually to Supabase Production after review.

drop function if exists public.rawaj_fetch_my_conversations();

create function public.rawaj_fetch_my_conversations()
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
  other_last_read_at timestamptz,
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
    case when auth.uid() = c.buyer_user_id then c.seller_user_id else c.buyer_user_id end,
    coalesce(other_profile.display_name, 'مستخدم رواج'),
    other_profile.avatar_url,
    other_profile.governorate,
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
    ),
    case
      when auth.uid() = c.buyer_user_id then c.seller_last_read_at
      else c.buyer_last_read_at
    end,
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

revoke all on function public.rawaj_fetch_my_conversations() from public;
revoke all on function public.rawaj_fetch_my_conversations() from anon;
grant execute on function public.rawaj_fetch_my_conversations() to authenticated;

comment on function public.rawaj_fetch_my_conversations() is
  'Returns participant-relative conversation summaries including the other participant read watermark.';

notify pgrst, 'reload schema';
