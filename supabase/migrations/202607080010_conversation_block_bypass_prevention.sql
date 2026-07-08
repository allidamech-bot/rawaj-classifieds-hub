-- RAWAJ conversation block bypass prevention.
-- A blocked buyer/seller thread for a listing cannot be bypassed by starting a fresh active conversation.

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

  if exists (
    select 1
    from public.conversations c
    where c.listing_id = p_listing_id
      and c.buyer_user_id = auth.uid()
      and c.seller_user_id = listing_owner
      and (
        c.status = 'blocked'
        or exists (
          select 1
          from public.user_blocks b
          where b.conversation_id = c.id
            and (
              (b.blocker_user_id = auth.uid() and b.blocked_user_id = listing_owner)
              or (b.blocker_user_id = listing_owner and b.blocked_user_id = auth.uid())
            )
        )
      )
  ) then
    raise exception 'This conversation relationship is blocked.';
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

comment on function public.rawaj_start_listing_conversation(uuid) is
  'Starts or reuses an active listing conversation while preventing bypass of an existing blocked relationship for the same listing and participants.';
