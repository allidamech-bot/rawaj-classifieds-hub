-- RAWAJ existing review staff status reconciliation.
-- Only lifts the legacy pending_review profile state for already-provisioned staff.
-- Frozen/disabled accounts remain untouched.

update public.profiles p
set account_status = 'active', updated_at = now()
where p.account_status = 'pending_review'
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p.id
      and ur.role in ('owner', 'admin', 'moderator')
  );

comment on function public.rawaj_current_user_can_review_listings() is
  'Returns true only for active Owner/Admin/Moderator staff authorized to review listings.';
