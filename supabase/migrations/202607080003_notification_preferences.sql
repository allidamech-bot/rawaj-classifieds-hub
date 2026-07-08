-- RAWAJ Notifications & Retention foundation.
-- Stores user-controlled in-app notification category preferences.
-- Email/push channels are intentionally not exposed here until those delivery systems exist.

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  messages_enabled boolean not null default true,
  price_changes_enabled boolean not null default true,
  saved_search_matches_enabled boolean not null default true,
  listing_status_enabled boolean not null default true,
  reviews_enabled boolean not null default true,
  promotions_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "notification_preferences_select_own" on public.notification_preferences;
create policy "notification_preferences_select_own"
on public.notification_preferences
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "notification_preferences_insert_own" on public.notification_preferences;
create policy "notification_preferences_insert_own"
on public.notification_preferences
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "notification_preferences_update_own" on public.notification_preferences;
create policy "notification_preferences_update_own"
on public.notification_preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.rawaj_touch_notification_preferences_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_preferences_touch_updated_at on public.notification_preferences;
create trigger notification_preferences_touch_updated_at
before update on public.notification_preferences
for each row execute function public.rawaj_touch_notification_preferences_updated_at();

comment on table public.notification_preferences is
  'Per-user in-app notification category preferences for RAWAJ retention flows.';
