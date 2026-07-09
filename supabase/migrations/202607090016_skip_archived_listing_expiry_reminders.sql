-- RAWAJ listing expiry reminder visibility alignment.
--
-- Owner reminder scans and the SECURITY DEFINER recorder must ignore archived
-- listings. Existing reminder deliveries and listing rows are not rewritten.

create or replace function public.rawaj_record_listing_expiry_reminder(
  p_listing_id uuid,
  p_reminder_kind text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_listing_title text;
  v_expires_at timestamptz;
  v_preference_enabled boolean := true;
  v_inserted_rows integer := 0;
  v_body text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_reminder_kind not in ('expiring_7d', 'expiring_1d') then
    raise exception 'Invalid reminder kind';
  end if;

  select l.title, l.expires_at
    into v_listing_title, v_expires_at
  from public.listings l
  where l.id = p_listing_id
    and l.owner_id = v_user_id
    and l.status = 'approved'
    and l.archived_at is null
    and l.expires_at is not null
    and l.expires_at > now();

  if v_listing_title is null or v_expires_at is null then
    return false;
  end if;

  if p_reminder_kind = 'expiring_1d' then
    if v_expires_at > now() + interval '1 day' then
      return false;
    end if;
  else
    if v_expires_at <= now() + interval '1 day'
      or v_expires_at > now() + interval '7 days'
    then
      return false;
    end if;
  end if;

  select p.listing_status_enabled
    into v_preference_enabled
  from public.notification_preferences p
  where p.user_id = v_user_id;

  if coalesce(v_preference_enabled, true) is not true then
    return false;
  end if;

  insert into public.listing_expiry_reminder_deliveries (
    listing_id,
    user_id,
    reminder_kind
  ) values (
    p_listing_id,
    v_user_id,
    p_reminder_kind
  )
  on conflict (listing_id, reminder_kind) do nothing;

  get diagnostics v_inserted_rows = row_count;
  if v_inserted_rows = 0 then
    return false;
  end if;

  v_body := case
    when p_reminder_kind = 'expiring_1d'
      then 'إعلان "' || v_listing_title || '" سينتهي خلال أقل من يوم.'
    else 'إعلان "' || v_listing_title || '" سينتهي خلال 7 أيام.'
  end;

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
    'listing.expiring_soon',
    'إعلانك يقترب من الانتهاء',
    v_body,
    'listing',
    p_listing_id::text,
    jsonb_build_object(
      'listing_id', p_listing_id,
      'reminder_kind', p_reminder_kind,
      'expires_at', v_expires_at
    )
  );

  return true;
end;
$$;

revoke all on function public.rawaj_record_listing_expiry_reminder(uuid, text) from public;
revoke all on function public.rawaj_record_listing_expiry_reminder(uuid, text) from anon;
grant execute on function public.rawaj_record_listing_expiry_reminder(uuid, text) to authenticated;

comment on function public.rawaj_record_listing_expiry_reminder(uuid, text) is
  'Records a validated, preference-aware expiry reminder for a non-archived approved listing owned by the authenticated user.';
