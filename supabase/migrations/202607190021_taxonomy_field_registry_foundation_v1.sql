-- RAWAJ Taxonomy, Data & Search Foundation V1: stable option, field, and leaf-rule registry.
-- Depends on 202607190020_taxonomy_governance_foundation_v1.sql.

create table if not exists public.option_sets (
  key text primary key,
  name_ar text not null,
  name_en text,
  description_ar text,
  description_en text,
  provider_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint option_sets_key_format check (key ~ '^[a-z][a-z0-9_]*$')
);

create table if not exists public.option_values (
  option_set_key text not null references public.option_sets(key) on delete cascade,
  value_key text not null,
  label_ar text not null,
  label_en text,
  aliases text[] not null default '{}'::text[],
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (option_set_key, value_key),
  constraint option_values_key_format check (value_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint option_values_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists option_values_active_sort_idx
  on public.option_values(option_set_key, sort_order, value_key)
  where is_active;

create table if not exists public.field_definitions (
  key text primary key,
  label_ar text not null,
  label_en text,
  description_ar text,
  description_en text,
  placeholder_ar text,
  placeholder_en text,
  field_type text not null,
  unit_key text,
  option_set_key text references public.option_sets(key) on delete restrict,
  data_provider_key text,
  validation_schema jsonb not null default '{}'::jsonb,
  is_searchable boolean not null default false,
  is_filterable boolean not null default false,
  is_displayable boolean not null default true,
  is_sensitive boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_definitions_key_format check (key ~ '^[a-z][a-z0-9_]*$'),
  constraint field_definitions_type_check check (
    field_type in (
      'text', 'textarea', 'integer', 'numeric', 'boolean', 'date', 'year',
      'single_select', 'multi_select', 'reference', 'location'
    )
  ),
  constraint field_definitions_validation_object check (
    jsonb_typeof(validation_schema) = 'object'
  ),
  constraint field_definitions_source_check check (
    not (option_set_key is not null and data_provider_key is not null)
  )
);

create index if not exists field_definitions_active_sort_idx
  on public.field_definitions(sort_order, key)
  where is_active;

create table if not exists public.taxonomy_field_rules (
  version_id uuid not null,
  taxonomy_node_id text not null,
  field_key text not null references public.field_definitions(key) on delete restrict,
  group_key text,
  sort_order integer not null default 0,
  is_required boolean not null default false,
  is_searchable boolean not null default false,
  is_filterable boolean not null default false,
  is_displayable boolean not null default true,
  display_surfaces text[] not null default array['listing_detail']::text[],
  validation_override jsonb not null default '{}'::jsonb,
  default_value jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (version_id, taxonomy_node_id, field_key),
  constraint taxonomy_field_rules_node_fkey
    foreign key (version_id, taxonomy_node_id)
    references public.taxonomy_version_nodes(version_id, node_id)
    on delete cascade,
  constraint taxonomy_field_rules_validation_object check (
    jsonb_typeof(validation_override) = 'object'
  ),
  constraint taxonomy_field_rules_surfaces_check check (
    display_surfaces <@ array[
      'listing_card', 'listing_detail', 'listing_studio', 'search_filter', 'comparison'
    ]::text[]
  )
);

create index if not exists taxonomy_field_rules_node_sort_idx
  on public.taxonomy_field_rules(version_id, taxonomy_node_id, sort_order, field_key);

create table if not exists public.field_conditional_rules (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null,
  taxonomy_node_id text not null,
  trigger_field_key text not null references public.field_definitions(key) on delete restrict,
  operator text not null,
  trigger_value jsonb,
  target_field_key text not null references public.field_definitions(key) on delete restrict,
  effect text not null,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_conditional_rules_node_fkey
    foreign key (version_id, taxonomy_node_id)
    references public.taxonomy_version_nodes(version_id, node_id)
    on delete cascade,
  constraint field_conditional_rules_operator_check check (
    operator in ('equals', 'not_equals', 'in', 'not_in', 'is_true', 'is_false', 'is_empty', 'is_not_empty')
  ),
  constraint field_conditional_rules_effect_check check (
    effect in ('show', 'hide', 'require', 'optional', 'clear')
  ),
  constraint field_conditional_rules_not_self check (trigger_field_key <> target_field_key)
);

create index if not exists field_conditional_rules_node_priority_idx
  on public.field_conditional_rules(version_id, taxonomy_node_id, priority, id)
  where is_active;

-- Register baseline option sets. Values are stable keys; labels can be edited later
-- through the governed administration path without changing listing payloads.
insert into public.option_sets (key, name_ar, name_en)
values
  ('listing_condition', 'حالة العنصر', 'Listing condition'),
  ('vehicle_fuel_type', 'نوع الوقود', 'Vehicle fuel type'),
  ('vehicle_transmission', 'ناقل الحركة', 'Vehicle transmission'),
  ('vehicle_body_type', 'نوع الهيكل', 'Vehicle body type'),
  ('property_purpose', 'غرض العقار', 'Property purpose'),
  ('property_type', 'نوع العقار', 'Property type'),
  ('employment_type', 'نوع الدوام', 'Employment type'),
  ('salary_period', 'دورية الراتب', 'Salary period'),
  ('remote_mode', 'نمط العمل', 'Remote mode'),
  ('rental_period', 'مدة الإيجار', 'Rental period')
on conflict (key) do update set
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  updated_at = now();

insert into public.option_values (option_set_key, value_key, label_ar, label_en, sort_order)
values
  ('listing_condition', 'new', 'جديد', 'New', 10),
  ('listing_condition', 'like_new', 'كالجديد', 'Like new', 20),
  ('listing_condition', 'good', 'جيد', 'Good', 30),
  ('listing_condition', 'fair', 'مقبول', 'Fair', 40),
  ('listing_condition', 'for_parts', 'للقطع', 'For parts', 50),
  ('vehicle_fuel_type', 'petrol', 'بنزين', 'Petrol', 10),
  ('vehicle_fuel_type', 'diesel', 'ديزل', 'Diesel', 20),
  ('vehicle_fuel_type', 'hybrid', 'هجين', 'Hybrid', 30),
  ('vehicle_fuel_type', 'electric', 'كهربائي', 'Electric', 40),
  ('vehicle_fuel_type', 'lpg', 'غاز', 'LPG', 50),
  ('vehicle_fuel_type', 'other', 'أخرى', 'Other', 90),
  ('vehicle_transmission', 'manual', 'يدوي', 'Manual', 10),
  ('vehicle_transmission', 'automatic', 'أوتوماتيك', 'Automatic', 20),
  ('vehicle_transmission', 'cvt', 'CVT', 'CVT', 30),
  ('vehicle_transmission', 'semi_automatic', 'نصف أوتوماتيك', 'Semi-automatic', 40),
  ('vehicle_transmission', 'other', 'أخرى', 'Other', 90),
  ('vehicle_body_type', 'sedan', 'سيدان', 'Sedan', 10),
  ('vehicle_body_type', 'suv', 'دفع رباعي / SUV', 'SUV', 20),
  ('vehicle_body_type', 'hatchback', 'هاتشباك', 'Hatchback', 30),
  ('vehicle_body_type', 'coupe', 'كوبيه', 'Coupe', 40),
  ('vehicle_body_type', 'pickup', 'بيك أب', 'Pickup', 50),
  ('vehicle_body_type', 'van', 'فان', 'Van', 60),
  ('vehicle_body_type', 'minivan', 'ميني فان', 'Minivan', 70),
  ('vehicle_body_type', 'wagon', 'ستيشن', 'Wagon', 80),
  ('vehicle_body_type', 'convertible', 'مكشوفة', 'Convertible', 90),
  ('vehicle_body_type', 'bus', 'حافلة', 'Bus', 100),
  ('vehicle_body_type', 'truck', 'شاحنة', 'Truck', 110),
  ('vehicle_body_type', 'heavy_equipment', 'معدات ثقيلة', 'Heavy equipment', 120),
  ('vehicle_body_type', 'other', 'أخرى', 'Other', 190),
  ('property_purpose', 'sale', 'للبيع', 'For sale', 10),
  ('property_purpose', 'rent', 'للإيجار', 'For rent', 20),
  ('property_purpose', 'wanted', 'مطلوب', 'Wanted', 30),
  ('property_type', 'apartment', 'شقة', 'Apartment', 10),
  ('property_type', 'house', 'منزل', 'House', 20),
  ('property_type', 'villa', 'فيلا', 'Villa', 30),
  ('property_type', 'land', 'أرض', 'Land', 40),
  ('property_type', 'shop', 'محل', 'Shop', 50),
  ('property_type', 'office', 'مكتب', 'Office', 60),
  ('property_type', 'warehouse', 'مستودع', 'Warehouse', 70),
  ('property_type', 'building', 'بناء', 'Building', 80),
  ('property_type', 'farm', 'مزرعة', 'Farm', 90),
  ('property_type', 'other', 'أخرى', 'Other', 190),
  ('employment_type', 'full_time', 'دوام كامل', 'Full-time', 10),
  ('employment_type', 'part_time', 'دوام جزئي', 'Part-time', 20),
  ('employment_type', 'contract', 'عقد', 'Contract', 30),
  ('employment_type', 'temporary', 'مؤقت', 'Temporary', 40),
  ('employment_type', 'internship', 'تدريب', 'Internship', 50),
  ('employment_type', 'freelance', 'عمل حر', 'Freelance', 60),
  ('salary_period', 'hourly', 'بالساعة', 'Hourly', 10),
  ('salary_period', 'daily', 'يومي', 'Daily', 20),
  ('salary_period', 'weekly', 'أسبوعي', 'Weekly', 30),
  ('salary_period', 'monthly', 'شهري', 'Monthly', 40),
  ('salary_period', 'yearly', 'سنوي', 'Yearly', 50),
  ('remote_mode', 'onsite', 'حضوري', 'On-site', 10),
  ('remote_mode', 'remote', 'عن بعد', 'Remote', 20),
  ('remote_mode', 'hybrid', 'هجين', 'Hybrid', 30),
  ('rental_period', 'daily', 'يومي', 'Daily', 10),
  ('rental_period', 'weekly', 'أسبوعي', 'Weekly', 20),
  ('rental_period', 'monthly', 'شهري', 'Monthly', 30),
  ('rental_period', 'yearly', 'سنوي', 'Yearly', 40)
on conflict (option_set_key, value_key) do update set
  label_ar = excluded.label_ar,
  label_en = excluded.label_en,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.field_definitions (
  key, label_ar, label_en, field_type, unit_key, option_set_key, data_provider_key,
  validation_schema, is_searchable, is_filterable, is_displayable, sort_order
)
values
  ('listing_condition', 'حالة العنصر', 'Condition', 'single_select', null, 'listing_condition', null, '{}'::jsonb, true, true, true, 10),
  ('vehicle_make', 'الشركة المصنعة', 'Make', 'reference', null, null, 'vehicle_makes', '{}'::jsonb, true, true, true, 100),
  ('vehicle_model', 'الموديل', 'Model', 'reference', null, null, 'vehicle_models_by_make', '{}'::jsonb, true, true, true, 110),
  ('vehicle_generation', 'الجيل', 'Generation', 'reference', null, null, 'vehicle_generations_by_model', '{}'::jsonb, true, true, true, 120),
  ('vehicle_trim', 'الفئة / التجهيز', 'Trim', 'reference', null, null, 'vehicle_trims_by_model', '{}'::jsonb, true, true, true, 130),
  ('vehicle_year', 'سنة الصنع', 'Model year', 'year', 'year', null, null, '{"minimum":1886,"maximum":2100}'::jsonb, true, true, true, 140),
  ('mileage_km', 'المسافة المقطوعة', 'Mileage', 'integer', 'km', null, null, '{"minimum":0,"maximum":5000000}'::jsonb, true, true, true, 150),
  ('vehicle_fuel_type', 'نوع الوقود', 'Fuel type', 'single_select', null, 'vehicle_fuel_type', null, '{}'::jsonb, true, true, true, 160),
  ('vehicle_transmission', 'ناقل الحركة', 'Transmission', 'single_select', null, 'vehicle_transmission', null, '{}'::jsonb, true, true, true, 170),
  ('vehicle_body_type', 'نوع الهيكل', 'Body type', 'single_select', null, 'vehicle_body_type', null, '{}'::jsonb, true, true, true, 180),
  ('engine_size_cc', 'حجم المحرك', 'Engine size', 'integer', 'cc', null, null, '{"minimum":0,"maximum":20000}'::jsonb, false, true, true, 190),
  ('exterior_color', 'اللون الخارجي', 'Exterior color', 'text', null, null, null, '{"maxLength":80}'::jsonb, true, true, true, 200),
  ('exchange_allowed', 'يقبل التبديل', 'Exchange accepted', 'boolean', null, null, null, '{}'::jsonb, false, true, true, 210),
  ('property_purpose', 'غرض العقار', 'Property purpose', 'single_select', null, 'property_purpose', null, '{}'::jsonb, true, true, true, 300),
  ('property_type', 'نوع العقار', 'Property type', 'single_select', null, 'property_type', null, '{}'::jsonb, true, true, true, 310),
  ('area_sqm', 'المساحة', 'Area', 'numeric', 'sqm', null, null, '{"minimum":0,"maximum":100000000}'::jsonb, true, true, true, 320),
  ('bedrooms', 'غرف النوم', 'Bedrooms', 'integer', null, null, null, '{"minimum":0,"maximum":100}'::jsonb, false, true, true, 330),
  ('bathrooms', 'الحمامات', 'Bathrooms', 'integer', null, null, null, '{"minimum":0,"maximum":100}'::jsonb, false, true, true, 340),
  ('floor_number', 'الطابق', 'Floor', 'integer', null, null, null, '{"minimum":-10,"maximum":300}'::jsonb, false, true, true, 350),
  ('furnished', 'مفروش', 'Furnished', 'boolean', null, null, null, '{}'::jsonb, false, true, true, 360),
  ('rental_period', 'مدة الإيجار', 'Rental period', 'single_select', null, 'rental_period', null, '{}'::jsonb, false, true, true, 370),
  ('electronics_brand', 'العلامة التجارية', 'Brand', 'text', null, null, null, '{"maxLength":100}'::jsonb, true, true, true, 400),
  ('electronics_model', 'الموديل', 'Model', 'text', null, null, null, '{"maxLength":120}'::jsonb, true, true, true, 410),
  ('storage_gb', 'سعة التخزين', 'Storage', 'integer', 'gb', null, null, '{"minimum":0,"maximum":1000000}'::jsonb, false, true, true, 420),
  ('memory_gb', 'الذاكرة', 'Memory', 'integer', 'gb', null, null, '{"minimum":0,"maximum":100000}'::jsonb, false, true, true, 430),
  ('job_title', 'المسمى الوظيفي', 'Job title', 'text', null, null, null, '{"minLength":2,"maxLength":160}'::jsonb, true, true, true, 500),
  ('employment_type', 'نوع الدوام', 'Employment type', 'single_select', null, 'employment_type', null, '{}'::jsonb, true, true, true, 510),
  ('salary_min', 'الراتب الأدنى', 'Minimum salary', 'numeric', null, null, null, '{"minimum":0}'::jsonb, false, true, true, 520),
  ('salary_max', 'الراتب الأعلى', 'Maximum salary', 'numeric', null, null, null, '{"minimum":0}'::jsonb, false, true, true, 530),
  ('salary_period', 'دورية الراتب', 'Salary period', 'single_select', null, 'salary_period', null, '{}'::jsonb, false, true, true, 540),
  ('experience_years', 'سنوات الخبرة', 'Years of experience', 'numeric', 'year', null, null, '{"minimum":0,"maximum":80}'::jsonb, false, true, true, 550),
  ('remote_mode', 'نمط العمل', 'Remote mode', 'single_select', null, 'remote_mode', null, '{}'::jsonb, true, true, true, 560),
  ('service_type', 'نوع الخدمة', 'Service type', 'text', null, null, null, '{"minLength":2,"maxLength":160}'::jsonb, true, true, true, 600),
  ('service_area', 'منطقة الخدمة', 'Service area', 'location', null, null, 'location_nodes', '{}'::jsonb, true, true, true, 610),
  ('starting_price', 'السعر الابتدائي', 'Starting price', 'numeric', null, null, null, '{"minimum":0}'::jsonb, false, true, true, 620)
on conflict (key) do update set
  label_ar = excluded.label_ar,
  label_en = excluded.label_en,
  field_type = excluded.field_type,
  unit_key = excluded.unit_key,
  option_set_key = excluded.option_set_key,
  data_provider_key = excluded.data_provider_key,
  validation_schema = excluded.validation_schema,
  is_searchable = excluded.is_searchable,
  is_filterable = excluded.is_filterable,
  is_displayable = excluded.is_displayable,
  sort_order = excluded.sort_order,
  updated_at = now();
