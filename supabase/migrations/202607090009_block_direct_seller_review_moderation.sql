-- RAWAJ seller-review moderation path exclusivity.
--
-- Make the stale-safe SECURITY DEFINER RPC introduced in 202607090008 the
-- only supported moderation write path. Existing rows are not rewritten.

-- Remove the pre-existing authenticated direct UPDATE path. The canonical
-- rawaj_admin_moderate_seller_review(...) RPC remains executable by
-- authenticated callers and performs its own moderation authority check.
drop policy if exists "seller_reviews_admin_update" on public.seller_reviews;
