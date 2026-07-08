-- RAWAJ critical listing pipeline repair.
-- Closes customer submit -> pending queue -> staff decision -> public visibility.

-- The sole owner must not lose all effective UI permissions because an old profile row
-- remained in pending_review. Role remains authoritative and the owner account is activated.
update public.profiles p
set account_status = 'active', updated_at = now()
where lower(coalesce(p.email, '')) = 'allidamech@gmail.com'
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = p.id and ur.role = 'owner'
  );

-- Staff review authority includes Owner, Admin, and Moderator exactly.
create or replace function public.rawaj_current_user_can_review_listings()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.role in ('owner', 'admin', 'moderator')
      and p.account_status = 'active'
  );
$$;

revoke all on function public.rawaj_current_user_can_review_listings() from public;
revoke all on function public.rawaj_current_user_can_review_listings() from anon;
grant execute on function public.rawaj_current_user_can_review_listings() to authenticated;

-- Allow one narrow owner transition: draft/rejected -> pending_review.
-- This is needed because earlier moderation-field protection correctly blocked owners
-- from clearing rejected review metadata, but also accidentally blocked legitimate resubmit.
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
           'published_at','archived_at','updated_at'
         ])
         is not distinct from
         (to_jsonb(old) - array[
           'status','reviewed_by','reviewed_at','rejection_reason',
           'published_at','archived_at','updated_at'
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

  if public.rawaj_current_user_can_review_listings() then
    raise exception 'Review staff can only change moderation-safe fields on listings.';
  end if;

  return new;
end;
$$;

-- Customer-controlled submit/resubmit RPC. It validates ownership, account state,
-- posting restrictions, required listing information, and allowed source status.
create or replace function public.rawaj_submit_listing_for_review(p_listing_id uuid)
returns table (
  id uuid,
  owner_id uuid,
  category_id text,
  subcategory_id text,
  governorate_id text,
  title text,
  description text,
  price numeric,
  currency text,
  price_type text,
  listing_condition text,
  status text,
  district_ar text,
  contact_name text,
  contact_options jsonb,
  details jsonb,
  is_featured boolean,
  featured_until timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_listing public.listings%rowtype;
begin
  if v_actor is null then
    raise exception 'Authentication required.';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.account_status in ('frozen', 'disabled')
  ) then
    raise exception 'Account is not allowed to publish.';
  end if;

  if exists (
    select 1 from public.user_restrictions r
    where r.user_id = v_actor
      and r.restriction_type = 'posting'
      and r.lifted_at is null
      and (r.ends_at is null or r.ends_at > now())
  ) then
    raise exception 'Posting is restricted for this account.';
  end if;

  select l.* into v_listing
  from public.listings l
  where l.id = p_listing_id
    and l.owner_id = v_actor
  for update;

  if v_listing.id is null then
    raise exception 'Listing does not exist or is not owned by current user.';
  end if;

  if v_listing.status not in ('draft', 'rejected') then
    raise exception 'Only draft or rejected listings may be submitted for review.';
  end if;

  if v_listing.category_id is null
    or v_listing.governorate_id is null
    or char_length(btrim(coalesce(v_listing.title, ''))) < 4
  then
    raise exception 'Listing category, governorate, and title are required.';
  end if;

  update public.listings l
  set
    status = 'pending_review',
    reviewed_by = null,
    reviewed_at = null,
    rejection_reason = null,
    published_at = null,
    archived_at = null,
    updated_at = now()
  where l.id = p_listing_id;

  return query
  select
    l.id, l.owner_id, l.category_id, l.subcategory_id, l.governorate_id,
    l.title, l.description, l.price, l.currency, l.price_type,
    l.listing_condition, l.status, l.district_ar, l.contact_name,
    l.contact_options, l.details, l.is_featured, l.featured_until,
    l.reviewed_by, l.reviewed_at, l.rejection_reason, l.published_at,
    l.archived_at, l.created_at, l.updated_at
  from public.listings l
  where l.id = p_listing_id;
end;
$$;

revoke all on function public.rawaj_submit_listing_for_review(uuid) from public;
revoke all on function public.rawaj_submit_listing_for_review(uuid) from anon;
grant execute on function public.rawaj_submit_listing_for_review(uuid) to authenticated;

-- Review queue bypasses fragile direct-table RLS reads but re-checks exact staff authority.
create or replace function public.rawaj_review_queue_pending()
returns setof public.listings
language sql
stable
security definer
set search_path = public
as $$
  select l.*
  from public.listings l
  where public.rawaj_current_user_can_review_listings()
    and l.status = 'pending_review'
  order by l.created_at asc, l.id asc;
$$;

revoke all on function public.rawaj_review_queue_pending() from public;
revoke all on function public.rawaj_review_queue_pending() from anon;
grant execute on function public.rawaj_review_queue_pending() to authenticated;

-- Minimal review decision RPC for the high-traffic pending queue.
-- It does not depend on optional expiry lifecycle columns.
create or replace function public.rawaj_review_listing_decision(
  p_listing_id uuid,
  p_decision text,
  p_reason text,
  p_expected_updated_at timestamptz
)
returns table (
  listing_id uuid,
  next_status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_owner_id uuid;
  v_title text;
  v_current_updated_at timestamptz;
  v_next text;
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
  where l.id = p_listing_id
    and l.status = 'pending_review'
  for update;

  if v_owner_id is null then
    raise exception 'Pending listing does not exist.';
  end if;

  if p_expected_updated_at is null or v_current_updated_at <> p_expected_updated_at then
    raise exception 'stale_review';
  end if;

  v_next := p_decision;

  update public.listings l
  set
    status = v_next,
    reviewed_by = v_actor,
    reviewed_at = now(),
    rejection_reason = case when v_next = 'rejected' then v_reason else null end,
    published_at = case when v_next = 'approved' then now() else null end,
    archived_at = null,
    updated_at = now()
  where l.id = p_listing_id
  returning l.updated_at into v_updated_at;

  insert into public.listing_moderation_actions (
    listing_id, actor_id, action, previous_status, next_status,
    reason, expected_updated_at, metadata
  ) values (
    p_listing_id,
    v_actor,
    case when v_next = 'approved' then 'approve' else 'reject' end,
    'pending_review',
    v_next,
    case when v_next = 'approved' then coalesce(nullif(v_reason, ''), 'Approved after review') else v_reason end,
    p_expected_updated_at,
    jsonb_build_object('source', 'pending_queue')
  );

  perform public.rawaj_insert_audit_log(
    case when v_next = 'approved' then 'listing.moderation.approve' else 'listing.moderation.reject' end,
    'listings',
    p_listing_id::text,
    jsonb_build_object('previous_status', 'pending_review', 'next_status', v_next, 'reason', v_reason)
  );

  perform public.rawaj_create_notification(
    v_owner_id,
    case when v_next = 'approved' then 'listing.approved' else 'listing.rejected' end,
    case when v_next = 'approved' then 'تمت الموافقة على إعلانك' else 'تم رفض إعلانك' end,
    case
      when v_next = 'approved' then 'تمت الموافقة على إعلان "' || v_title || '" وأصبح ظاهراً للعامة.'
      else 'تم رفض إعلان "' || v_title || '". السبب: ' || v_reason
    end,
    'listing',
    p_listing_id::text,
    jsonb_build_object('listing_id', p_listing_id, 'status', v_next)
  );

  return query select p_listing_id, v_next, v_updated_at;
end;
$$;

revoke all on function public.rawaj_review_listing_decision(uuid, text, text, timestamptz) from public;
revoke all on function public.rawaj_review_listing_decision(uuid, text, text, timestamptz) from anon;
grant execute on function public.rawaj_review_listing_decision(uuid, text, text, timestamptz) to authenticated;

-- Reconcile RLS with the explicit review role model.
drop policy if exists "Admin-like reads all listings" on public.listings;
create policy "Review staff read all listings"
on public.listings for select
to authenticated
using (public.rawaj_current_user_can_review_listings());

drop policy if exists "Admin-like moderates listings" on public.listings;
create policy "Review staff moderate listings"
on public.listings for update
to authenticated
using (public.rawaj_current_user_can_review_listings())
with check (public.rawaj_current_user_can_review_listings());

-- Public visibility remains strictly approved and non-archived.
drop policy if exists "Public reads approved listings" on public.listings;
create policy "Public reads approved listings"
on public.listings for select
using (status = 'approved' and archived_at is null);

comment on function public.rawaj_submit_listing_for_review(uuid) is
  'Owner submit/resubmit path for draft or rejected listings with account and posting checks.';
comment on function public.rawaj_review_queue_pending() is
  'Authorized Owner/Admin/Moderator pending listing queue.';
comment on function public.rawaj_review_listing_decision(uuid, text, text, timestamptz) is
  'Stale-safe audited approve/reject decision path for pending listings.';
