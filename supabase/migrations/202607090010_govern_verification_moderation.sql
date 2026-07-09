-- RAWAJ governed seller-verification moderation.
--
-- Replace direct authenticated table updates with an authority-checked,
-- stale-safe SECURITY DEFINER RPC and make that RPC the exclusive moderation
-- write path. Existing rows are not rewritten.

create or replace function public.rawaj_admin_moderate_verification_request(
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
    raise exception 'Verification moderation permission required.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Unsupported verification status.';
  end if;

  if p_expected_updated_at is null then
    raise exception 'Expected verification timestamp is required.';
  end if;

  update public.seller_verification_requests
  set
    status = p_status,
    admin_note = nullif(btrim(coalesce(p_admin_note, '')), '')
  where seller_verification_requests.id = p_request_id
    and seller_verification_requests.status = 'pending_review'
    and seller_verification_requests.updated_at = p_expected_updated_at
  returning
    seller_verification_requests.id,
    seller_verification_requests.updated_at
  into
    v_request_id,
    v_updated_at;

  if v_request_id is null then
    if exists (
      select 1
      from public.seller_verification_requests r
      where r.id = p_request_id
    ) then
      raise exception 'stale_verification_request';
    end if;

    raise exception 'Verification request does not exist.';
  end if;

  perform public.rawaj_insert_audit_log(
    'seller_verification.moderated',
    'seller_verification_requests',
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

revoke all on function public.rawaj_admin_moderate_verification_request(
  uuid,
  text,
  text,
  timestamptz
) from public;

revoke all on function public.rawaj_admin_moderate_verification_request(
  uuid,
  text,
  text,
  timestamptz
) from anon;

grant execute on function public.rawaj_admin_moderate_verification_request(
  uuid,
  text,
  text,
  timestamptz
) to authenticated;

-- Remove the alternate direct moderation path so the stale-safe RPC is
-- authoritative for moderation state changes.
drop policy if exists "seller_verification_admin_update"
  on public.seller_verification_requests;
