-- RAWAJ listing transition authority hardening.
-- Forces staff moderation through audited RPCs and enforces customer submission restrictions
-- even when an older client attempts a direct draft -> pending_review update.

create or replace function public.rawaj_enforce_listing_submission_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_submission boolean;
begin
  v_is_submission := new.status = 'pending_review'
    and (tg_op = 'INSERT' or old.status is distinct from new.status);

  if not v_is_submission then
    return new;
  end if;

  if v_actor is null then
    raise exception 'Authentication required for listing submission.';
  end if;

  -- Review staff may perform controlled operational transitions through security-definer RPCs.
  -- Customer submissions must always belong to the current user.
  if new.owner_id <> v_actor and not public.rawaj_current_user_can_review_listings() then
    raise exception 'Listing submission owner mismatch.';
  end if;

  if new.owner_id = v_actor then
    if exists (
      select 1
      from public.profiles p
      where p.id = v_actor
        and p.account_status in ('frozen', 'disabled')
    ) then
      raise exception 'Account is not allowed to publish.';
    end if;

    if exists (
      select 1
      from public.user_restrictions r
      where r.user_id = v_actor
        and r.restriction_type = 'posting'
        and r.lifted_at is null
        and (r.ends_at is null or r.ends_at > now())
    ) then
      raise exception 'Posting is restricted for this account.';
    end if;
  end if;

  if new.category_id is null
    or new.governorate_id is null
    or char_length(btrim(coalesce(new.title, ''))) < 4
  then
    raise exception 'Listing category, governorate, and title are required.';
  end if;

  return new;
end;
$$;

drop trigger if exists listings_enforce_submission_transition on public.listings;
create trigger listings_enforce_submission_transition
before insert or update on public.listings
for each row execute function public.rawaj_enforce_listing_submission_transition();

-- Staff decisions must go through security-definer moderation RPCs so reasons,
-- stale-version checks, history, and audit logs cannot be bypassed with direct table updates.
drop policy if exists "Review staff moderate listings" on public.listings;
drop policy if exists "Privileged moderators update listing moderation" on public.listings;
drop policy if exists "Admin-like moderates listings" on public.listings;
drop policy if exists "Owner admins moderate listings" on public.listings;

revoke all on function public.rawaj_enforce_listing_submission_transition() from public;
revoke all on function public.rawaj_enforce_listing_submission_transition() from anon;
revoke all on function public.rawaj_enforce_listing_submission_transition() from authenticated;

comment on function public.rawaj_enforce_listing_submission_transition() is
  'Database-boundary guard for draft/rejected/direct insert transitions into pending_review, including account and posting restrictions.';
