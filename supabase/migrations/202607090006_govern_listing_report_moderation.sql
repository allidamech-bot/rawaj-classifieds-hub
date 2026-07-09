-- RAWAJ governed listing-report moderation.
--
-- Replaces direct client table mutation with an authority-checked,
-- stale-safe, audited SECURITY DEFINER RPC. Existing report rows and
-- statuses are not rewritten by this migration.

create or replace function public.rawaj_admin_moderate_listing_report(
  p_report_id uuid,
  p_status text,
  p_assigned_to uuid,
  p_admin_note text,
  p_resolved_at timestamptz,
  p_expected_updated_at timestamptz
)
returns table (
  report_id uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_report_id uuid;
  v_updated_at timestamptz;
begin
  if v_actor is null
     or not public.current_user_can_moderate() then
    raise exception 'Listing report moderation permission required.';
  end if;

  if p_status not in ('new', 'in_review', 'resolved', 'dismissed') then
    raise exception 'Unsupported listing report status.';
  end if;

  if p_expected_updated_at is null then
    raise exception 'Expected report timestamp is required.';
  end if;

  if p_assigned_to is not null
     and not exists (
       select 1
       from public.user_roles ur
       join public.profiles p
         on p.id = ur.user_id
       where ur.user_id = p_assigned_to
         and ur.role in ('owner', 'admin', 'moderator')
         and p.account_status = 'active'
     ) then
    raise exception 'Assigned reviewer must be active authorized staff.';
  end if;

  update public.listing_reports
  set
    status = p_status,
    assigned_to = p_assigned_to,
    admin_note = nullif(btrim(coalesce(p_admin_note, '')), ''),
    resolved_at = case
      when p_status in ('resolved', 'dismissed') then coalesce(p_resolved_at, now())
      else null
    end
  where listing_reports.id = p_report_id
    and listing_reports.updated_at = p_expected_updated_at
  returning
    listing_reports.id,
    listing_reports.updated_at
  into
    v_report_id,
    v_updated_at;

  if v_report_id is null then
    if exists (
      select 1
      from public.listing_reports r
      where r.id = p_report_id
    ) then
      raise exception 'stale_listing_report';
    end if;

    raise exception 'Listing report does not exist.';
  end if;

  perform public.rawaj_insert_audit_log(
    'listing_report.moderated',
    'listing_reports',
    v_report_id::text,
    jsonb_build_object(
      'status', p_status,
      'assigned_to', p_assigned_to,
      'resolved_at', p_resolved_at
    )
  );

  return query
  select
    v_report_id,
    v_updated_at;
end;
$$;

revoke all on function public.rawaj_admin_moderate_listing_report(
  uuid,
  text,
  uuid,
  text,
  timestamptz,
  timestamptz
) from public;

revoke all on function public.rawaj_admin_moderate_listing_report(
  uuid,
  text,
  uuid,
  text,
  timestamptz,
  timestamptz
) from anon;

grant execute on function public.rawaj_admin_moderate_listing_report(
  uuid,
  text,
  uuid,
  text,
  timestamptz,
  timestamptz
) to authenticated;
