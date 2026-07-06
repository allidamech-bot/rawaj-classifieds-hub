-- RAWAJ moderation field-protection hardening.
-- Manual review required. Do not apply automatically from frontend tooling.
--
-- This migration closes repository-confirmed gaps left by the historical
-- authorization reconciliation:
-- 1) ordinary listing owners could still reach moderation-controlled columns
--    through their legitimate owner UPDATE policy because the trigger returned
--    immediately for non-moderators;
-- 2) the 202607050002 reconciliation replaced the earlier listing trigger and
--    dropped the dedicated rawaj.promotion_moderation branch;
-- 3) owner-level moderation could bypass listing-report origin protection, and
--    the report trigger used a denylist instead of a narrow moderation allowlist.
--
-- No policy broadening is performed here. Existing RLS remains authoritative.

create or replace function public.rawaj_protect_listing_moderation_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Preserve the deliberately narrow internal promotion-moderation path.
  if current_setting('rawaj.promotion_moderation', true) = 'on' then
    if (to_jsonb(new) - array['is_featured', 'featured_until', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['is_featured', 'featured_until', 'updated_at'])
    then
      raise exception 'Promotion moderation can only change promotion fields on listings.';
    end if;

    return new;
  end if;

  -- Privileged moderation-only update. This check intentionally runs before
  -- ordinary owner self-edit so a privileged actor can moderate a listing they
  -- also own without being misclassified as a normal owner edit.
  if public.current_user_can_moderate()
     and (to_jsonb(new) - array[
           'status',
           'reviewed_by',
           'reviewed_at',
           'rejection_reason',
           'published_at',
           'archived_at',
           'updated_at'
         ])
         is not distinct from
         (to_jsonb(old) - array[
           'status',
           'reviewed_by',
           'reviewed_at',
           'rejection_reason',
           'published_at',
           'archived_at',
           'updated_at'
         ])
  then
    return new;
  end if;

  -- Ordinary owner-edit path. Existing RLS remains authoritative for row
  -- ownership, editable source states, and allowed destination status.
  if old.owner_id = auth.uid()
     and old.status in ('draft', 'pending_review', 'rejected')
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

  -- Privileged moderation roles cannot use the broad moderation RLS path to
  -- rewrite listing content or ownership.
  if public.current_user_can_moderate() then
    raise exception 'Moderators can only change moderation-safe fields on listings.';
  end if;

  -- No privilege is granted by this trigger; remaining attempts still require RLS.
  return new;
end;
$$;

drop trigger if exists listings_protect_moderation_update on public.listings;
create trigger listings_protect_moderation_update
before update on public.listings
for each row execute function public.rawaj_protect_listing_moderation_update();

create or replace function public.rawaj_protect_listing_report_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Every authorized moderation role, including owner/admin, is constrained to
  -- the explicit report-moderation column set. Any present or future column
  -- outside this allowlist remains immutable through this update path.
  if (to_jsonb(new) - array[
        'status',
        'assigned_to',
        'admin_note',
        'resolved_at',
        'updated_at'
      ])
     is distinct from
     (to_jsonb(old) - array[
        'status',
        'assigned_to',
        'admin_note',
        'resolved_at',
        'updated_at'
      ])
  then
    raise exception 'Moderators can only change moderation-safe fields on listing reports.';
  end if;

  return new;
end;
$$;

drop trigger if exists listing_reports_protect_update on public.listing_reports;
create trigger listing_reports_protect_update
before update on public.listing_reports
for each row execute function public.rawaj_protect_listing_report_update();
