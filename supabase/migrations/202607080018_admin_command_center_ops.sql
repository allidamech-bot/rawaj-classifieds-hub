-- RAWAJ admin command center operations.
-- Protected operational metrics and audit-log reads for owner/admin workspaces.

create or replace function public.rawaj_admin_command_center_metrics()
returns table (
  total_users bigint,
  active_users bigint,
  frozen_users bigint,
  disabled_users bigint,
  pending_listings bigint,
  open_listing_reports bigint,
  open_message_reports bigint,
  pending_verifications bigint,
  pending_promotions bigint,
  active_restrictions bigint,
  admin_count bigint,
  moderator_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.profiles) as total_users,
    (select count(*) from public.profiles where account_status = 'active') as active_users,
    (select count(*) from public.profiles where account_status = 'frozen') as frozen_users,
    (select count(*) from public.profiles where account_status = 'disabled') as disabled_users,
    (select count(*) from public.listings where status = 'pending_review') as pending_listings,
    (
      select count(*)
      from public.listing_reports
      where status in ('new', 'under_review')
    ) as open_listing_reports,
    (
      select count(*)
      from public.message_reports
      where status in ('new', 'under_review')
    ) as open_message_reports,
    (
      select count(*)
      from public.seller_verification_requests
      where status = 'pending_review'
    ) as pending_verifications,
    (
      select count(*)
      from public.listing_promotion_requests
      where status = 'pending_review'
    ) as pending_promotions,
    (
      select count(*)
      from public.user_restrictions
      where lifted_at is null
        and (ends_at is null or ends_at > now())
    ) as active_restrictions,
    (
      select count(distinct user_id)
      from public.user_roles
      where role = 'admin'
    ) as admin_count,
    (
      select count(distinct user_id)
      from public.user_roles
      where role = 'moderator'
    ) as moderator_count
  where public.current_user_is_admin_like();
$$;

create or replace function public.rawaj_admin_fetch_audit_logs(
  p_limit integer default 50,
  p_offset integer default 0,
  p_action_prefix text default null
)
returns table (
  id uuid,
  actor_id uuid,
  actor_role public.rawaj_user_role,
  action text,
  target_table text,
  target_id text,
  metadata jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.actor_id,
    a.actor_role,
    a.action,
    a.target_table,
    a.target_id,
    a.metadata,
    a.created_at
  from public.audit_logs a
  where public.current_user_is_admin_like()
    and (
      p_action_prefix is null
      or btrim(p_action_prefix) = ''
      or a.action like btrim(p_action_prefix) || '%'
    )
  order by a.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.rawaj_admin_command_center_metrics() from public;
revoke all on function public.rawaj_admin_command_center_metrics() from anon;
grant execute on function public.rawaj_admin_command_center_metrics() to authenticated;

revoke all on function public.rawaj_admin_fetch_audit_logs(integer, integer, text) from public;
revoke all on function public.rawaj_admin_fetch_audit_logs(integer, integer, text) from anon;
grant execute on function public.rawaj_admin_fetch_audit_logs(integer, integer, text) to authenticated;

comment on function public.rawaj_admin_command_center_metrics() is
  'Protected RAWAJ operations snapshot for active owner/admin command-center views.';

comment on function public.rawaj_admin_fetch_audit_logs(integer, integer, text) is
  'Protected paginated audit-log feed for active owner/admin accounts.';
