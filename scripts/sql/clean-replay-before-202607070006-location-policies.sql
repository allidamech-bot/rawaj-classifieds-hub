\set ON_ERROR_STOP on

-- RAWAJ clean-replay compatibility hook before
-- 202607070006_location_search_regions.sql.
--
-- Earlier location migrations already create these policies. The historical
-- 202607070006 file creates them again without dropping them first, which only
-- succeeds in environments where the earlier setup was partially applied.
-- This disposable replay hook restores deterministic clean-install behavior
-- without rewriting an already-applied historical migration.

drop policy if exists location_search_aliases_admin_all
  on public.location_search_aliases;
drop policy if exists location_regions_admin_all
  on public.location_regions;
drop policy if exists location_region_members_admin_all
  on public.location_region_members;
