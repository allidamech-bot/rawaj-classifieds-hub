-- RAWAJ Listing Expiry Retention.
-- Records bounded, deduplicated in-app reminders for owners before approved listings expire.
-- No background scheduler is claimed or created here.

create table if not exists public.listing_expiry_reminder_deliveries (
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_kind text not null,
  delivered_at timestamptz not null default now(),
  primary key (listing_id, reminder_kind)
);

alter table public.listing_expiry_reminder_deliveries
  drop constraint if exists listing_expiry_reminder_kind_check;

alter table public.listing_expiry_reminder_deliveries
  add constraint listing_expiry_reminder_kind_check
  check (reminder_kind in ('expiring_7d', 'expiring_1d'));

create index if not exists listing_expiry_reminder_deliveries_user_idx
  on public.listing_expiry_reminder_deliveries (user_id, delivered_at desc);

alter table public.listing_expiry_reminder_deliveries enable row level security;

drop policy if exists "listing_expiry_reminders_select_own"
  on public.listing_expiry_reminder_deliveries;
create policy "listing_expiry_reminders_select_own"
on public.listing_expiry_reminder_deliveries
for select
to authenticated
using (auth.uid() = user_id);

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

comment on table public.listing_expiry_reminder_deliveries is
  'Deduplicates real in-app listing expiry reminders delivered through bounded owner scans.';

comment on function public.rawaj_record_listing_expiry_reminder(uuid, text) is
  'Records a validated, preference-aware in-app expiry reminder for the authenticated listing owner.';
