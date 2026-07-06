-- RAWAJ: Fix listings UPDATE for rejected->pending_review transitions
-- Manual review required. Do not apply automatically from frontend tooling.
--
-- Problem: Current "Listing owners edit unapproved own listings" policy WITH CHECK
-- blocks status transitions from rejection to pending_review.
--
-- Fix: Separate owner edit and owner submit policies to distinguish:
-- - draft/rejected edits (content changes only)
-- - draft/rejected->pending_review (submission/resubmission)

-- Helper: Check if owner can update listing content (draft or rejected rows only)
create or replace function public.rawaj_listing_owner_can_edit(target_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.listings l
    where l.id = target_listing_id
      and l.owner_id = auth.uid()
      and l.status in ('draft', 'rejected')
  );
$$;

comment on function public.rawaj_listing_owner_can_edit(uuid) is
  'Returns true if owner controls listing in draft or rejected status for edits.';

-- Drop the combined policy and replace with separated concerns
drop policy if exists "Listing owners edit unapproved own listings" on public.listings;

-- Owner can edit draft/rejected listings (content changes, status stays draft/rejected)
create policy "Listing owners edit draft rejected listings"
on public.listings for update
to authenticated
using (public.rawaj_listing_owner_can_edit(id))
with check (
  owner_id = auth.uid()
  and status in ('draft', 'rejected')
  and is_featured = false
  and featured_until is null
  and reviewed_by is null
  and reviewed_at is null
  and published_at is null
  and archived_at is null
);

-- Owner can submit draft/rejected listings to pending_review
-- This policy specifically allows the status transition while keeping content restrictions
create policy "Listing owners submit draft rejected to pending review"
on public.listings for update
to authenticated
using (public.rawaj_listing_owner_can_edit(id))
with check (
  owner_id = auth.uid()
  and status = 'pending_review'
  and is_featured = false
  and featured_until is null
  and reviewed_by is null
  and reviewed_at is null
  and published_at is null
  and archived_at is null
);