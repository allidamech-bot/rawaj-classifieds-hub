-- RAWAJ governed listing-promotion moderation.
--
-- Replace direct authenticated table updates with an authority-checked,
-- stale-safe SECURITY DEFINER RPC and make that RPC the exclusive moderation
-- write path. Existing rows are not rewritten. Existing moderation trigger
-- remains authoritative for reviewer stamping and promotion date/listing sync.

create or replace function public.rawaj_admin_moderate_promotion_request(
  p_request_id uuid,
  p_status text,
  p_admin_note text,
  p_expected_updated_at timestamptz
)
returns table (
  request_id uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_request_id uuid;
  v_updated_at timestamptz;
begin
  if v_actor is null
     or not public.current_user_can_moderate() then
    raise exception 'Promotion moderation permission required.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Unsupported promotion status.';
  end if;

  if p_expected_updated_at is null then
    raise exception 'Expected promotion timestamp is required.';
  end if;

  update public.listing_promotion_requests
  set
    status = p_status,
    admin_note = nullif(btrim(coalesce(p_admin_note, '')), '')
  where listing_promotion_requests.id = p_request_id
    and listing_promotion_requests.status = 'pending_review'
    and listing_promotion_requests.updated_at = p_expected_updated_at
  returning
    listing_promotion_requests.id,
    listing_promotion_requests.updated_at
  into
    v_request_id,
    v_updated_at;

  if v_request_id is null then
    if exists (
      select 1
      from public.listing_promotion_requests r
      where r.id = p_request_id
    ) then
      raise exception 'stale_promotion_request';
    end if;

    raise exception 'Promotion request does not exist.';
  end if;

  perform public.rawaj_insert_audit_log(
    'listing_promotion.moderated',
    'listing_promotion_requests',
    v_request_id::text,
    jsonb_build_object(
      'status', p_status,
      'has_admin_note', nullif(btrim(coalesce(p_admin_note, '')), '') is not null
    )
  );

  return query
  select
    v_request_id,
    v_updated_at;
end;
$$;

revoke all on function public.rawaj_admin_moderate_promotion_request(
  uuid,
  text,
  text,
  timestamptz
) from public;

revoke all on function public.rawaj_admin_moderate_promotion_request(
  uuid,
  text,
  text,
  timestamptz
) from anon;

grant execute on function public.rawaj_admin_moderate_promotion_request(
  uuid,
  text,
  text,
  timestamptz
) to authenticated;

-- Remove the alternate direct moderation path so the stale-safe RPC is
-- authoritative for moderation state changes.
drop policy if exists "listing_promotion_admin_update"
  on public.listing_promotion_requests;
