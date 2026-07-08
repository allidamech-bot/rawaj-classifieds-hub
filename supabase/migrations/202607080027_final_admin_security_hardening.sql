-- RAWAJ final admin security hardening.
-- Enforces operational freezes at the database boundary and tightens direct table grants.

create or replace function public.rawaj_enforce_write_control()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_specific_key text := case when tg_nargs > 0 then tg_argv[0] else null end;
begin
  if public.rawaj_system_control_enabled('emergency_read_only') then
    raise exception 'system_control_active:emergency_read_only';
  end if;

  if tg_op = 'INSERT'
    and v_specific_key is not null
    and public.rawaj_system_control_enabled(v_specific_key)
  then
    raise exception 'system_control_active:%', v_specific_key;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.rawaj_enforce_write_control() from public;
revoke all on function public.rawaj_enforce_write_control() from anon;
revoke all on function public.rawaj_enforce_write_control() from authenticated;

-- Create triggers only when the target table exists, keeping migration compatibility with staged environments.
do $$
begin
  if to_regclass('public.listings') is not null then
    execute 'drop trigger if exists rawaj_listings_system_control_guard on public.listings';
    execute $sql$
      create trigger rawaj_listings_system_control_guard
      before insert or update or delete on public.listings
      for each row execute function public.rawaj_enforce_write_control('freeze_new_listings')
    $sql$;
  end if;

  if to_regclass('public.conversation_messages') is not null then
    execute 'drop trigger if exists rawaj_messages_system_control_guard on public.conversation_messages';
    execute $sql$
      create trigger rawaj_messages_system_control_guard
      before insert or update or delete on public.conversation_messages
      for each row execute function public.rawaj_enforce_write_control('freeze_new_messages')
    $sql$;
  end if;

  if to_regclass('public.promotion_requests') is not null then
    execute 'drop trigger if exists rawaj_promotions_system_control_guard on public.promotion_requests';
    execute $sql$
      create trigger rawaj_promotions_system_control_guard
      before insert or update or delete on public.promotion_requests
      for each row execute function public.rawaj_enforce_write_control('freeze_promotions')
    $sql$;
  end if;

  if to_regclass('public.verification_requests') is not null then
    execute 'drop trigger if exists rawaj_verifications_system_control_guard on public.verification_requests';
    execute $sql$
      create trigger rawaj_verifications_system_control_guard
      before insert or update or delete on public.verification_requests
      for each row execute function public.rawaj_enforce_write_control('freeze_verifications')
    $sql$;
  end if;
end;
$$;

-- Sensitive operational tables are RPC-managed. Remove direct client mutation paths.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'owner_system_controls',
    'safety_cases',
    'safety_case_notes',
    'safety_case_links',
    'ad_placements',
    'ad_campaigns',
    'ad_campaign_creatives',
    'ad_campaign_events'
  ]
  loop
    if to_regclass('public.' || v_table) is not null then
      execute format('revoke all on table public.%I from anon', v_table);
      execute format('revoke insert, update, delete, truncate, references, trigger on table public.%I from authenticated', v_table);
    end if;
  end loop;
end;
$$;

-- Re-assert owner protection against account-state mutation at the database boundary.
create or replace function public.rawaj_assert_not_owner_target(p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.role = 'owner'
  ) then
    raise exception 'owner_protected';
  end if;
end;
$$;

revoke all on function public.rawaj_assert_not_owner_target(uuid) from public;
revoke all on function public.rawaj_assert_not_owner_target(uuid) from anon;
revoke all on function public.rawaj_assert_not_owner_target(uuid) from authenticated;

comment on function public.rawaj_enforce_write_control() is
  'Database-boundary enforcement for owner emergency read-only and scoped new-write freezes.';
comment on function public.rawaj_assert_not_owner_target(uuid) is
  'Reusable owner-target guard for sensitive account lifecycle operations.';
