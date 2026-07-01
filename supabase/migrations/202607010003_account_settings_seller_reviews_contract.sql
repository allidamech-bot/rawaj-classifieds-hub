-- RAWAJ Sprint 4B account settings, profile media, and seller reviews contract.
--
-- Manual-only migration: review and run from Supabase Dashboard SQL Editor.
-- Do not execute from Lovable or from the frontend.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists bio text,
  add column if not exists business_name text,
  add column if not exists phone text,
  add column if not exists whatsapp text,
  add column if not exists preferred_contact_method text,
  add column if not exists city_area text,
  add column if not exists avatar_path text,
  add column if not exists avatar_url text,
  add column if not exists cover_path text,
  add column if not exists cover_url text;

alter table public.profiles drop constraint if exists profiles_first_name_length;
alter table public.profiles
  add constraint profiles_first_name_length
  check (first_name is null or char_length(btrim(first_name)) between 2 and 40);

alter table public.profiles drop constraint if exists profiles_last_name_length;
alter table public.profiles
  add constraint profiles_last_name_length
  check (last_name is null or char_length(btrim(last_name)) <= 40);

alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles
  add constraint profiles_bio_length
  check (bio is null or char_length(btrim(bio)) <= 600);

alter table public.profiles drop constraint if exists profiles_public_text_lengths;
alter table public.profiles
  add constraint profiles_public_text_lengths
  check (
    (business_name is null or char_length(btrim(business_name)) <= 120)
    and (phone is null or char_length(btrim(phone)) <= 40)
    and (whatsapp is null or char_length(btrim(whatsapp)) <= 40)
    and (preferred_contact_method is null or char_length(btrim(preferred_contact_method)) <= 40)
    and (city_area is null or char_length(btrim(city_area)) <= 80)
  );

drop policy if exists "profiles_public_seller_fields_select" on public.profiles;

create or replace function public.get_public_seller_profile(p_seller_id uuid)
returns table (
  id uuid,
  first_name text,
  last_name text,
  display_name text,
  governorate text,
  bio text,
  business_name text,
  avatar_path text,
  avatar_url text,
  cover_path text,
  cover_url text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.first_name,
    p.last_name,
    p.display_name,
    p.governorate,
    p.bio,
    p.business_name,
    p.avatar_path,
    p.avatar_url,
    p.cover_path,
    p.cover_url,
    p.created_at
  from public.profiles p
  where p.id = p_seller_id
    and exists (
      select 1
      from public.listings l
      where l.owner_id = p.id
        and l.status = 'approved'
    );
$$;

revoke execute on function public.get_public_seller_profile(uuid) from public;
grant execute on function public.get_public_seller_profile(uuid) to anon, authenticated;

comment on function public.get_public_seller_profile(uuid) is
  'Returns only safe public fields for sellers with approved listings. Used by public seller profile pages.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-media',
  'profile-media',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "RAWAJ profile media public read" on storage.objects;
create policy "RAWAJ profile media public read"
on storage.objects for select
using (bucket_id = 'profile-media');

drop policy if exists "RAWAJ users upload own profile media" on storage.objects;
create policy "RAWAJ users upload own profile media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-media'
  and auth.uid()::text = (storage.foldername(name))[1]
  and (storage.foldername(name))[2] in ('avatar', 'cover')
);

drop policy if exists "RAWAJ users update own profile media" on storage.objects;
create policy "RAWAJ users update own profile media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-media'
  and auth.uid()::text = (storage.foldername(name))[1]
  and (storage.foldername(name))[2] in ('avatar', 'cover')
)
with check (
  bucket_id = 'profile-media'
  and auth.uid()::text = (storage.foldername(name))[1]
  and (storage.foldername(name))[2] in ('avatar', 'cover')
);

drop policy if exists "RAWAJ users delete own profile media" on storage.objects;
create policy "RAWAJ users delete own profile media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-media'
  and auth.uid()::text = (storage.foldername(name))[1]
  and (storage.foldername(name))[2] in ('avatar', 'cover')
);

create table if not exists public.seller_reviews (
  id uuid primary key default gen_random_uuid(),
  seller_user_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_user_id uuid not null references public.profiles(id) on delete cascade,
  related_listing_id uuid references public.listings(id) on delete set null,
  rating integer not null,
  comment text not null,
  status text not null default 'pending_review',
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seller_reviews drop constraint if exists seller_reviews_rating_range;
alter table public.seller_reviews
  add constraint seller_reviews_rating_range check (rating between 1 and 5);

alter table public.seller_reviews drop constraint if exists seller_reviews_status_allowed;
alter table public.seller_reviews
  add constraint seller_reviews_status_allowed
  check (status in ('pending_review', 'approved', 'rejected'));

alter table public.seller_reviews drop constraint if exists seller_reviews_comment_length;
alter table public.seller_reviews
  add constraint seller_reviews_comment_length
  check (char_length(btrim(comment)) between 10 and 1200);

alter table public.seller_reviews drop constraint if exists seller_reviews_no_self_review;
alter table public.seller_reviews
  add constraint seller_reviews_no_self_review check (seller_user_id <> reviewer_user_id);

create unique index if not exists idx_seller_reviews_open_unique
  on public.seller_reviews (seller_user_id, reviewer_user_id)
  where status in ('pending_review', 'approved');

create index if not exists idx_seller_reviews_seller_approved_created
  on public.seller_reviews (seller_user_id, created_at desc)
  where status = 'approved';

create index if not exists idx_seller_reviews_status_created
  on public.seller_reviews (status, created_at desc);

create or replace function public.rawaj_touch_seller_reviews_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists seller_reviews_touch_updated_at on public.seller_reviews;
create trigger seller_reviews_touch_updated_at
before update on public.seller_reviews
for each row execute function public.rawaj_touch_seller_reviews_updated_at();

create or replace function public.rawaj_protect_seller_review_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to create seller reviews.';
  end if;

  if new.reviewer_user_id is distinct from auth.uid() then
    raise exception 'Reviewer cannot be spoofed.';
  end if;

  if new.seller_user_id = auth.uid() then
    raise exception 'Users cannot review themselves.';
  end if;

  new.status := 'pending_review';
  new.admin_note := null;
  new.reviewed_by := null;
  new.reviewed_at := null;

  return new;
end;
$$;

drop trigger if exists seller_reviews_protect_insert on public.seller_reviews;
create trigger seller_reviews_protect_insert
before insert on public.seller_reviews
for each row execute function public.rawaj_protect_seller_review_insert();

create or replace function public.rawaj_protect_seller_review_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_can_moderate() then
    raise exception 'Only privileged users can moderate seller reviews.';
  end if;

  if new.seller_user_id is distinct from old.seller_user_id
    or new.reviewer_user_id is distinct from old.reviewer_user_id
    or new.related_listing_id is distinct from old.related_listing_id
    or new.rating is distinct from old.rating
    or new.comment is distinct from old.comment
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Seller review content cannot be changed during moderation.';
  end if;

  if new.status is distinct from old.status
    or new.admin_note is distinct from old.admin_note
  then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists seller_reviews_protect_update on public.seller_reviews;
create trigger seller_reviews_protect_update
before update on public.seller_reviews
for each row execute function public.rawaj_protect_seller_review_update();

create or replace function public.rawaj_audit_seller_review_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_can_moderate() then
    return new;
  end if;

  if new.status is distinct from old.status
    or new.admin_note is distinct from old.admin_note
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
  then
    perform public.rawaj_insert_audit_log(
      'seller_review.moderated',
      'seller_reviews',
      new.id::text,
      jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'seller_user_id', new.seller_user_id,
        'reviewer_user_id', new.reviewer_user_id,
        'has_admin_note', new.admin_note is not null
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists seller_reviews_audit_moderation on public.seller_reviews;
create trigger seller_reviews_audit_moderation
after update on public.seller_reviews
for each row execute function public.rawaj_audit_seller_review_moderation();

alter table public.seller_reviews enable row level security;

drop policy if exists "seller_reviews_user_insert" on public.seller_reviews;
create policy "seller_reviews_user_insert"
on public.seller_reviews
for insert
to authenticated
with check (
  reviewer_user_id = auth.uid()
  and seller_user_id <> auth.uid()
  and status = 'pending_review'
  and admin_note is null
  and reviewed_by is null
  and reviewed_at is null
);

drop policy if exists "seller_reviews_public_select_approved" on public.seller_reviews;
create policy "seller_reviews_public_select_approved"
on public.seller_reviews
for select
using (status = 'approved');

drop policy if exists "seller_reviews_reviewer_select_own" on public.seller_reviews;
create policy "seller_reviews_reviewer_select_own"
on public.seller_reviews
for select
to authenticated
using (reviewer_user_id = auth.uid());

drop policy if exists "seller_reviews_seller_select_about_self" on public.seller_reviews;
create policy "seller_reviews_seller_select_about_self"
on public.seller_reviews
for select
to authenticated
using (seller_user_id = auth.uid());

drop policy if exists "seller_reviews_admin_select" on public.seller_reviews;
create policy "seller_reviews_admin_select"
on public.seller_reviews
for select
to authenticated
using (public.current_user_can_moderate());

drop policy if exists "seller_reviews_admin_update" on public.seller_reviews;
create policy "seller_reviews_admin_update"
on public.seller_reviews
for update
to authenticated
using (public.current_user_can_moderate())
with check (public.current_user_can_moderate());

drop policy if exists "seller_reviews_admin_delete" on public.seller_reviews;
create policy "seller_reviews_admin_delete"
on public.seller_reviews
for delete
to authenticated
using (public.current_user_can_moderate());

comment on table public.seller_reviews is
  'Moderated RAWAJ seller ratings and written reviews. Public surfaces must show approved reviews only.';
