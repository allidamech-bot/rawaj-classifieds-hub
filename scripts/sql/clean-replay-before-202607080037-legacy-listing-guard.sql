\set ON_ERROR_STOP on

-- RAWAJ clean-replay compatibility hook before
-- 202607080037_remove_legacy_listing_write_trigger.sql.
--
-- The superseded classifieds foundation originally installed this trigger
-- function. The reconciliation migration removes its trigger but intentionally
-- retains and documents the function. Recreate the historical function without
-- recreating the obsolete trigger so the reconciliation remains deterministic.

create or replace function public.rawaj_protect_listing_user_writes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  is_admin boolean;
begin
  is_admin := public.rawaj_is_owner_or_admin();

  if is_admin then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication is required to write listings.';
  end if;

  if tg_op = 'INSERT' then
    if new.owner_id is distinct from auth.uid() then
      raise exception 'Listings must be owned by the authenticated user.';
    end if;

    if new.status not in ('draft', 'pending_review') then
      raise exception 'Normal users cannot approve or moderate listings.';
    end if;

    if new.is_featured is distinct from false
      or new.featured_until is not null
      or new.reviewed_by is not null
      or new.reviewed_at is not null
      or new.rejection_reason is not null
      or new.published_at is not null
      or new.archived_at is not null then
      raise exception 'Normal users cannot set listing moderation fields.';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.owner_id is distinct from new.owner_id then
      raise exception 'Normal users cannot change listing ownership.';
    end if;

    if new.status not in ('draft', 'pending_review') then
      raise exception 'Normal users cannot approve, archive, expire, or reject listings.';
    end if;

    if new.is_featured is distinct from old.is_featured
      or new.featured_until is distinct from old.featured_until
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at
      or new.published_at is distinct from old.published_at
      or new.archived_at is distinct from old.archived_at then
      raise exception 'Normal users cannot change listing moderation fields.';
    end if;

    if old.status = 'rejected' and new.status in ('draft', 'pending_review') then
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.rejection_reason := null;
    elsif new.rejection_reason is distinct from old.rejection_reason then
      raise exception 'Normal users cannot change rejection notes.';
    end if;

    return new;
  end if;

  return new;
end;
$$;

revoke all on function public.rawaj_protect_listing_user_writes()
  from public, anon, authenticated;
