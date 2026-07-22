-- Reconcile the live listing moderation guard with the stored generated search column.
-- PostgreSQL BEFORE UPDATE trigger NEW rows do not provide a stable value for stored generated
-- columns, so search_text_normalized must be excluded from OLD/NEW JSON safety comparisons.

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

comment on function public.rawaj_protect_listing_moderation_update() is
  'Protects listing writes while excluding the stored generated search column from BEFORE UPDATE comparisons.';

do $$
declare
  v_definition text;
  v_generated text;
begin
  select c.is_generated
    into v_generated
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'listings'
    and c.column_name = 'search_text_normalized';

  if v_generated is distinct from 'ALWAYS' then
    raise exception 'Expected listings.search_text_normalized to be a stored generated column.';
  end if;

  select pg_get_functiondef(
    'public.rawaj_protect_listing_moderation_update()'::regprocedure
  ) into v_definition;

  if v_definition !~* E"'expires_at',\\s*'search_text_normalized'" then
    raise exception 'Listing review guard does not exclude search_text_normalized.';
  end if;

  if v_definition !~* 'rawaj\.promotion_moderation_write' then
    raise exception 'Listing promotion moderation write guard is missing.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
