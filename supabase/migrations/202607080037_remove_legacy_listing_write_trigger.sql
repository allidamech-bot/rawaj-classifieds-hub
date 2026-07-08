-- RAWAJ legacy listing-write trigger reconciliation.
-- The original 202606290002 trigger predates rejected-edit, owner lifecycle RPCs,
-- and the dedicated moderation protection trigger. It rejects any normal-user UPDATE
-- whose resulting status remains rejected, which makes legitimate rejected edits fail.
-- Current protection is provided by RLS, submission-transition guard, and
-- rawaj_protect_listing_moderation_update().

drop trigger if exists listings_protect_user_writes on public.listings;

comment on function public.rawaj_protect_listing_user_writes() is
  'Legacy compatibility function retained without a trigger; superseded by explicit listing RLS and lifecycle/moderation guards.';
