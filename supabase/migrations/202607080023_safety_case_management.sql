-- RAWAJ safety case management.
-- Cases are operational records, never inferred resolutions. Owner/admin/moderator access is checked in RPCs.

create table if not exists public.safety_cases (
  id uuid primary key default gen_random_uuid(),
  source_type text not null default 'manual',
  source_id text,
  subject_user_id uuid references public.profiles(id) on delete set null,
  title text not null,
  summary text not null default '',
  severity text not null default 'medium',
  status text not null default 'open',
  assigned_to uuid references public.profiles(id) on delete set null,
  resolution_note text,
  version bigint not null default 1,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  check (source_type in ('manual', 'listing_report', 'message_report', 'account')),
  check (severity in ('low', 'medium', 'high', 'critical')),
  check (status in ('open', 'investigating', 'mitigated', 'closed')),
  check (char_length(btrim(title)) between 3 and 180),
  check (char_length(summary) <= 6000),
  check (resolution_note is null or char_length(resolution_note) <= 6000)
);

create index if not exists safety_cases_status_severity_idx
  on public.safety_cases (status, severity, updated_at desc);
create index if not exists safety_cases_assigned_to_idx
  on public.safety_cases (assigned_to, status, updated_at desc);
create unique index if not exists safety_cases_source_unique_idx
  on public.safety_cases (source_type, source_id)
  where source_id is not null and source_type <> 'manual';

alter table public.safety_cases enable row level security;

-- No broad table policy. Reads and writes are exposed through authority-checked RPCs.

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
    case c.severity
      when 'critical' then 1
      when 'high' then 2
      when 'medium' then 3
      else 4
    end,
    c.updated_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 250);
$$;

create or replace function public.rawaj_safety_upsert_case(
  p_id uuid,
  p_source_type text,
  p_source_id text,
  p_subject_user_id uuid,
  p_title text,
  p_summary text,
  p_severity text,
  p_assigned_to uuid,
  p_expected_version bigint default null
)
returns table (id uuid, version bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_summary text := btrim(coalesce(p_summary, ''));
  v_source_id text := nullif(btrim(coalesce(p_source_id, '')), '');
  v_id uuid;
  v_version bigint;
  v_updated_at timestamptz;
begin
  if v_actor is null or not public.current_user_is_admin_like() then
    raise exception 'Safety case permission required.';
  end if;

  if p_source_type not in ('manual', 'listing_report', 'message_report', 'account') then
    raise exception 'Unsupported safety case source.';
  end if;

  if p_severity not in ('low', 'medium', 'high', 'critical') then
    raise exception 'Unsupported safety severity.';
  end if;

  if char_length(v_title) < 3 or char_length(v_title) > 180 then
    raise exception 'Safety case title must be between 3 and 180 characters.';
  end if;

  if char_length(v_summary) > 6000 then
    raise exception 'Safety case summary is too long.';
  end if;

  if p_assigned_to is not null and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_assigned_to and ur.role in ('owner', 'admin', 'moderator')
  ) then
    raise exception 'Safety case assignee must be authorized staff.';
  end if;

  if p_id is null then
    insert into public.safety_cases (
      source_type,
      source_id,
      subject_user_id,
      title,
      summary,
      severity,
      assigned_to,
      created_by,
      updated_by
    ) values (
      p_source_type,
      v_source_id,
      p_subject_user_id,
      v_title,
      v_summary,
      p_severity,
      p_assigned_to,
      v_actor,
      v_actor
    )
    returning safety_cases.id, safety_cases.version, safety_cases.updated_at
      into v_id, v_version, v_updated_at;
  else
    if p_expected_version is null then
      raise exception 'Expected version is required for safety case updates.';
    end if;

    update public.safety_cases
    set
      source_type = p_source_type,
      source_id = v_source_id,
      subject_user_id = p_subject_user_id,
      title = v_title,
      summary = v_summary,
      severity = p_severity,
      assigned_to = p_assigned_to,
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
  end if;

  perform public.rawaj_insert_audit_log(
    case when p_id is null then 'safety_case.created' else 'safety_case.updated' end,
    'safety_cases',
    v_id::text,
    jsonb_build_object(
      'source_type', p_source_type,
      'source_id', v_source_id,
      'subject_user_id', p_subject_user_id,
      'severity', p_severity,
      'assigned_to', p_assigned_to
    )
  );

  return query select v_id, v_version, v_updated_at;
end;
$$;

create or replace function public.rawaj_safety_set_case_status(
  p_id uuid,
  p_status text,
  p_expected_version bigint,
  p_reason text,
  p_resolution_note text default null
)
returns table (id uuid, version bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_resolution_note text := nullif(btrim(coalesce(p_resolution_note, '')), '');
  v_id uuid;
  v_version bigint;
  v_updated_at timestamptz;
begin
  if v_actor is null or not public.current_user_is_admin_like() then
    raise exception 'Safety case permission required.';
  end if;

  if p_status not in ('open', 'investigating', 'mitigated', 'closed') then
    raise exception 'Unsupported safety case status.';
  end if;

  if char_length(v_reason) < 3 then
    raise exception 'A clear status-change reason is required.';
  end if;

  if p_status = 'closed' and (v_resolution_note is null or char_length(v_resolution_note) < 3) then
    raise exception 'A resolution note is required to close a safety case.';
  end if;

  update public.safety_cases
  set
    status = p_status,
    resolution_note = case
      when p_status = 'closed' then v_resolution_note
      when v_resolution_note is not null then v_resolution_note
      else resolution_note
    end,
    closed_at = case when p_status = 'closed' then now() else null end,
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
    'safety_case.status_changed',
    'safety_cases',
    v_id::text,
    jsonb_build_object(
      'status', p_status,
      'reason', v_reason,
      'resolution_note', v_resolution_note
    )
  );

  return query select v_id, v_version, v_updated_at;
end;
$$;

revoke all on function public.rawaj_safety_list_cases(text, integer) from public;
revoke all on function public.rawaj_safety_list_cases(text, integer) from anon;
grant execute on function public.rawaj_safety_list_cases(text, integer) to authenticated;

revoke all on function public.rawaj_safety_upsert_case(uuid, text, text, uuid, text, text, text, uuid, bigint) from public;
revoke all on function public.rawaj_safety_upsert_case(uuid, text, text, uuid, text, text, text, uuid, bigint) from anon;
grant execute on function public.rawaj_safety_upsert_case(uuid, text, text, uuid, text, text, text, uuid, bigint) to authenticated;

revoke all on function public.rawaj_safety_set_case_status(uuid, text, bigint, text, text) from public;
revoke all on function public.rawaj_safety_set_case_status(uuid, text, bigint, text, text) from anon;
grant execute on function public.rawaj_safety_set_case_status(uuid, text, bigint, text, text) to authenticated;

comment on table public.safety_cases is
  'Audited RAWAJ safety cases with explicit source, severity, assignee, lifecycle, and stale-write protection.';
