-- RAWAJ listing review staff activation repair.
-- A newly provisioned Admin/Moderator role must not be rendered powerless by a legacy pending_review profile state.

create or replace function public.rawaj_owner_assign_staff_role(
  p_user_id uuid,
  p_role public.rawaj_user_role,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.current_user_has_role('owner') then
    raise exception 'Owner permission required.';
  end if;

  if p_user_id is null or p_user_id = v_actor then
    raise exception 'Invalid staff target.';
  end if;

  if p_role not in ('admin', 'moderator') then
    raise exception 'Only admin or moderator staff roles may be provisioned here.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'Target profile does not exist.';
  end if;

  insert into public.user_roles (user_id, role, assigned_by, note)
  values (p_user_id, p_role, v_actor, nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (user_id, role) do update
    set assigned_by = excluded.assigned_by,
        assigned_at = now(),
        note = excluded.note;

  -- Only lift the legacy onboarding state. Never override frozen/disabled accounts.
  update public.profiles p
  set account_status = 'active', updated_at = now()
  where p.id = p_user_id
    and p.account_status = 'pending_review';

  perform public.rawaj_insert_audit_log(
    'staff.role_assigned',
    'user_roles',
    p_user_id::text,
    jsonb_build_object(
      'role', p_role,
      'note', nullif(btrim(coalesce(p_note, '')), ''),
      'pending_profile_activated', true
    )
  );
end;
$$;

revoke all on function public.rawaj_owner_assign_staff_role(uuid, public.rawaj_user_role, text) from public;
revoke all on function public.rawaj_owner_assign_staff_role(uuid, public.rawaj_user_role, text) from anon;
grant execute on function public.rawaj_owner_assign_staff_role(uuid, public.rawaj_user_role, text) to authenticated;

comment on function public.rawaj_owner_assign_staff_role(uuid, public.rawaj_user_role, text) is
  'Owner-only Admin/Moderator provisioning; activates only legacy pending_review profiles and preserves frozen/disabled states.';
