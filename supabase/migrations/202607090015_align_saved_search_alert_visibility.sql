-- RAWAJ saved-search alert visibility alignment.
--
-- The alert-match recorder is SECURITY DEFINER, so it must enforce the same
-- public listing boundary as public reads rather than relying on caller RLS.
-- Existing rows are not rewritten.

create or replace function public.rawaj_record_saved_search_alert_match(
  p_saved_search_id uuid,
  p_listing_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_search_name text;
  v_listing_title text;
  v_inserted_rows integer := 0;
  v_preference_enabled boolean := true;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select s.name_ar
    into v_search_name
  from public.saved_searches s
  where s.id = p_saved_search_id
    and s.user_id = v_user_id
    and s.alert_frequency <> 'off';

  if v_search_name is null then
    return false;
  end if;

  select l.title
    into v_listing_title
  from public.listings l
  where l.id = p_listing_id
    and l.status = 'approved'
    and l.archived_at is null
    and (l.expires_at is null or l.expires_at > now());

  if v_listing_title is null then
    return false;
  end if;

  select p.saved_search_matches_enabled
    into v_preference_enabled
  from public.notification_preferences p
  where p.user_id = v_user_id;

  if coalesce(v_preference_enabled, true) is not true then
    return false;
  end if;

  insert into public.saved_search_alert_matches (saved_search_id, listing_id, user_id)
  values (p_saved_search_id, p_listing_id, v_user_id)
  on conflict (saved_search_id, listing_id) do nothing;

  get diagnostics v_inserted_rows = row_count;

  if v_inserted_rows = 0 then
    return false;
  end if;

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
    v_user_id,
    null,
    'saved_search_match',
    'إعلان جديد يطابق بحثك',
    v_listing_title || ' · ' || v_search_name,
    'listing',
    p_listing_id,
    jsonb_build_object('saved_search_id', p_saved_search_id)
  );

  return true;
end;
$$;

revoke all on function public.rawaj_record_saved_search_alert_match(uuid, uuid) from public;
grant execute on function public.rawaj_record_saved_search_alert_match(uuid, uuid) to authenticated;

comment on function public.rawaj_record_saved_search_alert_match(uuid, uuid) is
  'Records a deduplicated preference-aware saved-search match only for a currently public listing owned by the authenticated user search context.';
