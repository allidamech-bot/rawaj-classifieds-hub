-- RAWAJ real in-app review notification delivery.
-- Notifies a seller only after a review is approved, respecting persisted review preferences.
-- Pending or rejected review content is not surfaced to the seller as a notification.

create or replace function public.rawaj_deliver_approved_review_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean := true;
  v_reviewer_name text;
begin
  if old.status is not distinct from new.status or new.status <> 'approved' then
    return new;
  end if;

  select p.reviews_enabled
    into v_enabled
  from public.notification_preferences p
  where p.user_id = new.seller_user_id;

  if coalesce(v_enabled, true) is not true then
    return new;
  end if;

  select coalesce(
    nullif(btrim(p.display_name), ''),
    nullif(btrim(p.first_name), ''),
    'مستخدم رواج'
  )
    into v_reviewer_name
  from public.profiles p
  where p.id = new.reviewer_user_id;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    title_ar,
    body_ar,
    target_type,
    target_id,
    metadata
  ) values (
    new.seller_user_id,
    new.reviewer_user_id,
    'review.approved',
    'لديك تقييم جديد',
    'أضاف ' || coalesce(v_reviewer_name, 'مستخدم رواج') || ' تقييماً معتمداً بدرجة ' || new.rating::text || ' من 5.',
    'seller',
    new.seller_user_id::text,
    jsonb_build_object(
      'review_id', new.id,
      'reviewer_user_id', new.reviewer_user_id,
      'rating', new.rating,
      'related_listing_id', new.related_listing_id
    )
  );

  return new;
end;
$$;

drop trigger if exists seller_reviews_deliver_approved_notification
  on public.seller_reviews;
create trigger seller_reviews_deliver_approved_notification
after update of status on public.seller_reviews
for each row execute function public.rawaj_deliver_approved_review_notification();

comment on function public.rawaj_deliver_approved_review_notification() is
  'Delivers a real preference-aware in-app notification to the seller only when a review transitions to approved.';
