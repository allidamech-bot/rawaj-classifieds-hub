-- RAWAJ moderation trigger reconciliation.
-- Approval can legitimately change expires_at through the approval-expiry trigger.
-- Keep content fields protected while allowing the complete moderation-owned transition set.

create or replace function public.rawaj_protect_listing_moderation_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.rawaj_current_user_can_review_listings()
     and (to_jsonb(new) - array[
           'status','reviewed_by','reviewed_at','rejection_reason',
           'published_at','archived_at','updated_at','status_changed_at',
           'expires_at'
         ])
         is not distinct from
         (to_jsonb(old) - array[
           'status','reviewed_by','reviewed_at','rejection_reason',
           'published_at','archived_at','updated_at','status_changed_at',
           'expires_at'
         ])
  then
    return new;
  end if;

  if old.owner_id = auth.uid()
     and old.status in ('draft', 'rejected')
     and new.status = 'pending_review'
     and new.owner_id is not distinct from old.owner_id
     and new.is_featured is not distinct from old.is_featured
     and new.featured_until is not distinct from old.featured_until
     and new.reviewed_by is null
     and new.reviewed_at is null
     and new.rejection_reason is null
     and new.published_at is null
     and new.archived_at is null
  then
    return new;
  end if;

  if old.owner_id = auth.uid()
     and old.status in ('draft', 'rejected')
  then
    if new.owner_id is distinct from old.owner_id
      or new.is_featured is distinct from old.is_featured
      or new.featured_until is distinct from old.featured_until
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at
      or new.rejection_reason is distinct from old.rejection_reason
      or new.published_at is distinct from old.published_at
      or new.archived_at is distinct from old.archived_at
    then
      raise exception 'Listing owners cannot change moderation-controlled fields.';
    end if;
    return new;
  end if;

  if public.rawaj_current_user_can_review_listings() then
    raise exception 'Review staff can only change moderation-safe fields on listings.';
  end if;

  return new;
end;
$$;

comment on function public.rawaj_protect_listing_moderation_update() is
  'Protects listing content during staff moderation while allowing status/review/publication/approval-expiry fields.';
