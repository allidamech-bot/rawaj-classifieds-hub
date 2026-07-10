-- RAWAJ seller-review response trigger-path repair.
--
-- The original seller_reviews update trigger only admitted privileged moderation
-- writes. The seller-response RPC is intentionally available to the seller, so it
-- needs a narrowly scoped transaction-local write path without reopening direct
-- table UPDATE permissions.

create or replace function public.rawaj_protect_seller_review_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('rawaj.seller_review_response_write', true) = 'on' then
    if auth.uid() is null or old.seller_user_id <> auth.uid() then
      raise exception 'seller_review_response_permission_denied';
    end if;

    if old.status <> 'approved' or new.status is distinct from old.status then
      raise exception 'seller_review_response_requires_approved_review';
    end if;

    if (to_jsonb(new) - array['seller_response', 'seller_response_updated_at', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['seller_response', 'seller_response_updated_at', 'updated_at'])
    then
      raise exception 'seller_review_response_unsafe_update';
    end if;

    return new;
  end if;

  if not public.current_user_can_moderate() then
    raise exception 'Only privileged users can moderate seller reviews.';
  end if;

  if (to_jsonb(new) - array[
        'status',
        'admin_note',
        'reviewed_by',
        'reviewed_at',
        'updated_at'
      ])
     is distinct from
     (to_jsonb(old) - array[
        'status',
        'admin_note',
        'reviewed_by',
        'reviewed_at',
        'updated_at'
      ])
  then
    raise exception 'Moderators can only change moderation-safe seller review fields.';
  end if;

  if new.status is distinct from old.status
    or new.admin_note is distinct from old.admin_note
  then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;

  return new;
end;
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

  perform set_config('rawaj.seller_review_response_write', 'on', true);

  update public.seller_reviews
  set seller_response = v_response,
      seller_response_updated_at = case when v_response is null then null else now() end,
      updated_at = now()
  where id = p_review_id
  returning * into v_review;

  perform set_config('rawaj.seller_review_response_write', 'off', true);

  return v_review;
end;
$$;

revoke all on function public.rawaj_set_seller_review_response(uuid, text) from public;
revoke all on function public.rawaj_set_seller_review_response(uuid, text) from anon;
grant execute on function public.rawaj_set_seller_review_response(uuid, text) to authenticated;

comment on function public.rawaj_set_seller_review_response(uuid, text) is
  'Allows only the authenticated seller to add, edit, or clear a response on their own approved seller review through a trigger-approved transaction-local write path.';
