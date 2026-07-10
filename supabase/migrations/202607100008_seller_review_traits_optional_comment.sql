-- RAWAJ seller-review quick traits and optional written comment contract.
--
-- Existing review rows are preserved. Written comments become optional, but when
-- present remain bounded. Quick traits are controlled, unique, and capped at three.
-- A new five-argument creation RPC accepts traits while the existing four-argument
-- RPC remains as a compatibility wrapper for already-deployed clients.

alter table public.seller_reviews
  add column if not exists traits text[] not null default '{}'::text[];

alter table public.seller_reviews
  alter column comment drop not null;

alter table public.seller_reviews
  drop constraint if exists seller_reviews_comment_length;

alter table public.seller_reviews
  add constraint seller_reviews_comment_length
  check (
    comment is null
    or char_length(btrim(comment)) between 10 and 1200
  );

create or replace function public.rawaj_seller_review_traits_valid(p_traits text[])
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_traits text[] := coalesce(p_traits, '{}'::text[]);
  v_trait text;
  v_seen text[] := '{}'::text[];
begin
  if cardinality(v_traits) > 3 then
    return false;
  end if;

  foreach v_trait in array v_traits
  loop
    if v_trait not in (
      'accurate_description',
      'good_communication',
      'fast_response',
      'fair_deal',
      'punctual',
      'trustworthy'
    ) then
      return false;
    end if;

    if v_trait = any(v_seen) then
      return false;
    end if;

    v_seen := array_append(v_seen, v_trait);
  end loop;

  return true;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'seller_reviews_traits_allowed_check'
      and conrelid = 'public.seller_reviews'::regclass
  ) then
    alter table public.seller_reviews
      add constraint seller_reviews_traits_allowed_check
      check (public.rawaj_seller_review_traits_valid(traits));
  end if;
end
$$;

create or replace function public.rawaj_create_eligible_seller_review(
  p_seller_user_id uuid,
  p_rating integer,
  p_comment text,
  p_related_listing_id uuid,
  p_traits text[]
)
returns public.seller_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer uuid := auth.uid();
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_traits text[] := coalesce(p_traits, '{}'::text[]);
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

  if v_comment is not null and char_length(v_comment) not between 10 and 1200 then
    raise exception 'seller_review_invalid_comment';
  end if;

  if not public.rawaj_seller_review_traits_valid(v_traits) then
    raise exception 'seller_review_invalid_traits';
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
    traits,
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
    v_comment,
    v_traits,
    'pending_review',
    null,
    null,
    null
  )
  returning * into v_review;

  return v_review;
end;
$$;

create or replace function public.rawaj_create_eligible_seller_review(
  p_seller_user_id uuid,
  p_rating integer,
  p_comment text,
  p_related_listing_id uuid default null
)
returns public.seller_reviews
language sql
security definer
set search_path = public
as $$
  select public.rawaj_create_eligible_seller_review(
    p_seller_user_id,
    p_rating,
    p_comment,
    p_related_listing_id,
    '{}'::text[]
  );
$$;

revoke all on function public.rawaj_create_eligible_seller_review(uuid, integer, text, uuid, text[]) from public;
revoke all on function public.rawaj_create_eligible_seller_review(uuid, integer, text, uuid, text[]) from anon;
grant execute on function public.rawaj_create_eligible_seller_review(uuid, integer, text, uuid, text[]) to authenticated;

revoke all on function public.rawaj_create_eligible_seller_review(uuid, integer, text, uuid) from public;
revoke all on function public.rawaj_create_eligible_seller_review(uuid, integer, text, uuid) from anon;
grant execute on function public.rawaj_create_eligible_seller_review(uuid, integer, text, uuid) to authenticated;

comment on column public.seller_reviews.traits is
  'Up to three unique controlled quick-trait keys describing an eligible buyer experience.';

comment on function public.rawaj_create_eligible_seller_review(uuid, integer, text, uuid, text[]) is
  'Creates an eligible pending seller review with an optional bounded comment and up to three controlled unique traits.';

comment on function public.rawaj_create_eligible_seller_review(uuid, integer, text, uuid) is
  'Compatibility wrapper for clients that do not yet submit seller-review traits.';
