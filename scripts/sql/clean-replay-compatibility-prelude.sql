\set ON_ERROR_STOP on

-- RAWAJ clean-replay compatibility prelude.
--
-- Historical Production setup included this helper before the repository's
-- location-taxonomy migrations were recorded. The repository must not rewrite
-- already-applied migration files, so the disposable clean-replay environment
-- recreates the missing prerequisite explicitly and audits it as a compatibility
-- shim. Later canonical migrations remain free to replace or narrow it.

create or replace function public.rawaj_is_owner_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_is_admin_like();
$$;

revoke all on function public.rawaj_is_owner_or_admin() from public, anon;
grant execute on function public.rawaj_is_owner_or_admin() to authenticated;

comment on function public.rawaj_is_owner_or_admin() is
  'Clean-replay compatibility alias for historical location policies; delegates to the canonical active owner/admin role check.';
