-- RAWAJ seller-review eligibility contract.
--
-- Reviews must be tied to a real buyer/seller interaction. A qualifying interaction
-- requires a conversation between the reviewer and seller on a listing owned by
-- that seller, with at least one non-deleted message from each participant.
--
-- This migration deliberately does not infer a buyer from a sold/rented status
-- alone because RAWAJ does not yet have a transaction/hand-off table that proves
-- which buyer completed the deal.

create or replace function public.rawaj_get_seller_review_eligibility(
  p_seller_user_id uuid,
  p_related_listing_id uuid default null
)
returns table (
  eligible boolean,
  related_listing_id uuid,
  conversation_id uuid,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer uuid := auth.uid();
  v_existing_review boolean := false;
  v_listing_id uuid;
  v_conversation_id uuid;
begin
  if v_reviewer is null then
    return query select false, null::uuid, null::uuid, 'auth_required'::text;
    return;
  end if;

  if p_seller_user_id is null or p_seller_user_id = v_reviewer then
    return query select false, null::uuid, null::uuid, 'invalid_seller'::text;
    return;
  end if;

  select exists (
    select 1
    from public.seller_reviews r
    where r.seller_user_id = p_seller_user_id
      and r.reviewer_user_id = v_reviewer
      and r.status in ('pending_review', 'approved')
  )
  into v_existing_review;

  if v_existing_review then
    return query select false, null::uuid, null::uuid, 'existing_review'::text;
    return;
  end if;

  select c.listing_id, c.id
  into v_listing_id, v_conversation_id
  from public.conversations c
  join public.listings l
    on l.id = c.listing_id
   and l.owner_id = p_seller_user_id
  where c.buyer_user_id = v_reviewer
    and c.seller_user_id = p_seller_user_id
    and (p_related_listing_id is null or c.listing_id = p_related_listing_id)
    and exists (
      select 1
      from public.conversation_messages buyer_message
      where buyer_message.conversation_id = c.id
        and buyer_message.sender_user_id = v_reviewer
        and buyer_message.deleted_at is null
    )
    and exists (
      select 1
      from public.conversation_messages seller_message
      where seller_message.conversation_id = c.id
        and seller_message.sender_user_id = p_seller_user_id
        and seller_message.deleted_at is null
    )
  order by coalesce(c.last_message_at, c.updated_at, c.created_at) desc
  limit 1;

  if v_conversation_id is null then
    return query select false, null::uuid, null::uuid, 'no_qualifying_interaction'::text;
    return;
  end if;

  return query select true, v_listing_id, v_conversation_id, 'eligible'::text;
end;
$$;

revoke all on function public.rawaj_get_seller_review_eligibility(uuid, uuid) from public;
revoke all on function public.rawaj_get_seller_review_eligibility(uuid, uuid) from anon;
grant execute on function public.rawaj_get_seller_review_eligibility(uuid, uuid) to authenticated;

create or replace function public.rawaj_create_eligible_seller_review(
  p_seller_user_id uuid,
  p_rating integer,
  p_comment text,
  p_related_listing_id uuid default null
)
returns public.seller_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer uuid := auth.uid();
  v_eligibility record;
  v_review public.seller_reviews%rowtype;
begin
  if v_reviewer is null then
    raise exception 'seller_review_auth_required';
  end if;

  if p_seller_user_id is null or p_seller_user_id = v_reviewer then
    raise exception 'seller_review_invalid_seller';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'seller_review_invalid_rating';
  end if;

  if char_length(btrim(coalesce(p_comment, ''))) not between 10 and 1200 then
    raise exception 'seller_review_invalid_comment';
  end if;

  select *
  into v_eligibility
  from public.rawaj_get_seller_review_eligibility(
    p_seller_user_id,
    p_related_listing_id
  )
  limit 1;

  if coalesce(v_eligibility.eligible, false) is not true then
    if v_eligibility.reason = 'existing_review' then
      raise exception 'seller_review_already_exists';
    end if;
    raise exception 'seller_review_not_eligible';
  end if;

  insert into public.seller_reviews (
    seller_user_id,
    reviewer_user_id,
    related_listing_id,
    rating,
    comment,
    status,
    admin_note,
    reviewed_by,
    reviewed_at
  )
  values (
    p_seller_user_id,
    v_reviewer,
    v_eligibility.related_listing_id,
    p_rating,
    btrim(p_comment),
    'pending_review',
    null,
    null,
    null
  )
  returning * into v_review;

  return v_review;
end;
$$;

revoke all on function public.rawaj_create_eligible_seller_review(uuid, integer, text, uuid) from public;
revoke all on function public.rawaj_create_eligible_seller_review(uuid, integer, text, uuid) from anon;
grant execute on function public.rawaj_create_eligible_seller_review(uuid, integer, text, uuid) to authenticated;

-- Direct client inserts are no longer part of the supported contract. All new
-- reviews must pass through the eligibility RPC above. Existing approved and
-- pending rows remain unchanged.
drop policy if exists "seller_reviews_user_insert" on public.seller_reviews;

comment on function public.rawaj_get_seller_review_eligibility(uuid, uuid) is
  'Checks whether the authenticated buyer has a bidirectional conversation with the seller on a seller-owned listing and has no open/approved review.';

comment on function public.rawaj_create_eligible_seller_review(uuid, integer, text, uuid) is
  'Creates a pending seller review only after database-enforced interaction eligibility; reviewer identity is always auth.uid().';
