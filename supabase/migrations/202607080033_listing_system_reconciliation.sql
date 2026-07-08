-- RAWAJ critical listing-system reconciliation.
-- One database contract for owner edits, submission, moderation, lifecycle actions and deletion.

-- 1) Keep exactly one canonical status constraint. Older migrations used two different names,
-- which allowed the legacy five-state constraint to survive and reject sold/rented/unavailable.
alter table public.listings drop constraint if exists listings_status_allowed;
alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings
  add constraint listings_status_check
  check (
    status in (
      'draft', 'pending_review', 'approved', 'rejected', 'archived',
      'expired', 'sold', 'rented', 'unavailable'
    )
  );

-- 2) Owners may edit only editable states. Rejected must remain rejected while content is edited;
-- moderation-controlled columns are still protected by rawaj_protect_listing_moderation_update().
drop policy if exists "Listing owners edit unapproved own listings" on public.listings;
create policy "Listing owners edit editable own listings"
on public.listings for update
to authenticated
using (
  owner_id = auth.uid()
  and status in ('draft', 'rejected')
)
with check (
  owner_id = auth.uid()
  and status in ('draft', 'rejected')
  and is_featured = false
  and featured_until is null
  and published_at is null
  and archived_at is null
);

-- 3) Align delete permission with the product UI contract.
drop policy if exists "Listing owners delete draft rejected listings" on public.listings;
drop policy if exists "Listing owners delete supported listings" on public.listings;
create policy "Listing owners delete supported listings"
on public.listings for delete
to authenticated
using (
  owner_id = auth.uid()
  and status in ('draft', 'pending_review', 'approved', 'rejected')
);

-- 4) Owner lifecycle transitions go through one explicit security-definer boundary.
create or replace function public.rawaj_owner_transition_listing(
  p_listing_id uuid,
  p_action text
)
returns setof public.listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_listing public.listings%rowtype;
  v_target text;
begin
  if v_actor is null then
    raise exception 'Authentication required.';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.account_status in ('frozen', 'disabled')
  ) then
    raise exception 'Account is not allowed to manage listings.';
  end if;

  select l.* into v_listing
  from public.listings l
  where l.id = p_listing_id and l.owner_id = v_actor
  for update;

  if v_listing.id is null then
    raise exception 'Listing does not exist or is not owned by current user.';
  end if;

  if p_action in ('sold', 'rented', 'unavailable') then
    if v_listing.status <> 'approved' then
      raise exception 'Only approved listings may be closed.';
    end if;
    v_target := p_action;
  elsif p_action = 'reactivate' then
    if v_listing.status not in ('sold', 'rented', 'unavailable', 'expired')
       and not (v_listing.status = 'approved' and v_listing.expires_at is not null and v_listing.expires_at <= now())
    then
      raise exception 'Listing cannot be reactivated from its current state.';
    end if;
    v_target := 'pending_review';
  else
    raise exception 'Unsupported listing lifecycle action.';
  end if;

  if v_target = 'pending_review' then
    if exists (
      select 1 from public.user_restrictions r
      where r.user_id = v_actor
        and r.restriction_type = 'posting'
        and r.lifted_at is null
        and (r.ends_at is null or r.ends_at > now())
    ) then
      raise exception 'Posting is restricted for this account.';
    end if;

    update public.listings l
    set status = 'pending_review',
        reviewed_by = null,
        reviewed_at = null,
        rejection_reason = null,
        published_at = null,
        archived_at = null,
        expires_at = null,
        updated_at = now()
    where l.id = p_listing_id;
  else
    update public.listings l
    set status = v_target,
        updated_at = now()
    where l.id = p_listing_id;
  end if;

  return query select l.* from public.listings l where l.id = p_listing_id;
end;
$$;

revoke all on function public.rawaj_owner_transition_listing(uuid, text) from public;
revoke all on function public.rawaj_owner_transition_listing(uuid, text) from anon;
grant execute on function public.rawaj_owner_transition_listing(uuid, text) to authenticated;

-- 5) Approved listing expiry changes are owner-only and no longer depend on widening table RLS.
create or replace function public.rawaj_owner_set_listing_expiry(
  p_listing_id uuid,
  p_expiry_days smallint
)
returns setof public.listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if p_expiry_days is not null and p_expiry_days not in (30, 60, 90) then
    raise exception 'Unsupported expiry duration.';
  end if;

  update public.listings l
  set expiry_days = p_expiry_days,
      expires_at = case
        when p_expiry_days is null then null
        else now() + make_interval(days => p_expiry_days)
      end,
      renewed_at = now(),
      updated_at = now()
  where l.id = p_listing_id
    and l.owner_id = v_actor
    and l.status = 'approved';

  if not found then
    raise exception 'Approved owned listing not found.';
  end if;

  return query select l.* from public.listings l where l.id = p_listing_id;
end;
$$;

revoke all on function public.rawaj_owner_set_listing_expiry(uuid, smallint) from public;
revoke all on function public.rawaj_owner_set_listing_expiry(uuid, smallint) from anon;
grant execute on function public.rawaj_owner_set_listing_expiry(uuid, smallint) to authenticated;

create or replace function public.rawaj_owner_confirm_listing_availability(p_listing_id uuid)
returns setof public.listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;

  update public.listings l
  set renewed_at = now(), updated_at = now()
  where l.id = p_listing_id
    and l.owner_id = v_actor
    and l.status = 'approved'
    and (l.expires_at is null or l.expires_at > now());

  if not found then
    raise exception 'Available approved owned listing not found.';
  end if;

  return query select l.* from public.listings l where l.id = p_listing_id;
end;
$$;

revoke all on function public.rawaj_owner_confirm_listing_availability(uuid) from public;
revoke all on function public.rawaj_owner_confirm_listing_availability(uuid) from anon;
grant execute on function public.rawaj_owner_confirm_listing_availability(uuid) to authenticated;

-- 6) Moderation decision remains atomic for the core status change, but optional history/audit/
-- notification side effects must never roll back a valid approve/reject decision.
create or replace function public.rawaj_review_listing_decision(
  p_listing_id uuid,
  p_decision text,
  p_reason text,
  p_expected_updated_at timestamptz
)
returns table (listing_id uuid, next_status text, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_owner_id uuid;
  v_title text;
  v_current_updated_at timestamptz;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_updated_at timestamptz;
begin
  if v_actor is null or not public.rawaj_current_user_can_review_listings() then
    raise exception 'Listing review permission required.';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Unsupported listing decision.';
  end if;
  if p_decision = 'rejected' and char_length(v_reason) < 3 then
    raise exception 'A clear rejection reason is required.';
  end if;

  select l.owner_id, l.title, l.updated_at
    into v_owner_id, v_title, v_current_updated_at
  from public.listings l
  where l.id = p_listing_id and l.status = 'pending_review'
  for update;

  if v_owner_id is null then raise exception 'Pending listing does not exist.'; end if;
  if p_expected_updated_at is null or v_current_updated_at <> p_expected_updated_at then
    raise exception 'stale_review';
  end if;

  update public.listings l
  set status = p_decision,
      reviewed_by = v_actor,
      reviewed_at = now(),
      rejection_reason = case when p_decision = 'rejected' then v_reason else null end,
      published_at = case when p_decision = 'approved' then now() else null end,
      archived_at = null,
      updated_at = now()
  where l.id = p_listing_id
  returning l.updated_at into v_updated_at;

  begin
    insert into public.listing_moderation_actions (
      listing_id, actor_id, action, previous_status, next_status,
      reason, expected_updated_at, metadata
    ) values (
      p_listing_id, v_actor,
      case when p_decision = 'approved' then 'approve' else 'reject' end,
      'pending_review', p_decision,
      case when p_decision = 'approved' then coalesce(nullif(v_reason, ''), 'Approved after review') else v_reason end,
      p_expected_updated_at,
      jsonb_build_object('source', 'pending_queue')
    );
  exception when others then null;
  end;

  begin
    perform public.rawaj_insert_audit_log(
      case when p_decision = 'approved' then 'listing.moderation.approve' else 'listing.moderation.reject' end,
      'listings', p_listing_id::text,
      jsonb_build_object('previous_status', 'pending_review', 'next_status', p_decision, 'reason', v_reason)
    );
  exception when others then null;
  end;

  begin
    perform public.rawaj_create_notification(
      v_owner_id,
      case when p_decision = 'approved' then 'listing.approved' else 'listing.rejected' end,
      case when p_decision = 'approved' then 'تمت الموافقة على إعلانك' else 'تم رفض إعلانك' end,
      case
        when p_decision = 'approved' then 'تمت الموافقة على إعلان "' || v_title || '" وأصبح ظاهراً للعامة.'
        else 'تم رفض إعلان "' || v_title || '". السبب: ' || v_reason
      end,
      'listing', p_listing_id::text,
      jsonb_build_object('listing_id', p_listing_id, 'status', p_decision)
    );
  exception when others then null;
  end;

  return query select p_listing_id, p_decision, v_updated_at;
end;
$$;

revoke all on function public.rawaj_review_listing_decision(uuid, text, text, timestamptz) from public;
revoke all on function public.rawaj_review_listing_decision(uuid, text, text, timestamptz) from anon;
grant execute on function public.rawaj_review_listing_decision(uuid, text, text, timestamptz) to authenticated;

comment on function public.rawaj_owner_transition_listing(uuid, text) is
  'Owner-only sold/rented/unavailable/reactivate lifecycle boundary.';
comment on function public.rawaj_owner_set_listing_expiry(uuid, smallint) is
  'Owner-only approved listing expiry update boundary.';
