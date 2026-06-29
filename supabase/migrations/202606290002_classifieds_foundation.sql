-- RAWAJ classifieds foundation.
-- Manual-only migration: review and run from Supabase Dashboard SQL Editor.
-- Do not run through Lovable Cloud or expose service-role keys in frontend code.

create extension if not exists pgcrypto;

do $$
begin
  create type public.rawaj_listing_status as enum (
    'draft',
    'pending_review',
    'approved',
    'rejected',
    'archived',
    'expired'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.rawaj_listing_condition as enum (
    'new',
    'like_new',
    'used',
    'for_parts',
    'not_applicable'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.rawaj_price_type as enum (
    'fixed',
    'negotiable',
    'contact',
    'free',
    'exchange'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.rawaj_listing_report_type as enum (
    'suspicious_listing',
    'fraud',
    'prohibited_content',
    'abusive_user',
    'misleading_price',
    'wrong_info',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.rawaj_report_status as enum (
    'new',
    'under_review',
    'resolved',
    'rejected'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  hint_ar text,
  placeholder text not null default 'misc',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.governorates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  districts_ar text[] not null default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  governorate_id uuid not null references public.governorates(id) on delete restrict,
  title text not null check (char_length(title) between 4 and 140),
  description text not null default '' check (char_length(description) <= 6000),
  price numeric(14, 2) check (price is null or price >= 0),
  currency text not null default 'SYP' check (currency = 'SYP'),
  price_type public.rawaj_price_type not null default 'fixed',
  listing_condition public.rawaj_listing_condition not null default 'not_applicable',
  status public.rawaj_listing_status not null default 'pending_review',
  district_ar text,
  contact_name text,
  contact_options jsonb not null default '{"message": true, "phone": false, "whatsapp": false}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  is_featured boolean not null default false,
  featured_until timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text,
  alt_ar text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name_ar text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  report_type public.rawaj_listing_report_type not null,
  reason text not null check (char_length(reason) between 4 and 1200),
  status public.rawaj_report_status not null default 'new',
  assigned_to uuid references public.profiles(id) on delete set null,
  admin_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.rawaj_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.rawaj_is_owner_or_admin()
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
      and ur.role in ('owner', 'admin')
      and p.account_status = 'active'
  );
$$;

create or replace function public.rawaj_listing_owner_can_write(listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.listings l
    where l.id = listing_id
      and l.owner_id = auth.uid()
      and l.status in ('draft', 'pending_review', 'rejected')
  );
$$;

create or replace function public.rawaj_protect_listing_user_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  is_admin := public.rawaj_is_owner_or_admin();

  if is_admin then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication is required to write listings.';
  end if;

  if tg_op = 'INSERT' then
    if new.owner_id is distinct from auth.uid() then
      raise exception 'Listings must be owned by the authenticated user.';
    end if;

    if new.status not in ('draft', 'pending_review') then
      raise exception 'Normal users cannot approve or moderate listings.';
    end if;

    if new.is_featured is distinct from false
      or new.featured_until is not null
      or new.reviewed_by is not null
      or new.reviewed_at is not null
      or new.rejection_reason is not null
      or new.published_at is not null
      or new.archived_at is not null then
      raise exception 'Normal users cannot set listing moderation fields.';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.owner_id is distinct from new.owner_id then
      raise exception 'Normal users cannot change listing ownership.';
    end if;

    if new.status not in ('draft', 'pending_review') then
      raise exception 'Normal users cannot approve, archive, expire, or reject listings.';
    end if;

    if new.is_featured is distinct from old.is_featured
      or new.featured_until is distinct from old.featured_until
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at
      or new.published_at is distinct from old.published_at
      or new.archived_at is distinct from old.archived_at then
      raise exception 'Normal users cannot change listing moderation fields.';
    end if;

    if old.status = 'rejected' and new.status in ('draft', 'pending_review') then
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.rejection_reason := null;
    elsif new.rejection_reason is distinct from old.rejection_reason then
      raise exception 'Normal users cannot change rejection notes.';
    end if;

    return new;
  end if;

  return new;
end;
$$;

create or replace function public.rawaj_protect_listing_report_user_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.rawaj_is_owner_or_admin() then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication is required to report listings.';
  end if;

  if tg_op = 'INSERT' then
    if new.reporter_id is distinct from auth.uid() then
      raise exception 'Reports must be owned by the authenticated reporter.';
    end if;

    if new.status is distinct from 'new'
      or new.assigned_to is not null
      or new.admin_note is not null
      or new.resolved_at is not null then
      raise exception 'Normal users cannot set report moderation fields.';
    end if;

    return new;
  end if;

  raise exception 'Normal users cannot update listing reports after creation.';
end;
$$;

drop trigger if exists categories_touch_updated_at on public.categories;
create trigger categories_touch_updated_at
before update on public.categories
for each row execute function public.rawaj_touch_updated_at();

drop trigger if exists governorates_touch_updated_at on public.governorates;
create trigger governorates_touch_updated_at
before update on public.governorates
for each row execute function public.rawaj_touch_updated_at();

drop trigger if exists listings_touch_updated_at on public.listings;
create trigger listings_touch_updated_at
before update on public.listings
for each row execute function public.rawaj_touch_updated_at();

drop trigger if exists listings_protect_user_writes on public.listings;
create trigger listings_protect_user_writes
before insert or update on public.listings
for each row execute function public.rawaj_protect_listing_user_writes();

drop trigger if exists saved_searches_touch_updated_at on public.saved_searches;
create trigger saved_searches_touch_updated_at
before update on public.saved_searches
for each row execute function public.rawaj_touch_updated_at();

drop trigger if exists listing_reports_touch_updated_at on public.listing_reports;
create trigger listing_reports_touch_updated_at
before update on public.listing_reports
for each row execute function public.rawaj_touch_updated_at();

drop trigger if exists listing_reports_protect_user_writes on public.listing_reports;
create trigger listing_reports_protect_user_writes
before insert or update on public.listing_reports
for each row execute function public.rawaj_protect_listing_report_user_writes();

alter table public.categories enable row level security;
alter table public.governorates enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.favorites enable row level security;
alter table public.saved_searches enable row level security;
alter table public.listing_reports enable row level security;

drop policy if exists "Public reads active categories" on public.categories;
create policy "Public reads active categories"
on public.categories for select
using (is_active = true or public.rawaj_is_owner_or_admin());

drop policy if exists "Owner admins manage categories" on public.categories;
create policy "Owner admins manage categories"
on public.categories for all
to authenticated
using (public.rawaj_is_owner_or_admin())
with check (public.rawaj_is_owner_or_admin());

drop policy if exists "Public reads active governorates" on public.governorates;
create policy "Public reads active governorates"
on public.governorates for select
using (is_active = true or public.rawaj_is_owner_or_admin());

drop policy if exists "Owner admins manage governorates" on public.governorates;
create policy "Owner admins manage governorates"
on public.governorates for all
to authenticated
using (public.rawaj_is_owner_or_admin())
with check (public.rawaj_is_owner_or_admin());

drop policy if exists "Public reads approved listings" on public.listings;
create policy "Public reads approved listings"
on public.listings for select
using (
  status = 'approved'
  or owner_id = auth.uid()
  or public.rawaj_is_owner_or_admin()
);

drop policy if exists "Authenticated users create own safe listings" on public.listings;
create policy "Authenticated users create own safe listings"
on public.listings for insert
to authenticated
with check (
  owner_id = auth.uid()
  and status in ('draft', 'pending_review')
  and is_featured = false
  and featured_until is null
  and reviewed_by is null
  and reviewed_at is null
  and rejection_reason is null
  and published_at is null
  and archived_at is null
);

drop policy if exists "Listing owners edit unapproved own listings" on public.listings;
create policy "Listing owners edit unapproved own listings"
on public.listings for update
to authenticated
using (
  owner_id = auth.uid()
  and status in ('draft', 'pending_review', 'rejected')
)
with check (
  owner_id = auth.uid()
  and status in ('draft', 'pending_review')
);

drop policy if exists "Owner admins moderate listings" on public.listings;
create policy "Owner admins moderate listings"
on public.listings for update
to authenticated
using (public.rawaj_is_owner_or_admin())
with check (public.rawaj_is_owner_or_admin());

drop policy if exists "Listing images visible with listing" on public.listing_images;
create policy "Listing images visible with listing"
on public.listing_images for select
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
      and (l.status = 'approved' or l.owner_id = auth.uid() or public.rawaj_is_owner_or_admin())
  )
);

drop policy if exists "Listing owners add images before approval" on public.listing_images;
create policy "Listing owners add images before approval"
on public.listing_images for insert
to authenticated
with check (public.rawaj_listing_owner_can_write(listing_id));

drop policy if exists "Listing owners edit images before approval" on public.listing_images;
create policy "Listing owners edit images before approval"
on public.listing_images for update
to authenticated
using (public.rawaj_listing_owner_can_write(listing_id))
with check (public.rawaj_listing_owner_can_write(listing_id));

drop policy if exists "Listing owners delete images before approval" on public.listing_images;
create policy "Listing owners delete images before approval"
on public.listing_images for delete
to authenticated
using (public.rawaj_listing_owner_can_write(listing_id) or public.rawaj_is_owner_or_admin());

drop policy if exists "Users manage own favorites" on public.favorites;
create policy "Users manage own favorites"
on public.favorites for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.listings l
    where l.id = listing_id
      and (
        l.status = 'approved'
        or l.owner_id = auth.uid()
        or public.rawaj_is_owner_or_admin()
      )
  )
);

drop policy if exists "Users manage own saved searches" on public.saved_searches;
create policy "Users manage own saved searches"
on public.saved_searches for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users create listing reports" on public.listing_reports;
create policy "Users create listing reports"
on public.listing_reports for insert
to authenticated
with check (
  reporter_id = auth.uid()
  and status = 'new'
  and assigned_to is null
  and admin_note is null
  and resolved_at is null
);

drop policy if exists "Owner admins read listing reports" on public.listing_reports;
create policy "Owner admins read listing reports"
on public.listing_reports for select
to authenticated
using (public.rawaj_is_owner_or_admin());

drop policy if exists "Owner admins moderate listing reports" on public.listing_reports;
create policy "Owner admins moderate listing reports"
on public.listing_reports for update
to authenticated
using (public.rawaj_is_owner_or_admin())
with check (public.rawaj_is_owner_or_admin());

create index if not exists idx_categories_active_sort on public.categories (is_active, sort_order);
create index if not exists idx_governorates_active_sort on public.governorates (is_active, sort_order);
create index if not exists idx_listings_status_created on public.listings (status, created_at desc);
create index if not exists idx_listings_category on public.listings (category_id);
create index if not exists idx_listings_governorate on public.listings (governorate_id);
create index if not exists idx_listings_owner on public.listings (owner_id);
create index if not exists idx_listings_featured on public.listings (is_featured, featured_until);
create index if not exists idx_listings_price on public.listings (price);
create index if not exists idx_listings_search on public.listings
using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')));
create index if not exists idx_listing_images_listing_sort on public.listing_images (listing_id, sort_order);
create index if not exists idx_favorites_user_created on public.favorites (user_id, created_at desc);
create index if not exists idx_saved_searches_user_created on public.saved_searches (user_id, created_at desc);
create index if not exists idx_listing_reports_status_created on public.listing_reports (status, created_at desc);
create index if not exists idx_listing_reports_listing on public.listing_reports (listing_id);

insert into public.governorates (slug, name_ar, districts_ar, sort_order)
values
  ('damascus', 'دمشق', array['المزة','كفرسوسة','المالكي','أبو رمانة','باب توما','الشعلان','مشروع دمر','برزة','ركن الدين','دمشق القديمة'], 10),
  ('rif-dimashq', 'ريف دمشق', array['جرمانا','صحنايا','قدسيا','جديدة عرطوز','دوما','داريا','القطيفة','يبرود','النبك'], 20),
  ('aleppo', 'حلب', array['الحمدانية','الفرقان','الجميلية','حلب الجديدة','المحافظة','السريان','الشهباء','باب الفرج'], 30),
  ('homs', 'حمص', array['الوعر','الحمرا','عكرمة','الإنشاءات','الزهراء'], 40),
  ('hama', 'حماة', array['الحاضر','البرناوي','طريق حلب','جنوب الملعب'], 50),
  ('latakia', 'اللاذقية', array['المشروع السابع','الرمل الجنوبي','الزراعة','الصليبة','الشيخ ضاهر'], 60),
  ('tartus', 'طرطوس', array['الكورنيش','الرمل','المشروع السادس','الدريكيش','صافيتا'], 70),
  ('idlib', 'إدلب', array['إدلب المدينة','أريحا','جسر الشغور','معرة مصرين'], 80),
  ('deir-ez-zor', 'دير الزور', array['دير الزور المدينة','الميادين','البوكمال'], 90),
  ('raqqa', 'الرقة', array['الرقة المدينة','الطبقة'], 100),
  ('hasakah', 'الحسكة', array['الحسكة المدينة','القامشلي','المالكية','عامودا'], 110),
  ('daraa', 'درعا', array['درعا البلد','درعا المحطة','الصنمين','إزرع'], 120),
  ('suwayda', 'السويداء', array['السويداء المدينة','شهبا','صلخد'], 130),
  ('quneitra', 'القنيطرة', array['القنيطرة','خان أرنبة'], 140)
on conflict (slug) do update set
  name_ar = excluded.name_ar,
  districts_ar = excluded.districts_ar;

insert into public.categories (slug, name_ar, hint_ar, placeholder, sort_order)
values
  ('cars', 'سيارات ومركبات', 'سيارات وقطع غيار ومركبات', 'car', 10),
  ('realestate', 'عقارات', 'بيع وإيجار ومكاتب وأراضي', 'realestate', 20),
  ('mobiles', 'موبايلات وتابلت', 'أجهزة وإكسسوارات', 'phone', 30),
  ('electronics', 'إلكترونيات', 'لابتوبات وشاشات وأجهزة', 'electronics', 40),
  ('furniture', 'منزل وأثاث', 'منزل ومكتب وديكور', 'furniture', 50),
  ('jobs', 'وظائف', 'فرص عمل وباحثين عن عمل', 'job', 60),
  ('services', 'خدمات', 'صيانة ونقل وتنظيف وتصميم', 'service', 70),
  ('fashion', 'أزياء ومستلزمات', 'ملابس وساعات وعطور وإكسسوارات', 'fashion', 80),
  ('food', 'أطعمة ومنتجات محلية', 'منتجات محلية ومواد غذائية', 'food', 90),
  ('animals', 'حيوانات ومواشي', 'مواشي وطيور ومستلزمات', 'animals', 100),
  ('education', 'تعليم ودورات', 'دورات ومدرسين وتدريب', 'education', 110),
  ('business', 'أعمال وصناعة', 'معدات ومحلات ومشاريع', 'business', 120),
  ('misc', 'المزيد', 'إعلانات متنوعة', 'misc', 130)
on conflict (slug) do update set
  name_ar = excluded.name_ar,
  hint_ar = excluded.hint_ar,
  placeholder = excluded.placeholder;
