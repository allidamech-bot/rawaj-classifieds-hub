-- RAWAJ safety case internal notes and multi-source linkage.

create table if not exists public.safety_case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.safety_cases(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  note text not null,
  created_at timestamptz not null default now(),
  check (char_length(btrim(note)) between 2 and 4000)
);

create table if not exists public.safety_case_links (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.safety_cases(id) on delete cascade,
  link_type text not null,
  link_id text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (link_type in ('listing_report', 'message_report', 'listing', 'account')),
  check (char_length(btrim(link_id)) between 1 and 200),
  unique (case_id, link_type, link_id)
);

create index if not exists safety_case_notes_case_idx
  on public.safety_case_notes (case_id, created_at desc);
create index if not exists safety_case_links_case_idx
  on public.safety_case_links (case_id, created_at desc);

alter table public.safety_case_notes enable row level security;
alter table public.safety_case_links enable row level security;

create or replace function public.rawaj_safety_add_case_note(
  p_case_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_note text := btrim(coalesce(p_note, ''));
  v_id uuid;
begin
  if v_actor is null or not public.current_user_is_admin_like() then
    raise exception 'Safety case permission required.';
  end if;

  if char_length(v_note) < 2 or char_length(v_note) > 4000 then
    raise exception 'Internal note must be between 2 and 4000 characters.';
  end if;

  if not exists (select 1 from public.safety_cases c where c.id = p_case_id) then
    raise exception 'Safety case does not exist.';
  end if;

  insert into public.safety_case_notes (case_id, author_id, note)
  values (p_case_id, v_actor, v_note)
  returning id into v_id;

  perform public.rawaj_insert_audit_log(
    'safety_case.note_added',
    'safety_cases',
    p_case_id::text,
    jsonb_build_object('note_id', v_id)
  );

  return v_id;
end;
$$;

create or replace function public.rawaj_safety_list_case_notes(p_case_id uuid)
returns table (
  id uuid,
  case_id uuid,
  author_id uuid,
  note text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.case_id, n.author_id, n.note, n.created_at
  from public.safety_case_notes n
  where n.case_id = p_case_id
    and public.current_user_is_admin_like()
  order by n.created_at desc
  limit 200;
$$;

create or replace function public.rawaj_safety_add_case_link(
  p_case_id uuid,
  p_link_type text,
  p_link_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_link_id text := btrim(coalesce(p_link_id, ''));
  v_id uuid;
begin
  if v_actor is null or not public.current_user_is_admin_like() then
    raise exception 'Safety case permission required.';
  end if;

  if p_link_type not in ('listing_report', 'message_report', 'listing', 'account') then
    raise exception 'Unsupported safety link type.';
  end if;

  if v_link_id = '' then
    raise exception 'Linked object identifier is required.';
  end if;

  if not exists (select 1 from public.safety_cases c where c.id = p_case_id) then
    raise exception 'Safety case does not exist.';
  end if;

  insert into public.safety_case_links (case_id, link_type, link_id, created_by)
  values (p_case_id, p_link_type, v_link_id, v_actor)
  on conflict (case_id, link_type, link_id)
  do update set link_id = excluded.link_id
  returning id into v_id;

  perform public.rawaj_insert_audit_log(
    'safety_case.link_added',
    'safety_cases',
    p_case_id::text,
    jsonb_build_object('link_type', p_link_type, 'link_id', v_link_id)
  );

  return v_id;
end;
$$;

create or replace function public.rawaj_safety_list_case_links(p_case_id uuid)
returns table (
  id uuid,
  case_id uuid,
  link_type text,
  link_id text,
  created_by uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.case_id, l.link_type, l.link_id, l.created_by, l.created_at
  from public.safety_case_links l
  where l.case_id = p_case_id
    and public.current_user_is_admin_like()
  order by l.created_at desc;
$$;

revoke all on function public.rawaj_safety_add_case_note(uuid, text) from public;
revoke all on function public.rawaj_safety_add_case_note(uuid, text) from anon;
grant execute on function public.rawaj_safety_add_case_note(uuid, text) to authenticated;

revoke all on function public.rawaj_safety_list_case_notes(uuid) from public;
revoke all on function public.rawaj_safety_list_case_notes(uuid) from anon;
grant execute on function public.rawaj_safety_list_case_notes(uuid) to authenticated;

revoke all on function public.rawaj_safety_add_case_link(uuid, text, text) from public;
revoke all on function public.rawaj_safety_add_case_link(uuid, text, text) from anon;
grant execute on function public.rawaj_safety_add_case_link(uuid, text, text) to authenticated;

revoke all on function public.rawaj_safety_list_case_links(uuid) from public;
revoke all on function public.rawaj_safety_list_case_links(uuid) from anon;
grant execute on function public.rawaj_safety_list_case_links(uuid) to authenticated;
