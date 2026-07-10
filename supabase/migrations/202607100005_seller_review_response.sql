-- RAWAJ seller response contract for approved seller reviews.
--
-- A response is public only because the underlying review is approved. The seller
-- identity is derived from auth.uid(); clients cannot respond on behalf of another
-- seller. Empty input removes an existing response.

alter table public.seller_reviews
  add column if not exists seller_response text null,
  add column if not exists seller_response_updated_at timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'seller_reviews_seller_response_length_check'
      and conrelid = 'public.seller_reviews'::regclass
  ) then
    alter table public.seller_reviews
      add constraint seller_reviews_seller_response_length_check
      check (
        seller_response is null
        or char_length(btrim(seller_response)) between 3 and 800
      );
  end if;
end
$$;

create or replace function public.rawaj_set_seller_review_response(
  p_review_id uuid,
  p_response text
)
returns public.seller_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller uuid := auth.uid();
  v_response text := nullif(btrim(coalesce(p_response, '')), '');
  v_review public.seller_reviews%rowtype;
begin
  if v_seller is null then
    raise exception 'seller_review_response_auth_required';
  end if;

  if p_review_id is null then
    raise exception 'seller_review_response_invalid_review';
  end if;

  if v_response is not null and char_length(v_response) not between 3 and 800 then
    raise exception 'seller_review_response_invalid_length';
  end if;

  select *
  into v_review
  from public.seller_reviews
  where id = p_review_id
  for update;

  if not found then
    raise exception 'seller_review_response_not_found';
  end if;

  if v_review.seller_user_id <> v_seller then
    raise exception 'seller_review_response_permission_denied';
  end if;

  if v_review.status <> 'approved' then
    raise exception 'seller_review_response_requires_approved_review';
  end if;

  update public.seller_reviews
  set seller_response = v_response,
      seller_response_updated_at = case when v_response is null then null else now() end,
      updated_at = now()
  where id = p_review_id
  returning * into v_review;

  return v_review;
end;
$$;

revoke all on function public.rawaj_set_seller_review_response(uuid, text) from public;
revoke all on function public.rawaj_set_seller_review_response(uuid, text) from anon;
grant execute on function public.rawaj_set_seller_review_response(uuid, text) to authenticated;

comment on function public.rawaj_set_seller_review_response(uuid, text) is
  'Allows only the authenticated seller to add, edit, or clear a response on their own approved seller review.';
