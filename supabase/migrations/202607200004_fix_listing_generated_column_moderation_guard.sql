-- RAWAJ listing write guard repair.
-- PostgreSQL stored generated columns are not stable inside BEFORE UPDATE trigger NEW rows.
-- Exclude search_text_normalized from OLD/NEW JSON comparisons and provide a tightly scoped
-- internal write path for the governed promotion moderation trigger.

create or replace function public.rawaj_protect_listing_moderation_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('rawaj.owner_price_drop_write', true) = 'on' then
    if auth.uid() is null or old.owner_id <> auth.uid() then
      raise exception 'listing_price_drop_permission_denied';
    end if;

    if old.status <> 'approved' or new.status is distinct from old.status then
      raise exception 'listing_price_drop_requires_approved_listing';
    end if;

    if (to_jsonb(new) - array['price', 'updated_at', 'search_text_normalized'])
       is distinct from
       (to_jsonb(old) - array['price', 'updated_at', 'search_text_normalized'])
    then
      raise exception 'listing_price_drop_unsafe_update';
    end if;

    if old.price is null
       or new.price is null
       or old.price <= 0
       or new.price <= 0
       or new.price >= old.price
    then
      raise exception 'listing_price_drop_invalid_price';
    end if;

    return new;
  end if;

  if current_setting('rawaj.owner_reservation_write', true) = 'on' then
    if auth.uid() is null or old.owner_id <> auth.uid() then
      raise exception 'listing_reservation_permission_denied';
    end if;

    if old.status <> 'approved' or new.status is distinct from old.status then
      raise exception 'listing_reservation_requires_approved_listing';
    end if;

    if (to_jsonb(new) - array['reserved_at', 'updated_at', 'search_text_normalized'])
       is distinct from
       (to_jsonb(old) - array['reserved_at', 'updated_at', 'search_text_normalized'])
    then
      raise exception 'listing_reservation_unsafe_update';
    end if;

    return new;
  end if;

  if current_setting('rawaj.promotion_moderation_write', true) = 'on' then
    if auth.uid() is null or not public.current_user_can_moderate() then
      raise exception 'listing_promotion_moderation_permission_denied';
    end if;

    if old.status <> 'approved' or new.status is distinct from old.status then
      raise exception 'listing_promotion_moderation_requires_approved_listing';
    end if;

    if (to_jsonb(new) - array[
          'is_featured', 'featured_until', 'updated_at', 'search_text_normalized'
        ])
       is distinct from
       (to_jsonb(old) - array[
          'is_featured', 'featured_until', 'updated_at', 'search_text_normalized'
        ])
    then
      raise exception 'listing_promotion_moderation_unsafe_update';
    end if;

    return new;
  end if;

  if public.rawaj_current_user_can_review_listings()
     and (to_jsonb(new) - array[
           'status', 'reviewed_by', 'reviewed_at', 'rejection_reason',
           'published_at', 'archived_at', 'updated_at', 'status_changed_at',
           'expires_at', 'search_text_normalized'
         ])
         is not distinct from
         (to_jsonb(old) - array[
           'status', 'reviewed_by', 'reviewed_at', 'rejection_reason',
           'published_at', 'archived_at', 'updated_at', 'status_changed_at',
           'expires_at', 'search_text_normalized'
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

create or replace function public.rawaj_apply_promotion_moderation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_can_moderate() then
    raise exception 'Only privileged users can moderate promotion requests.';
  end if;

  if new.listing_id is distinct from old.listing_id
    or new.requester_user_id is distinct from old.requester_user_id
    or new.promotion_type is distinct from old.promotion_type
    or new.requested_days is distinct from old.requested_days
    or new.payment_method is distinct from old.payment_method
    or new.payment_reference is distinct from old.payment_reference
    or new.proof_path is distinct from old.proof_path
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Promotion request content cannot be changed during moderation.';
  end if;

  if new.status is distinct from old.status
    or new.admin_note is distinct from old.admin_note
  then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();

    if new.status = 'approved' then
      new.starts_at := coalesce(new.starts_at, now());
      new.ends_at := coalesce(new.ends_at, now() + make_interval(days => new.requested_days));

      perform set_config('rawaj.promotion_moderation_write', 'on', true);
      update public.listings
      set is_featured = true,
          featured_until = new.ends_at,
          updated_at = now()
      where id = new.listing_id
        and owner_id = new.requester_user_id
        and status = 'approved';
      perform set_config('rawaj.promotion_moderation_write', 'off', true);
    elsif new.status in ('cancelled', 'expired')
      and old.status = 'approved'
      and old.ends_at is not null
      and (new.status = 'cancelled' or old.ends_at <= now())
    then
      perform set_config('rawaj.promotion_moderation_write', 'on', true);
      update public.listings
      set is_featured = false,
          featured_until = null,
          updated_at = now()
      where id = new.listing_id
        and owner_id = new.requester_user_id
        and status = 'approved'
        and featured_until is not distinct from old.ends_at;
      perform set_config('rawaj.promotion_moderation_write', 'off', true);
    end if;
  end if;

  return new;
end;
$$;

comment on function public.rawaj_protect_listing_moderation_update() is
  'Protects listing writes while excluding the stored generated search column and allowing only governed promotion feature fields.';
comment on function public.rawaj_apply_promotion_moderation() is
  'Applies promotion moderation through a transaction-local, field-restricted listing write path.';
