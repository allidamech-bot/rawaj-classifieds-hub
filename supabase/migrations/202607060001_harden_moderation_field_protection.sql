-- RAWAJ moderation field-protection hardening.
-- Manual review required. Do not apply automatically from frontend tooling.
--
-- This migration closes two repository-confirmed gaps left by the historical
-- authorization reconciliation:
-- 1) ordinary listing owners could still reach moderation-controlled columns
--    through their legitimate owner UPDATE policy because the trigger returned
--    immediately for non-moderators;
-- 2) the 202607050002 reconciliation replaced the earlier listing trigger and
--    dropped the dedicated rawaj.promotion_moderation branch.
--
-- No policy broadening is performed here. Existing RLS remains authoritative.

create or replace function public.rawaj_protect_listing_moderation_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Promotion moderation is a deliberately narrow internal path. Preserve it
  -- explicitly and reject any unrelated column mutation in that context.
  if current_setting('rawaj.promotion_moderation', true) = 'on' then
    if (to_jsonb(new) - array['is_featured', 'featured_until', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['is_featured', 'featured_until', 'updated_at'])
    then
      raise exception 'Promotion moderation can only change promotion fields on listings.';
    end if;

    return new;
  end if;

  -- A listing owner may legitimately edit an unapproved listing through the
  -- existing owner UPDATE policy, including draft/rejected -> pending_review
  -- workflow transitions. Moderation/system columns remain immutable to that
  -- owner path regardless of frontend behavior.
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

  -- All privileged moderation roles, including owner/admin/moderator, are
  -- constrained to the moderation-safe column set on the moderation path.
  if public.current_user_can_moderate() then
    if (to_jsonb(new) - array[
          'status',
          'reviewed_by',
          'reviewed_at',
          'rejection_reason',
          'published_at',
          'archived_at',
          'updated_at'
        ])
       is distinct from
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
      raise exception 'Moderators can only change moderation-safe fields on listings.';
    end if;

    return new;
  end if;

  -- No additional privilege is granted by this trigger. Any remaining UPDATE
  -- attempt still has to satisfy RLS; return NEW so RLS remains the authority.
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
  -- Report origin/evidence fields are immutable on every moderation path,
  -- including owner/admin. RLS decides who may update; this trigger decides
  -- which columns an authorized updater may change.
  if new.reporter_id is distinct from old.reporter_id
    or new.report_type is distinct from old.report_type
    or new.reason is distinct from old.reason
    or new.listing_id is distinct from old.listing_id
    or new.created_at is distinct from old.created_at
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
