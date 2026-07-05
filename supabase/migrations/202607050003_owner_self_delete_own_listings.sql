-- RAWAJ owner self-delete listing policy.
-- Manual review required. Do not apply automatically from frontend tooling.
--
-- Context:
--   Migration 202607050002 restricted listings DELETE to current_user_can_manage_roles()
--   (platform owner role only). This means authenticated normal users cannot delete
--   their own listings or images despite the deleteOwnerListing API function existing.
--
-- Fix:
--   Add narrow companion policies that allow an authenticated user to hard-delete
--   only rows they own (owner_id = auth.uid()), restricted to the statuses the
--   application layer also checks (draft, pending_review, approved, rejected).
--   The existing platform-owner policy is preserved unchanged.
--
-- Security properties:
--   - auth.uid() is resolved server-side by Supabase; client cannot spoof it.
--   - owner_id = auth.uid() ensures a user can only delete their own row.
--   - status restriction prevents deleting archived/expired rows from this path.
--   - Platform-owner catch-all policy remains for administrative hard deletes.
--   - listing_images policy mirrors the table-level restriction: owner may only
--     delete images for listings they own, regardless of status.

-- Listings: allow authenticated owner to self-delete their own non-terminal listings.
drop policy if exists "Listing owners self-delete own listings" on public.listings;
create policy "Listing owners self-delete own listings"
on public.listings for delete
to authenticated
using (
  owner_id = auth.uid()
  and status in ('draft', 'pending_review', 'approved', 'rejected')
);

-- Listing images: allow authenticated owner to delete images on their own listings.
-- Storage object cleanup is handled client-side by deleteOwnerListing before this fires.
drop policy if exists "Listing owners self-delete own listing images" on public.listing_images;
create policy "Listing owners self-delete own listing images"
on public.listing_images for delete
to authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_id
      and l.owner_id = auth.uid()
      and l.status in ('draft', 'pending_review', 'approved', 'rejected')
  )
);
