-- RAWAJ governed seller-review moderation.
--
-- Replaces direct client table mutation with an authority-checked,
-- stale-safe SECURITY DEFINER RPC. Existing rows are not rewritten.
-- Existing table triggers remain authoritative for reviewer stamping and audit.

create or replace function public.rawaj_admin_moderate_seller_review(
  p_review_id uuid,
  p_status text,
  p_admin_note text,
  p_expected_updated_at timestamptz
)
returns table (
  review_id uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_review_id uuid;
  v_updated_at timestamptz;
begin
  if v_actor is null
     or not public.current_user_can_moderate() then
    raise exception 'Seller review moderation permission required.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Unsupported seller review status.';
  end if;

  if p_expected_updated_at is null then
    raise exception 'Expected review timestamp is required.';
  end if;

  update public.seller_reviews
  set
    status = p_status,
    admin_note = nullif(btrim(coalesce(p_admin_note, '')), '')
  where seller_reviews.id = p_review_id
    and seller_reviews.status = 'pending_review'
    and seller_reviews.updated_at = p_expected_updated_at
  returning
    seller_reviews.id,
    seller_reviews.updated_at
  into
    v_review_id,
    v_updated_at;

  if v_review_id is null then
    if exists (
      select 1
      from public.seller_reviews r
      where r.id = p_review_id
    ) then
      raise exception 'stale_seller_review';
    end if;

    raise exception 'Seller review does not exist.';
  end if;

  return query
  select
    v_review_id,
    v_updated_at;
end;
$$;

revoke all on function public.rawaj_admin_moderate_seller_review(
  uuid,
  text,
  text,
  timestamptz
) from public;

revoke all on function public.rawaj_admin_moderate_seller_review(
  uuid,
  text,
  text,
  timestamptz
) from anon;

grant execute on function public.rawaj_admin_moderate_seller_review(
  uuid,
  text,
  text,
  timestamptz
) to authenticated;
