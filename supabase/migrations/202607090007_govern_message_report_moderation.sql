-- RAWAJ governed message-report moderation.
--
-- Replaces direct client table mutation with an authority-checked,
-- stale-safe, audited SECURITY DEFINER RPC. Existing message-report rows
-- are not rewritten by this migration.

create or replace function public.rawaj_admin_moderate_message_report(
  p_report_id uuid,
  p_status text,
  p_admin_note text,
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
    raise exception 'Message report moderation permission required.';
  end if;

  if p_status not in ('new', 'under_review', 'resolved', 'rejected') then
    raise exception 'Unsupported message report status.';
  end if;

  if p_expected_updated_at is null then
    raise exception 'Expected report timestamp is required.';
  end if;

  update public.message_reports
  set
    status = p_status,
    admin_note = nullif(btrim(coalesce(p_admin_note, '')), '')
  where message_reports.id = p_report_id
    and message_reports.updated_at = p_expected_updated_at
  returning
    message_reports.id,
    message_reports.updated_at
  into
    v_report_id,
    v_updated_at;

  if v_report_id is null then
    if exists (
      select 1
      from public.message_reports r
      where r.id = p_report_id
    ) then
      raise exception 'stale_message_report';
    end if;

    raise exception 'Message report does not exist.';
  end if;

  perform public.rawaj_insert_audit_log(
    'message_report.moderated',
    'message_reports',
    v_report_id::text,
    jsonb_build_object(
      'status', p_status
    )
  );

  return query
  select
    v_report_id,
    v_updated_at;
end;
$$;

revoke all on function public.rawaj_admin_moderate_message_report(
  uuid,
  text,
  text,
  timestamptz
) from public;

revoke all on function public.rawaj_admin_moderate_message_report(
  uuid,
  text,
  text,
  timestamptz
) from anon;

grant execute on function public.rawaj_admin_moderate_message_report(
  uuid,
  text,
  text,
  timestamptz
) to authenticated;
