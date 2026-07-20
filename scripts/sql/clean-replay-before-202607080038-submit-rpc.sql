\set ON_ERROR_STOP on

-- RAWAJ clean-replay compatibility hook before
-- 202607080038_listing_submit_edit_rpc_repair.sql.
--
-- The repair migration replaces the earlier submit RPC with a SETOF listings
-- contract. PostgreSQL requires dropping the old signature before changing the
-- return type; the migration immediately recreates the final guarded function
-- and restores authenticated execution.

drop function if exists public.rawaj_submit_listing_for_review(uuid);
