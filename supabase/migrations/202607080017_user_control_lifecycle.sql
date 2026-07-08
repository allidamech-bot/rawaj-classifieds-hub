-- RAWAJ user control lifecycle.
-- Adds auditable suspension, ban, restore, and granular restriction controls.

create table if not exists public.user_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  restriction_type text not null,
  reason text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  lifted_at timestamptz,
  lifted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (restriction_type in ('posting', 'messaging', 'reviews', 'promotions', 'uploads')),
  check (char_length(btrim(reason)) between 3 and 1200),
  check (ends_at is null or ends_at > starts_at)
);

create unique index if not exists user_restrictions_active_unique_idx
  on public.user_restrictions (user_id, restriction_type)
  where lifted_at is null;

create index if not exists user_restrictions_user_active_idx
  on public.user_restrictions (user_id, starts_at desc)
  where lifted_at is null;

alter table public.user_restrictions enable row level security;

drop policy if exists "user_restrictions_select_own_or_admin" on public.user_restrictions;
create policy "user_restrictions_select_own_or_admin"
on public.user_restrictions
for select
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin_like());

create or replace function public.rawaj_admin_fetch_users()
returns table (
  id uuid,
  email text,
  display_name text,
  account_status public.rawaj_account_status,
  verification_status public.rawaj_verification_status,
  created_at timestamptz,
  roles public.rawaj_user_role[],
  listing_count bigint,
  reports_submitted bigint,
  reports_received bigint,
  active_restrictions text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.email,
    p.display_name,
    p.account_status,
    p.verification_status,
    p.created_at,
    coalesce(
      array_agg(distinct ur.role) filter (where ur.role is not null),
      array[]::public.rawaj_user_role[]
    ) as roles,
    (select count(*) from public.listings l where l.owner_id = p.id) as listing_count,
    (select count(*) from public.listing_reports lr where lr.reporter_id = p.id) as reports_submitted,
    (
      select count(*)
      from public.listing_reports lr
      join public.listings l on l.id = lr.listing_id
      where l.owner_id = p.id
    ) as reports_received,
    coalesce(
      (
        select array_agg(r.restriction_type order by r.restriction_type)
        from public.user_restrictions r
        where r.user_id = p.id
          and r.lifted_at is null
          and (r.ends_at is null or r.ends_at > now())
      ),
      array[]::text[]
    ) as active_restrictions
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.id
  where public.current_user_is_admin_like()
  group by p.id, p.email, p.display_name, p.account_status, p.verification_status, p.created_at
  order by p.created_at desc;
$$;

create or replace function public.rawaj_manage_user_account(
  p_user_id uuid,
  p_status public.rawaj_account_status,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_is_owner boolean := public.current_user_has_role('owner');
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_actor is null or not public.current_user_is_admin_like() then
    raise exception 'Admin permission required.';
  end if;

  if char_length(v_reason) < 3 then
    raise exception 'A clear reason is required.';
  end if;

  if p_user_id is null or p_user_id = v_actor then
    raise exception 'Invalid account target.';
  end if;

  if exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_user_id and ur.role = 'owner'
  ) then
    raise exception 'The owner account cannot be managed by this action.';
  end if;

  if not v_actor_is_owner and exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_user_id and ur.role in ('admin', 'moderator')
  ) then
    raise exception 'Only the owner can manage staff accounts.';
  end if;

  if p_status = 'disabled' and not v_actor_is_owner then
    raise exception 'Only the owner can fully disable an account.';
  end if;

  update public.profiles
  set account_status = p_status
  where id = p_user_id;

  if not found then
    raise exception 'Target profile does not exist.';
  end if;

  perform public.rawaj_insert_audit_log(
    case p_status
      when 'active' then 'user.restored'
      when 'frozen' then 'user.suspended'
      when 'disabled' then 'user.banned'
      else 'user.status_changed'
    end,
    'profiles',
    p_user_id::text,
    jsonb_build_object('status', p_status, 'reason', v_reason)
  );
end;
$$;

create or replace function public.rawaj_set_user_restriction(
  p_user_id uuid,
  p_restriction_type text,
  p_reason text,
  p_ends_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_is_owner boolean := public.current_user_has_role('owner');
  v_reason text := btrim(coalesce(p_reason, ''));
  v_id uuid;
begin
  if v_actor is null or not public.current_user_is_admin_like() then
    raise exception 'Admin permission required.';
  end if;

  if p_restriction_type not in ('posting', 'messaging', 'reviews', 'promotions', 'uploads') then
    raise exception 'Invalid restriction type.';
  end if;

  if char_length(v_reason) < 3 then
    raise exception 'A clear reason is required.';
  end if;

  if p_user_id is null or p_user_id = v_actor then
    raise exception 'Invalid restriction target.';
  end if;

  if exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_user_id and ur.role = 'owner'
  ) then
    raise exception 'The owner account cannot be restricted.';
  end if;

  if not v_actor_is_owner and exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_user_id and ur.role in ('admin', 'moderator')
  ) then
    raise exception 'Only the owner can restrict staff accounts.';
  end if;

  if p_ends_at is not null and p_ends_at <= now() then
    raise exception 'Restriction end time must be in the future.';
  end if;

  insert into public.user_restrictions (
    user_id,
    restriction_type,
    reason,
    ends_at,
    created_by
  ) values (
    p_user_id,
    p_restriction_type,
    v_reason,
    p_ends_at,
    v_actor
  )
  on conflict (user_id, restriction_type) where lifted_at is null
  do update set
    reason = excluded.reason,
    starts_at = now(),
    ends_at = excluded.ends_at,
    created_by = excluded.created_by
  returning id into v_id;

  perform public.rawaj_insert_audit_log(
    'user.restriction_set',
    'user_restrictions',
    v_id::text,
    jsonb_build_object(
      'user_id', p_user_id,
      'restriction_type', p_restriction_type,
      'reason', v_reason,
      'ends_at', p_ends_at
    )
  );

  return v_id;
end;
$$;

create or replace function public.rawaj_lift_user_restriction(
  p_user_id uuid,
  p_restriction_type text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_id uuid;
begin
  if v_actor is null or not public.current_user_is_admin_like() then
    raise exception 'Admin permission required.';
  end if;

  if char_length(v_reason) < 3 then
    raise exception 'A clear reason is required.';
  end if;

  update public.user_restrictions
  set lifted_at = now(), lifted_by = v_actor
  where user_id = p_user_id
    and restriction_type = p_restriction_type
    and lifted_at is null
  returning id into v_id;

  if v_id is null then
    return;
  end if;

  perform public.rawaj_insert_audit_log(
    'user.restriction_lifted',
    'user_restrictions',
    v_id::text,
    jsonb_build_object(
      'user_id', p_user_id,
      'restriction_type', p_restriction_type,
      'reason', v_reason
    )
  );
end;
$$;

revoke all on function public.rawaj_admin_fetch_users() from public;
revoke all on function public.rawaj_admin_fetch_users() from anon;
grant execute on function public.rawaj_admin_fetch_users() to authenticated;

revoke all on function public.rawaj_manage_user_account(uuid, public.rawaj_account_status, text) from public;
revoke all on function public.rawaj_manage_user_account(uuid, public.rawaj_account_status, text) from anon;
grant execute on function public.rawaj_manage_user_account(uuid, public.rawaj_account_status, text) to authenticated;

revoke all on function public.rawaj_set_user_restriction(uuid, text, text, timestamptz) from public;
revoke all on function public.rawaj_set_user_restriction(uuid, text, text, timestamptz) from anon;
grant execute on function public.rawaj_set_user_restriction(uuid, text, text, timestamptz) to authenticated;

revoke all on function public.rawaj_lift_user_restriction(uuid, text, text) from public;
revoke all on function public.rawaj_lift_user_restriction(uuid, text, text) from anon;
grant execute on function public.rawaj_lift_user_restriction(uuid, text, text) to authenticated;
