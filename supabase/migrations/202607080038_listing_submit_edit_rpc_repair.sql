-- RAWAJ critical production repair: self-contained edit + submit/review RPC contract.
-- This migration intentionally does not depend on 202607080028 being present in production.

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

-- Owner content edit boundary. The client resolves canonical location first, then sends
-- only editable fields in one JSON patch. Moderation fields are never accepted here.
create or replace function public.rawaj_owner_update_listing(
  p_listing_id uuid,
  p_patch jsonb
)
returns setof public.listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_listing public.listings%rowtype;
  v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  v_allowed_keys text[] := array[
    'category_id','subcategory_id','governorate_id','location_node_id','title',
    'description','price','price_type','listing_condition','district_ar',
    'contact_name','contact_options','details'
  ];
  v_unknown_keys text[];
begin
  if v_actor is null then
    raise exception 'Authentication required.';
  end if;

  select array_agg(k)
    into v_unknown_keys
  from jsonb_object_keys(v_patch) as k
  where not (k = any(v_allowed_keys));

  if coalesce(array_length(v_unknown_keys, 1), 0) > 0 then
    raise exception 'Unsupported listing edit fields: %', array_to_string(v_unknown_keys, ',');
  end if;

  select l.* into v_listing
  from public.listings l
  where l.id = p_listing_id
    and l.owner_id = v_actor
    and l.status in ('draft', 'rejected')
  for update;

  if v_listing.id is null then
    raise exception 'Editable owned listing not found.';
  end if;

  update public.listings l
  set
    category_id = case when v_patch ? 'category_id' then nullif(btrim(v_patch->>'category_id'), '') else l.category_id end,
    subcategory_id = case when v_patch ? 'subcategory_id' then nullif(btrim(v_patch->>'subcategory_id'), '') else l.subcategory_id end,
    governorate_id = case when v_patch ? 'governorate_id' then nullif(btrim(v_patch->>'governorate_id'), '') else l.governorate_id end,
    location_node_id = case
      when v_patch ? 'location_node_id' and jsonb_typeof(v_patch->'location_node_id') = 'null' then null
      when v_patch ? 'location_node_id' then nullif(v_patch->>'location_node_id', '')::uuid
      else l.location_node_id
    end,
    title = case when v_patch ? 'title' then btrim(v_patch->>'title') else l.title end,
    description = case
      when v_patch ? 'description' and jsonb_typeof(v_patch->'description') = 'null' then null
      when v_patch ? 'description' then btrim(v_patch->>'description')
      else l.description
    end,
    price = case
      when v_patch ? 'price' and jsonb_typeof(v_patch->'price') = 'null' then null
      when v_patch ? 'price' then (v_patch->>'price')::numeric
      else l.price
    end,
    price_type = case when v_patch ? 'price_type' then v_patch->>'price_type' else l.price_type end,
    listing_condition = case when v_patch ? 'listing_condition' then v_patch->>'listing_condition' else l.listing_condition end,
    district_ar = case
      when v_patch ? 'district_ar' and jsonb_typeof(v_patch->'district_ar') = 'null' then null
      when v_patch ? 'district_ar' then btrim(v_patch->>'district_ar')
      else l.district_ar
    end,
    contact_name = case
      when v_patch ? 'contact_name' and jsonb_typeof(v_patch->'contact_name') = 'null' then null
      when v_patch ? 'contact_name' then btrim(v_patch->>'contact_name')
      else l.contact_name
    end,
    contact_options = case when v_patch ? 'contact_options' then coalesce(v_patch->'contact_options', '{}'::jsonb) else l.contact_options end,
    details = case when v_patch ? 'details' then coalesce(v_patch->'details', '{}'::jsonb) else l.details end,
    updated_at = now()
  where l.id = p_listing_id;

  if exists (
    select 1 from public.listings l
    where l.id = p_listing_id
      and (
        l.category_id is null
        or l.governorate_id is null
        or char_length(btrim(coalesce(l.title, ''))) < 4
      )
  ) then
    raise exception 'Listing category, governorate, and title are required.';
  end if;

  return query select l.* from public.listings l where l.id = p_listing_id;
end;
$$;

revoke all on function public.rawaj_owner_update_listing(uuid, jsonb) from public;
revoke all on function public.rawaj_owner_update_listing(uuid, jsonb) from anon;
grant execute on function public.rawaj_owner_update_listing(uuid, jsonb) to authenticated;

-- Self-contained customer submit/resubmit boundary. Does not rely on direct UPDATE RLS.
create or replace function public.rawaj_submit_listing_for_review(p_listing_id uuid)
returns setof public.listings
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

  if to_regclass('public.user_restrictions') is not null and exists (
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
    and l.status in ('draft', 'rejected')
  for update;

  if v_listing.id is null then
    raise exception 'Draft or rejected owned listing not found.';
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

  return query select l.* from public.listings l where l.id = p_listing_id;
end;
$$;

revoke all on function public.rawaj_submit_listing_for_review(uuid) from public;
revoke all on function public.rawaj_submit_listing_for_review(uuid) from anon;
grant execute on function public.rawaj_submit_listing_for_review(uuid) to authenticated;

-- Self-contained pending queue, present even if an older production database missed 028.
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

-- Self-contained stale-safe decision boundary. Core status change is authoritative;
-- optional history/audit/notification failures never roll it back.
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
  set
    status = p_decision,
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

comment on function public.rawaj_owner_update_listing(uuid, jsonb) is
  'Owner-only editable draft/rejected content update boundary independent of direct table UPDATE RLS.';
comment on function public.rawaj_submit_listing_for_review(uuid) is
  'Self-contained draft/rejected -> pending_review boundary independent of direct UPDATE RLS.';
