-- RAWAJ Backend Phase 1A: core marketplace schema + RLS foundation.
-- Manual-only migration: review and run from Supabase Dashboard SQL Editor.
-- Do not run through Lovable Cloud or expose service-role keys in frontend code.

create extension if not exists pgcrypto;

-- Phase 1A assumes the auth/roles foundation already exists.
-- This migration intentionally avoids destructive legacy table alignment.
-- It creates the core marketplace tables and safe policies only.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.categories (
  id text primary key,
  slug text not null unique,
  name_ar text not null,
  name_en text,
  hint_ar text,
  hint_en text,
  placeholder text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.categories add column if not exists name_en text;
alter table public.categories add column if not exists hint_en text;
alter table public.categories add column if not exists placeholder text;
alter table public.categories alter column placeholder drop not null;

create table if not exists public.subcategories (
  id text primary key,
  category_id text not null references public.categories(id) on delete cascade,
  name_ar text not null,
  name_en text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.governorates (
  id text primary key,
  slug text not null unique,
  name_ar text not null,
  name_en text,
  districts_ar text[] not null default '{}',
  districts_en text[] not null default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.governorates add column if not exists name_en text;
alter table public.governorates add column if not exists districts_en text[] not null default '{}';

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  category_id text not null references public.categories(id),
  subcategory_id text references public.subcategories(id),
  governorate_id text not null references public.governorates(id),
  title text not null,
  description text,
  price numeric,
  currency text not null default 'SYP',
  price_type text not null default 'fixed',
  listing_condition text not null default 'not_applicable',
  status text not null default 'pending_review',
  district_ar text,
  contact_name text,
  contact_options jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  is_featured boolean not null default false,
  featured_until timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.listings add column if not exists subcategory_id text;
alter table public.listings alter column description drop not null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'listings' and column_name = 'status'
      and data_type = 'USER-DEFINED'
  ) then
    update public.listings
    set status = 'archived', archived_at = coalesce(archived_at, now())
    where status::text = 'expired';
    alter table public.listings alter column status drop default;
    alter table public.listings alter column status type text using status::text;
    alter table public.listings alter column status set default 'pending_review';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'listings' and column_name = 'price_type'
      and data_type = 'USER-DEFINED'
  ) then
    alter table public.listings alter column price_type drop default;
    alter table public.listings alter column price_type type text using price_type::text;
    alter table public.listings alter column price_type set default 'fixed';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'listings' and column_name = 'listing_condition'
      and data_type = 'USER-DEFINED'
  ) then
    alter table public.listings alter column listing_condition drop default;
    alter table public.listings alter column listing_condition type text using listing_condition::text;
    alter table public.listings alter column listing_condition set default 'not_applicable';
  end if;
end $$;

update public.listings
set status = 'archived', archived_at = coalesce(archived_at, now())
where status::text = 'expired';

alter table public.listings drop constraint if exists listings_category_id_fkey;
alter table public.listings
  add constraint listings_category_id_fkey
  foreign key (category_id) references public.categories(id);

alter table public.listings drop constraint if exists listings_subcategory_id_fkey;
alter table public.listings
  add constraint listings_subcategory_id_fkey
  foreign key (subcategory_id) references public.subcategories(id);

alter table public.listings drop constraint if exists listings_governorate_id_fkey;
alter table public.listings
  add constraint listings_governorate_id_fkey
  foreign key (governorate_id) references public.governorates(id);

alter table public.listings drop constraint if exists listings_status_allowed;
alter table public.listings
  add constraint listings_status_allowed
  check (status in ('draft', 'pending_review', 'approved', 'rejected', 'archived'));

alter table public.listings drop constraint if exists listings_currency_allowed;
alter table public.listings
  add constraint listings_currency_allowed
  check (currency = 'SYP');

alter table public.listings drop constraint if exists listings_price_type_allowed;
alter table public.listings
  add constraint listings_price_type_allowed
  check (price_type in ('fixed', 'negotiable', 'contact', 'free', 'exchange'));

alter table public.listings drop constraint if exists listings_condition_allowed;
alter table public.listings
  add constraint listings_condition_allowed
  check (listing_condition in ('new', 'like_new', 'used', 'for_parts', 'not_applicable'));

alter table public.listings drop constraint if exists listings_price_nonnegative;
alter table public.listings
  add constraint listings_price_nonnegative
  check (price is null or price >= 0);

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null,
  alt_ar text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.listing_images alter column storage_path set not null;

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
  name_en text,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.saved_searches add column if not exists name_en text;

create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  report_type text not null,
  reason text not null,
  status text not null default 'new',
  assigned_to uuid references public.profiles(id),
  admin_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'listing_reports' and column_name = 'report_type'
      and data_type = 'USER-DEFINED'
  ) then
    alter table public.listing_reports alter column report_type type text using report_type::text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'listing_reports' and column_name = 'status'
      and data_type = 'USER-DEFINED'
  ) then
    alter table public.listing_reports alter column status drop default;
    alter table public.listing_reports
      alter column status type text
      using case status::text
        when 'under_review' then 'in_review'
        when 'rejected' then 'dismissed'
        else status::text
      end;
    alter table public.listing_reports alter column status set default 'new';
  end if;
end $$;

update public.listing_reports
set status = case status
  when 'under_review' then 'in_review'
  when 'rejected' then 'dismissed'
  else status
end
where status in ('under_review', 'rejected');

alter table public.listing_reports drop constraint if exists listing_reports_status_allowed;
alter table public.listing_reports
  add constraint listing_reports_status_allowed
  check (status in ('new', 'in_review', 'resolved', 'dismissed'));

alter table public.listing_reports drop constraint if exists listing_reports_reason_length;
alter table public.listing_reports
  add constraint listing_reports_reason_length
  check (char_length(reason) between 4 and 1200);

drop trigger if exists categories_touch_updated_at on public.categories;
create trigger categories_touch_updated_at
before update on public.categories
for each row execute function public.touch_updated_at();

drop trigger if exists subcategories_touch_updated_at on public.subcategories;
create trigger subcategories_touch_updated_at
before update on public.subcategories
for each row execute function public.touch_updated_at();

drop trigger if exists governorates_touch_updated_at on public.governorates;
create trigger governorates_touch_updated_at
before update on public.governorates
for each row execute function public.touch_updated_at();

drop trigger if exists listings_touch_updated_at on public.listings;
create trigger listings_touch_updated_at
before update on public.listings
for each row execute function public.touch_updated_at();

drop trigger if exists saved_searches_touch_updated_at on public.saved_searches;
create trigger saved_searches_touch_updated_at
before update on public.saved_searches
for each row execute function public.touch_updated_at();

drop trigger if exists listing_reports_touch_updated_at on public.listing_reports;
create trigger listing_reports_touch_updated_at
before update on public.listing_reports
for each row execute function public.touch_updated_at();

create or replace function public.rawaj_listing_owner_can_write(target_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.listings l
    where l.id = target_listing_id
      and l.owner_id = auth.uid()
      and l.status in ('draft', 'pending_review', 'rejected')
  );
$$;

create or replace function public.rawaj_safe_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.governorates enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.favorites enable row level security;
alter table public.saved_searches enable row level security;
alter table public.listing_reports enable row level security;

drop policy if exists "Public reads active categories" on public.categories;
create policy "Public reads active categories"
on public.categories for select
using (is_active = true);

drop policy if exists "Admin-like reads all categories" on public.categories;
create policy "Admin-like reads all categories"
on public.categories for select
to authenticated
using (public.current_user_is_admin_like());

drop policy if exists "Admin-like manages categories" on public.categories;
drop policy if exists "Owner admins manage categories" on public.categories;
create policy "Admin-like manages categories"
on public.categories for all
to authenticated
using (public.current_user_is_admin_like())
with check (public.current_user_is_admin_like());

drop policy if exists "Public reads active subcategories" on public.subcategories;
create policy "Public reads active subcategories"
on public.subcategories for select
using (
  exists (
    select 1
    from public.categories c
    where c.id = category_id
      and c.is_active = true
  )
);

drop policy if exists "Admin-like reads all subcategories" on public.subcategories;
create policy "Admin-like reads all subcategories"
on public.subcategories for select
to authenticated
using (public.current_user_is_admin_like());

drop policy if exists "Admin-like manages subcategories" on public.subcategories;
create policy "Admin-like manages subcategories"
on public.subcategories for all
to authenticated
using (public.current_user_is_admin_like())
with check (public.current_user_is_admin_like());

drop policy if exists "Public reads active governorates" on public.governorates;
create policy "Public reads active governorates"
on public.governorates for select
using (is_active = true);

drop policy if exists "Admin-like reads all governorates" on public.governorates;
create policy "Admin-like reads all governorates"
on public.governorates for select
to authenticated
using (public.current_user_is_admin_like());

drop policy if exists "Admin-like manages governorates" on public.governorates;
drop policy if exists "Owner admins manage governorates" on public.governorates;
create policy "Admin-like manages governorates"
on public.governorates for all
to authenticated
using (public.current_user_is_admin_like())
with check (public.current_user_is_admin_like());

drop policy if exists "Public reads approved listings" on public.listings;
create policy "Public reads approved listings"
on public.listings for select
using (status = 'approved' and archived_at is null);

drop policy if exists "Listing owners read own listings" on public.listings;
create policy "Listing owners read own listings"
on public.listings for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "Admin-like reads all listings" on public.listings;
create policy "Admin-like reads all listings"
on public.listings for select
to authenticated
using (public.current_user_is_admin_like());

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
  and is_featured = false
  and featured_until is null
  and reviewed_by is null
  and reviewed_at is null
  and published_at is null
  and archived_at is null
);

drop policy if exists "Admin-like moderates listings" on public.listings;
drop policy if exists "Owner admins moderate listings" on public.listings;
create policy "Admin-like moderates listings"
on public.listings for update
to authenticated
using (public.current_user_is_admin_like())
with check (public.current_user_is_admin_like());

drop policy if exists "Listing owners delete draft rejected listings" on public.listings;
create policy "Listing owners delete draft rejected listings"
on public.listings for delete
to authenticated
using (owner_id = auth.uid() and status in ('draft', 'rejected'));

drop policy if exists "Admin-like deletes listings" on public.listings;
create policy "Admin-like deletes listings"
on public.listings for delete
to authenticated
using (public.current_user_is_admin_like());

drop policy if exists "Listing images visible with listing" on public.listing_images;
create policy "Listing images visible with listing"
on public.listing_images for select
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_id
      and l.status = 'approved'
      and l.archived_at is null
  )
);

drop policy if exists "Listing owners read own images" on public.listing_images;
create policy "Listing owners read own images"
on public.listing_images for select
to authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_id
      and l.owner_id = auth.uid()
  )
);

drop policy if exists "Admin-like reads all listing images" on public.listing_images;
create policy "Admin-like reads all listing images"
on public.listing_images for select
to authenticated
using (public.current_user_is_admin_like());

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
using (public.rawaj_listing_owner_can_write(listing_id));

drop policy if exists "Admin-like deletes listing images" on public.listing_images;
create policy "Admin-like deletes listing images"
on public.listing_images for delete
to authenticated
using (public.current_user_is_admin_like());

drop policy if exists "Users manage own favorites" on public.favorites;
drop policy if exists "Users read own favorites" on public.favorites;
create policy "Users read own favorites"
on public.favorites for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users create own favorites" on public.favorites;
create policy "Users create own favorites"
on public.favorites for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.listings l
    where l.id = listing_id
      and l.status = 'approved'
      and l.archived_at is null
  )
);

drop policy if exists "Users delete own favorites" on public.favorites;
create policy "Users delete own favorites"
on public.favorites for delete
to authenticated
using (user_id = auth.uid());

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
  and exists (
    select 1
    from public.listings l
    where l.id = listing_id
      and l.status = 'approved'
      and l.archived_at is null
  )
);

drop policy if exists "Reporters read own listing reports" on public.listing_reports;
create policy "Reporters read own listing reports"
on public.listing_reports for select
to authenticated
using (reporter_id = auth.uid());

drop policy if exists "Admin-like reads listing reports" on public.listing_reports;
drop policy if exists "Owner admins read listing reports" on public.listing_reports;
create policy "Admin-like reads listing reports"
on public.listing_reports for select
to authenticated
using (public.current_user_is_admin_like());

drop policy if exists "Admin-like moderates listing reports" on public.listing_reports;
drop policy if exists "Owner admins moderate listing reports" on public.listing_reports;
create policy "Admin-like moderates listing reports"
on public.listing_reports for update
to authenticated
using (public.current_user_is_admin_like())
with check (public.current_user_is_admin_like());

create index if not exists idx_categories_active_sort on public.categories (is_active, sort_order);
create index if not exists idx_subcategories_category_sort on public.subcategories (category_id, sort_order);
create index if not exists idx_governorates_active_sort on public.governorates (is_active, sort_order);
create index if not exists idx_listings_status_created on public.listings (status, created_at desc);
create index if not exists idx_listings_category on public.listings (category_id);
create index if not exists idx_listings_subcategory on public.listings (subcategory_id);
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
create index if not exists idx_listing_reports_reporter on public.listing_reports (reporter_id, created_at desc);

insert into public.governorates (id, slug, name_ar, name_en, districts_ar, districts_en, sort_order, is_active)
values
  ('damascus', 'damascus', 'دمشق', 'Damascus', array['المزة','كفرسوسة','المالكي','أبو رمانة','باب توما','الشعلان','مشروع دمر','برزة','ركن الدين','دمشق القديمة'], array['Mazzeh','Kafr Sousa','Al-Malki','Abu Rummaneh','Bab Touma','Al-Shaalan','Dummar Project','Barzeh','Rukn Al-Din','Old Damascus'], 10, true),
  ('rif-dimashq', 'rif-dimashq', 'ريف دمشق', 'Rif Dimashq', array['جرمانا','صحنايا','قدسيا','جديدة عرطوز','دوما','داريا','القطيفة','يبرود','النبك'], array['Jaramana','Sahnaya','Qudsaya','Jdeidet Artouz','Douma','Darayya','Al-Qutayfah','Yabroud','Al-Nabek'], 20, true),
  ('aleppo', 'aleppo', 'حلب', 'Aleppo', array['الحمدانية','الفرقان','الجميلية','حلب الجديدة','المحافظة','السريان','الشهباء','باب الفرج'], array['Al-Hamadaniyah','Al-Furqan','Al-Jamiliyah','New Aleppo','Al-Muhafaza','Al-Suryan','Al-Shahba','Bab Al-Faraj'], 30, true),
  ('homs', 'homs', 'حمص', 'Homs', array['الوعر','الحمراء','عكرمة','الإنشاءات','الزهراء'], array['Al-Waer','Al-Hamra','Ikrimah','Al-Insha''at','Al-Zahra'], 40, true),
  ('hama', 'hama', 'حماة', 'Hama', array['الحاضر','البرناوي','طريق حلب','جنوب الملعب'], array['Al-Hader','Al-Barnawi','Aleppo Road','South Stadium'], 50, true),
  ('latakia', 'latakia', 'اللاذقية', 'Latakia', array['المشروع السابع','الرمل الجنوبي','الزراعة','الصليبة','الشيخ ضاهر'], array['Seventh Project','Southern Raml','Al-Ziraah','Al-Salibah','Sheikh Daher'], 60, true),
  ('tartus', 'tartus', 'طرطوس', 'Tartus', array['الكورنيش','الرمل','المشروع السادس','الدريكيش','صافيتا'], array['Corniche','Al-Raml','Sixth Project','Al-Dreikish','Safita'], 70, true),
  ('idlib', 'idlib', 'إدلب', 'Idlib', array['إدلب المدينة','أريحا','جسر الشغور','معرة مصرين'], array['Idlib City','Ariha','Jisr Al-Shughur','Maarat Misrin'], 80, true),
  ('deir-ez-zor', 'deir-ez-zor', 'دير الزور', 'Deir ez-Zor', array['دير الزور المدينة','الميادين','البوكمال'], array['Deir ez-Zor City','Al-Mayadin','Al-Bukamal'], 90, true),
  ('raqqa', 'raqqa', 'الرقة', 'Raqqa', array['الرقة المدينة','الطبقة'], array['Raqqa City','Al-Thawrah'], 100, true),
  ('hasakah', 'hasakah', 'الحسكة', 'Al-Hasakah', array['الحسكة المدينة','القامشلي','المالكية','عامودا'], array['Al-Hasakah City','Qamishli','Al-Malikiyah','Amuda'], 110, true),
  ('daraa', 'daraa', 'درعا', 'Daraa', array['درعا البلد','درعا المحطة','الصنمين','إزرع'], array['Daraa Al-Balad','Daraa Al-Mahatta','Al-Sanamayn','Izra'], 120, true),
  ('suwayda', 'suwayda', 'السويداء', 'As-Suwayda', array['السويداء المدينة','شهبا','صلخد'], array['As-Suwayda City','Shahba','Salkhad'], 130, true),
  ('quneitra', 'quneitra', 'القنيطرة', 'Quneitra', array['القنيطرة','خان أرنبة'], array['Quneitra','Khan Arnabah'], 140, true)
on conflict (id) do update set
  slug = excluded.slug,
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  districts_ar = excluded.districts_ar,
  districts_en = excluded.districts_en,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

insert into public.categories (id, slug, name_ar, name_en, hint_ar, hint_en, placeholder, sort_order, is_active)
values
  ('cars', 'cars', 'سيارات ومركبات', 'Cars and vehicles', 'سيارات وقطع غيار ومركبات', 'Cars, spare parts, and vehicles', 'car', 10, true),
  ('realestate', 'realestate', 'عقارات', 'Real estate', 'بيع وإيجار ومكاتب وأراضي', 'Sales, rentals, offices, and land', 'realestate', 20, true),
  ('mobiles', 'mobiles', 'موبايلات وتابلت', 'Mobiles and tablets', 'أجهزة وإكسسوارات', 'Devices and accessories', 'phone', 30, true),
  ('electronics', 'electronics', 'إلكترونيات', 'Electronics', 'لابتوبات وشاشات وأجهزة', 'Laptops, screens, and devices', 'electronics', 40, true),
  ('furniture', 'furniture', 'منزل وأثاث', 'Home and furniture', 'منزل ومكتب وديكور', 'Home, office, and decor', 'furniture', 50, true),
  ('jobs', 'jobs', 'وظائف', 'Jobs', 'فرص عمل وباحثين عن عمل', 'Open roles and job seekers', 'job', 60, true),
  ('services', 'services', 'خدمات', 'Services', 'صيانة ونقل وتنظيف وتصميم', 'Maintenance, delivery, cleaning, and design', 'service', 70, true),
  ('fashion', 'fashion', 'أزياء ومستلزمات', 'Fashion and accessories', 'ملابس وساعات وعطور وإكسسوارات', 'Clothing, watches, perfumes, and accessories', 'fashion', 80, true),
  ('food', 'food', 'أطعمة ومنتجات محلية', 'Food and local products', 'منتجات محلية ومواد غذائية', 'Local products and food items', 'food', 90, true),
  ('animals', 'animals', 'حيوانات ومواشي', 'Animals and livestock', 'مواشي وطيور ومستلزمات', 'Livestock, birds, and supplies', 'animals', 100, true),
  ('education', 'education', 'تعليم ودورات', 'Education and courses', 'دورات ومدرسين وتدريب', 'Courses, tutors, and training', 'education', 110, true),
  ('business', 'business', 'أعمال وصناعة', 'Business and industry', 'معدات ومحلات ومشاريع', 'Equipment, shops, and projects', 'business', 120, true),
  ('misc', 'misc', 'المزيد', 'More', 'إعلانات متنوعة', 'Various listings', 'misc', 130, true)
on conflict (id) do update set
  slug = excluded.slug,
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  hint_ar = excluded.hint_ar,
  hint_en = excluded.hint_en,
  placeholder = excluded.placeholder,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

insert into public.subcategories (id, category_id, name_ar, name_en, sort_order)
values
  ('cars-sale', 'cars', 'سيارات للبيع', 'Cars for sale', 10),
  ('cars-rent', 'cars', 'سيارات للإيجار', 'Cars for rent', 20),
  ('cars-parts', 'cars', 'قطع غيار', 'Spare parts', 30),
  ('cars-motorcycles', 'cars', 'دبابات', 'Motorcycles', 40),
  ('cars-trucks', 'cars', 'شاحنات', 'Trucks', 50),
  ('cars-heavy-equipment', 'cars', 'معدات ثقيلة', 'Heavy equipment', 60),
  ('cars-agriculture', 'cars', 'آليات زراعية', 'Agricultural vehicles', 70),
  ('cars-services', 'cars', 'خدمات سيارات', 'Car services', 80),
  ('realestate-apartments-sale', 'realestate', 'شقق للبيع', 'Apartments for sale', 10),
  ('realestate-apartments-rent', 'realestate', 'شقق للإيجار', 'Apartments for rent', 20),
  ('realestate-houses-sale', 'realestate', 'بيوت للبيع', 'Houses for sale', 30),
  ('realestate-houses-rent', 'realestate', 'بيوت للإيجار', 'Houses for rent', 40),
  ('realestate-villas', 'realestate', 'فلل', 'Villas', 50),
  ('realestate-land', 'realestate', 'أراضي', 'Land', 60),
  ('realestate-shops', 'realestate', 'محلات', 'Shops', 70),
  ('realestate-offices', 'realestate', 'مكاتب', 'Offices', 80),
  ('realestate-warehouses', 'realestate', 'مستودعات', 'Warehouses', 90),
  ('realestate-farms', 'realestate', 'مزارع', 'Farms', 100),
  ('realestate-commercial', 'realestate', 'عقار تجاري', 'Commercial real estate', 110),
  ('mobiles-iphone', 'mobiles', 'iPhone', 'iPhone', 10),
  ('mobiles-samsung', 'mobiles', 'Samsung', 'Samsung', 20),
  ('mobiles-xiaomi', 'mobiles', 'Xiaomi', 'Xiaomi', 30),
  ('mobiles-huawei', 'mobiles', 'Huawei', 'Huawei', 40),
  ('mobiles-oppo', 'mobiles', 'Oppo', 'Oppo', 50),
  ('mobiles-tablets', 'mobiles', 'تابلت', 'Tablets', 60),
  ('mobiles-accessories', 'mobiles', 'إكسسوارات', 'Accessories', 70),
  ('mobiles-parts', 'mobiles', 'قطع غيار', 'Spare parts', 80),
  ('electronics-laptops', 'electronics', 'لابتوبات', 'Laptops', 10),
  ('electronics-desktops', 'electronics', 'حواسيب مكتبية', 'Desktop computers', 20),
  ('electronics-tvs', 'electronics', 'تلفزيونات', 'Televisions', 30),
  ('electronics-gaming', 'electronics', 'أجهزة ألعاب', 'Gaming devices', 40),
  ('electronics-cameras', 'electronics', 'كاميرات', 'Cameras', 50),
  ('electronics-audio', 'electronics', 'أجهزة صوت', 'Audio devices', 60),
  ('electronics-smartwatches', 'electronics', 'ساعات ذكية', 'Smart watches', 70),
  ('electronics-home-appliances', 'electronics', 'أجهزة منزلية', 'Home appliances', 80),
  ('furniture-bedrooms', 'furniture', 'غرف نوم', 'Bedrooms', 10),
  ('furniture-living-rooms', 'furniture', 'غرف معيشة', 'Living rooms', 20),
  ('furniture-sofas', 'furniture', 'كنب', 'Sofas', 30),
  ('furniture-tables', 'furniture', 'طاولات', 'Tables', 40),
  ('furniture-chairs', 'furniture', 'كراسي', 'Chairs', 50),
  ('furniture-kitchens', 'furniture', 'مطابخ', 'Kitchens', 60),
  ('furniture-curtains', 'furniture', 'ستائر', 'Curtains', 70),
  ('furniture-rugs', 'furniture', 'سجاد', 'Rugs', 80),
  ('furniture-decor', 'furniture', 'ديكور', 'Decor', 90),
  ('furniture-garden', 'furniture', 'أثاث حدائق', 'Garden furniture', 100),
  ('furniture-office', 'furniture', 'أثاث مكتبي', 'Office furniture', 110),
  ('jobs-full-time', 'jobs', 'دوام كامل', 'Full-time', 10),
  ('jobs-part-time', 'jobs', 'دوام جزئي', 'Part-time', 20),
  ('jobs-remote', 'jobs', 'عمل عن بعد', 'Remote work', 30),
  ('jobs-freelance', 'jobs', 'عمل حر', 'Freelance', 40),
  ('jobs-training', 'jobs', 'تدريب', 'Training', 50),
  ('jobs-seekers', 'jobs', 'باحثون عن عمل', 'Job seekers', 60),
  ('services-delivery', 'services', 'توصيل', 'Delivery', 10),
  ('services-moving', 'services', 'نقل', 'Moving', 20),
  ('services-cleaning', 'services', 'تنظيف', 'Cleaning', 30),
  ('services-maintenance', 'services', 'صيانة', 'Maintenance', 40),
  ('services-plumbing', 'services', 'سباكة', 'Plumbing', 50),
  ('services-electricity', 'services', 'كهرباء', 'Electrical', 60),
  ('services-cars', 'services', 'خدمات سيارات', 'Car services', 70),
  ('services-realestate', 'services', 'خدمات عقارية', 'Real estate services', 80),
  ('services-design', 'services', 'تصميم', 'Design', 90),
  ('services-programming', 'services', 'برمجة', 'Programming', 100),
  ('services-marketing', 'services', 'تسويق', 'Marketing', 110),
  ('services-photography', 'services', 'تصوير', 'Photography', 120),
  ('services-tutoring', 'services', 'دروس خصوصية', 'Private tutoring', 130),
  ('fashion-men', 'fashion', 'ملابس رجالية', 'Men''s clothing', 10),
  ('fashion-women', 'fashion', 'ملابس نسائية', 'Women''s clothing', 20),
  ('fashion-kids', 'fashion', 'ملابس أطفال', 'Children''s clothing', 30),
  ('fashion-shoes', 'fashion', 'أحذية', 'Shoes', 40),
  ('fashion-watches', 'fashion', 'ساعات', 'Watches', 50),
  ('fashion-perfumes', 'fashion', 'عطور', 'Perfumes', 60),
  ('fashion-bags', 'fashion', 'حقائب', 'Bags', 70),
  ('fashion-accessories', 'fashion', 'إكسسوارات', 'Accessories', 80),
  ('food-homemade', 'food', 'طعام منزلي', 'Homemade food', 10),
  ('food-sweets', 'food', 'حلويات', 'Sweets', 20),
  ('food-honey', 'food', 'عسل', 'Honey', 30),
  ('food-olive-oil', 'food', 'زيت زيتون', 'Olive oil', 40),
  ('food-coffee', 'food', 'قهوة', 'Coffee', 50),
  ('food-dates', 'food', 'تمر', 'Dates', 60),
  ('food-local-products', 'food', 'منتجات محلية', 'Local products', 70),
  ('animals-sheep', 'animals', 'أغنام', 'Sheep', 10),
  ('animals-cattle', 'animals', 'أبقار', 'Cattle', 20),
  ('animals-birds', 'animals', 'طيور', 'Birds', 30),
  ('animals-cats', 'animals', 'قطط', 'Cats', 40),
  ('animals-dogs', 'animals', 'كلاب', 'Dogs', 50),
  ('animals-supplies', 'animals', 'مستلزمات حيوانات', 'Animal supplies', 60),
  ('education-languages', 'education', 'دورات لغات', 'Language courses', 10),
  ('education-university', 'education', 'دورات جامعية', 'University courses', 20),
  ('education-school-support', 'education', 'دعم مدرسي', 'School support', 30),
  ('education-online', 'education', 'دورات أونلاين', 'Online courses', 40),
  ('education-centers', 'education', 'مراكز تدريب', 'Training centers', 50),
  ('education-tutors', 'education', 'مدرسون خصوصيون', 'Private tutors', 60),
  ('business-equipment', 'business', 'معدات', 'Equipment', 10),
  ('business-machines', 'business', 'مكائن', 'Machines', 20),
  ('business-wholesale', 'business', 'منتجات بالجملة', 'Wholesale products', 30),
  ('business-shop-supplies', 'business', 'مستلزمات محلات', 'Shop supplies', 40),
  ('business-restaurant-equipment', 'business', 'معدات مطاعم', 'Restaurant equipment', 50),
  ('business-shops-sale', 'business', 'محلات للبيع', 'Shops for sale', 60),
  ('misc-various', 'misc', 'متفرقات', 'Various', 10),
  ('misc-gifts', 'misc', 'هدايا', 'Gifts', 20),
  ('misc-games', 'misc', 'ألعاب', 'Games', 30),
  ('misc-books', 'misc', 'كتب', 'Books', 40)
on conflict (id) do update set
  category_id = excluded.category_id,
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  sort_order = excluded.sort_order;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'listing-images',
      'listing-images',
      false,
      5242880,
      array['image/jpeg', 'image/png', 'image/webp']
    )
    on conflict (id) do update set
      public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'objects'
  ) then
    execute 'drop policy if exists "Authenticated users upload own listing images" on storage.objects';
    execute 'drop policy if exists "Authenticated users read own listing images" on storage.objects';
    execute 'drop policy if exists "Authenticated users update own listing images" on storage.objects';
    execute 'drop policy if exists "Authenticated users delete own listing images" on storage.objects';
    execute 'drop policy if exists "Admin-like reads all listing image objects" on storage.objects';
    execute 'drop policy if exists "Admin-like deletes listing image objects" on storage.objects';

    execute $policy$
      create policy "Authenticated users upload own listing images"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'listing-images'
        and (storage.foldername(name))[1] = auth.uid()::text
        and public.rawaj_safe_uuid((storage.foldername(name))[2]) is not null
        and exists (
          select 1
          from public.listings l
          where l.id = public.rawaj_safe_uuid((storage.foldername(name))[2])
            and l.owner_id = auth.uid()
            and l.status in ('draft', 'pending_review', 'rejected')
        )
      )
    $policy$;

    execute $policy$
      create policy "Authenticated users read own listing images"
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'listing-images'
        and (storage.foldername(name))[1] = auth.uid()::text
        and public.rawaj_safe_uuid((storage.foldername(name))[2]) is not null
        and exists (
          select 1
          from public.listings l
          where l.id = public.rawaj_safe_uuid((storage.foldername(name))[2])
            and l.owner_id = auth.uid()
        )
      )
    $policy$;

    execute $policy$
      create policy "Authenticated users update own listing images"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'listing-images'
        and (storage.foldername(name))[1] = auth.uid()::text
        and public.rawaj_safe_uuid((storage.foldername(name))[2]) is not null
        and exists (
          select 1
          from public.listings l
          where l.id = public.rawaj_safe_uuid((storage.foldername(name))[2])
            and l.owner_id = auth.uid()
            and l.status in ('draft', 'pending_review', 'rejected')
        )
      )
      with check (
        bucket_id = 'listing-images'
        and (storage.foldername(name))[1] = auth.uid()::text
        and public.rawaj_safe_uuid((storage.foldername(name))[2]) is not null
        and exists (
          select 1
          from public.listings l
          where l.id = public.rawaj_safe_uuid((storage.foldername(name))[2])
            and l.owner_id = auth.uid()
            and l.status in ('draft', 'pending_review', 'rejected')
        )
      )
    $policy$;

    execute $policy$
      create policy "Authenticated users delete own listing images"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'listing-images'
        and (storage.foldername(name))[1] = auth.uid()::text
        and public.rawaj_safe_uuid((storage.foldername(name))[2]) is not null
        and exists (
          select 1
          from public.listings l
          where l.id = public.rawaj_safe_uuid((storage.foldername(name))[2])
            and l.owner_id = auth.uid()
            and l.status in ('draft', 'pending_review', 'rejected')
        )
      )
    $policy$;

    execute $policy$
      create policy "Admin-like reads all listing image objects"
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'listing-images'
        and public.current_user_is_admin_like()
      )
    $policy$;

    execute $policy$
      create policy "Admin-like deletes listing image objects"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'listing-images'
        and public.current_user_is_admin_like()
      )
    $policy$;
  end if;
end $$;