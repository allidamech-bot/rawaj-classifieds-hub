-- RAWAJ safety case assignment directory and owner escalation.

alter table public.safety_cases
  add column if not exists escalated_to_owner boolean not null default false,
  add column if not exists escalated_at timestamptz;

create or replace function public.rawaj_safety_list_staff()
returns table (
  id uuid,
  display_name text,
  email text,
  roles public.rawaj_user_role[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(nullif(btrim(p.display_name), ''), p.email, p.id::text),
    p.email,
    array_agg(distinct ur.role order by ur.role)
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  where public.current_user_is_admin_like()
    and ur.role in ('owner', 'admin', 'moderator')
    and p.account_status = 'active'
  group by p.id, p.display_name, p.email
  order by coalesce(nullif(btrim(p.display_name), ''), p.email, p.id::text);
$$;

create or replace function public.rawaj_safety_escalate_case(
  p_id uuid,
  p_expected_version bigint,
  p_reason text
)
returns table (id uuid, version bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_id uuid;
  v_version bigint;
  v_updated_at timestamptz;
begin
  if v_actor is null or not public.current_user_is_admin_like() then
    raise exception 'Safety case permission required.';
  end if;

  if char_length(v_reason) < 3 then
    raise exception 'A clear escalation reason is required.';
  end if;

  update public.safety_cases
  set
    escalated_to_owner = true,
    escalated_at = now(),
    version = version + 1,
    updated_by = v_actor,
    updated_at = now()
  where safety_cases.id = p_id
    and safety_cases.version = p_expected_version
  returning safety_cases.id, safety_cases.version, safety_cases.updated_at
    into v_id, v_version, v_updated_at;

  if v_id is null then
    if exists (select 1 from public.safety_cases c where c.id = p_id) then
      raise exception 'stale_safety_case';
    end if;
    raise exception 'Safety case does not exist.';
  end if;

  perform public.rawaj_insert_audit_log(
    'safety_case.escalated_to_owner',
    'safety_cases',
    v_id::text,
    jsonb_build_object('reason', v_reason)
  );

  return query select v_id, v_version, v_updated_at;
end;
$$;

create or replace function public.rawaj_safety_list_cases(
  p_status text default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  source_type text,
  source_id text,
  subject_user_id uuid,
  title text,
  summary text,
  severity text,
  status text,
  assigned_to uuid,
  resolution_note text,
  escalated_to_owner boolean,
  escalated_at timestamptz,
  version bigint,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  closed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.source_type,
    c.source_id,
    c.subject_user_id,
    c.title,
    c.summary,
    c.severity,
    c.status,
    c.assigned_to,
    c.resolution_note,
    c.escalated_to_owner,
    c.escalated_at,
    c.version,
    c.created_by,
    c.updated_by,
    c.created_at,
    c.updated_at,
    c.closed_at
  from public.safety_cases c
  where public.current_user_is_admin_like()
    and (p_status is null or btrim(p_status) = '' or c.status = p_status)
  order by
    c.escalated_to_owner desc,
    case c.severity
      when 'critical' then 1
      when 'high' then 2
      when 'medium' then 3
      else 4
    end,
    c.updated_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 250);
$$;

revoke all on function public.rawaj_safety_list_staff() from public;
revoke all on function public.rawaj_safety_list_staff() from anon;
grant execute on function public.rawaj_safety_list_staff() to authenticated;

revoke all on function public.rawaj_safety_escalate_case(uuid, bigint, text) from public;
revoke all on function public.rawaj_safety_escalate_case(uuid, bigint, text) from anon;
grant execute on function public.rawaj_safety_escalate_case(uuid, bigint, text) to authenticated;

revoke all on function public.rawaj_safety_list_cases(text, integer) from public;
revoke all on function public.rawaj_safety_list_cases(text, integer) from anon;
grant execute on function public.rawaj_safety_list_cases(text, integer) to authenticated;
