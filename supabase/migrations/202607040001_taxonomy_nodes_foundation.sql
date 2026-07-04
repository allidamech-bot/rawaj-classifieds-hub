-- RAWAJ taxonomy foundation.
-- Manual review required. Do not apply automatically from frontend tooling.

create table if not exists public.taxonomy_nodes (
  id text primary key,
  parent_id text references public.taxonomy_nodes(id) on delete restrict,
  slug text not null unique,
  name_ar text not null,
  name_en text,
  description_ar text,
  description_en text,
  icon_key text,
  sort_order integer not null default 0,
  depth integer not null default 0,
  is_active boolean not null default true,
  is_leaf boolean not null default false,
  filter_schema_key text,
  classification_key text,
  classification_value text,
  legacy_category_id text references public.categories(id) on delete set null,
  legacy_subcategory_id text references public.subcategories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.taxonomy_nodes add column if not exists id text;
alter table public.taxonomy_nodes add column if not exists parent_id text;
alter table public.taxonomy_nodes add column if not exists slug text;
alter table public.taxonomy_nodes add column if not exists name_ar text;
alter table public.taxonomy_nodes add column if not exists name_en text;
alter table public.taxonomy_nodes add column if not exists description_ar text;
alter table public.taxonomy_nodes add column if not exists description_en text;
alter table public.taxonomy_nodes add column if not exists icon_key text;
alter table public.taxonomy_nodes add column if not exists sort_order integer not null default 0;
alter table public.taxonomy_nodes add column if not exists depth integer not null default 0;
alter table public.taxonomy_nodes add column if not exists is_active boolean not null default true;
alter table public.taxonomy_nodes add column if not exists is_leaf boolean not null default false;
alter table public.taxonomy_nodes add column if not exists filter_schema_key text;
alter table public.taxonomy_nodes add column if not exists classification_key text;
alter table public.taxonomy_nodes add column if not exists classification_value text;
alter table public.taxonomy_nodes add column if not exists legacy_category_id text;
alter table public.taxonomy_nodes add column if not exists legacy_subcategory_id text;
alter table public.taxonomy_nodes add column if not exists created_at timestamptz not null default now();
alter table public.taxonomy_nodes add column if not exists updated_at timestamptz not null default now();

do $$
declare
  expected record;
begin
  for expected in
    select *
    from (values
      ('id', 'text'),
      ('parent_id', 'text'),
      ('slug', 'text'),
      ('name_ar', 'text'),
      ('name_en', 'text'),
      ('description_ar', 'text'),
      ('description_en', 'text'),
      ('icon_key', 'text'),
      ('sort_order', 'integer'),
      ('depth', 'integer'),
      ('is_active', 'boolean'),
      ('is_leaf', 'boolean'),
      ('filter_schema_key', 'text'),
      ('classification_key', 'text'),
      ('classification_value', 'text'),
      ('legacy_category_id', 'text'),
      ('legacy_subcategory_id', 'text'),
      ('created_at', 'timestamp with time zone'),
      ('updated_at', 'timestamp with time zone')
    ) as columns(column_name, data_type)
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'taxonomy_nodes'
        and column_name = expected.column_name
        and data_type <> expected.data_type
    ) then
      raise exception 'public.taxonomy_nodes.% has an incompatible type; expected %',
        expected.column_name,
        expected.data_type;
    end if;
  end loop;

  if exists (select 1 from public.taxonomy_nodes where id is null) then
    raise exception 'public.taxonomy_nodes contains null ids';
  end if;

  if exists (
    select id
    from public.taxonomy_nodes
    group by id
    having count(*) > 1
  ) then
    raise exception 'public.taxonomy_nodes contains duplicate ids';
  end if;

  if exists (select 1 from public.taxonomy_nodes where slug is null) then
    raise exception 'public.taxonomy_nodes contains null slugs';
  end if;

  if exists (
    select slug
    from public.taxonomy_nodes
    group by slug
    having count(*) > 1
  ) then
    raise exception 'public.taxonomy_nodes contains duplicate slugs';
  end if;

  if exists (
    select 1
    from public.taxonomy_nodes child
    left join public.taxonomy_nodes parent on parent.id = child.parent_id
    where child.parent_id is not null
      and parent.id is null
  ) then
    raise exception 'public.taxonomy_nodes contains orphan parent references';
  end if;

  if exists (
    with recursive walk as (
      select id, parent_id, array[id] as visited, false as cycle_found
      from public.taxonomy_nodes
      union all
      select walk.id, parent.parent_id, walk.visited || parent.id, parent.id = any(walk.visited)
      from walk
      join public.taxonomy_nodes parent on parent.id = walk.parent_id
      where not walk.cycle_found
    )
    select 1 from walk where cycle_found
  ) then
    raise exception 'public.taxonomy_nodes contains existing cycles';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'categories'
      and column_name = 'id'
      and data_type <> 'text'
  ) then
    raise exception 'public.categories.id must be text before adding taxonomy legacy_category_id foreign key';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subcategories'
      and column_name = 'id'
      and data_type <> 'text'
  ) then
    raise exception 'public.subcategories.id must be text before adding taxonomy legacy_subcategory_id foreign key';
  end if;
end $$;

alter table public.taxonomy_nodes add column if not exists id text;
alter table public.taxonomy_nodes add column if not exists parent_id text;
alter table public.taxonomy_nodes add column if not exists slug text;
alter table public.taxonomy_nodes add column if not exists name_ar text;
alter table public.taxonomy_nodes add column if not exists name_en text;
alter table public.taxonomy_nodes add column if not exists description_ar text;
alter table public.taxonomy_nodes add column if not exists description_en text;
alter table public.taxonomy_nodes add column if not exists icon_key text;
alter table public.taxonomy_nodes add column if not exists sort_order integer not null default 0;
alter table public.taxonomy_nodes add column if not exists depth integer not null default 0;
alter table public.taxonomy_nodes add column if not exists is_active boolean not null default true;
alter table public.taxonomy_nodes add column if not exists is_leaf boolean not null default false;
alter table public.taxonomy_nodes add column if not exists filter_schema_key text;
alter table public.taxonomy_nodes add column if not exists classification_key text;
alter table public.taxonomy_nodes add column if not exists classification_value text;
alter table public.taxonomy_nodes add column if not exists legacy_category_id text;
alter table public.taxonomy_nodes add column if not exists legacy_subcategory_id text;
alter table public.taxonomy_nodes add column if not exists created_at timestamptz not null default now();
alter table public.taxonomy_nodes add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.taxonomy_nodes'::regclass
      and constraint_row.contype = 'p'
      and constraint_row.conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.taxonomy_nodes'::regclass and attname = 'id')
      ]::smallint[]
  ) then
    alter table public.taxonomy_nodes add constraint taxonomy_nodes_pkey primary key (id);
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.taxonomy_nodes'::regclass
      and constraint_row.contype = 'u'
      and constraint_row.conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.taxonomy_nodes'::regclass and attname = 'slug')
      ]::smallint[]
  ) then
    alter table public.taxonomy_nodes add constraint taxonomy_nodes_slug_key unique (slug);
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.taxonomy_nodes'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.taxonomy_nodes'::regclass
      and constraint_row.conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.taxonomy_nodes'::regclass and attname = 'parent_id')
      ]::smallint[]
      and constraint_row.confkey = array[
        (select attnum from pg_attribute where attrelid = 'public.taxonomy_nodes'::regclass and attname = 'id')
      ]::smallint[]
  ) then
    alter table public.taxonomy_nodes
      add constraint taxonomy_nodes_parent_id_fkey
      foreign key (parent_id) references public.taxonomy_nodes(id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.taxonomy_nodes'::regclass
      and contype = 'c'
      and replace(pg_get_constraintdef(oid), ' ', '') ilike '%parent_id<>id%'
  ) then
    alter table public.taxonomy_nodes
      add constraint taxonomy_nodes_not_self_parent check (parent_id is null or parent_id <> id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.taxonomy_nodes'::regclass
      and contype = 'c'
      and replace(pg_get_constraintdef(oid), ' ', '') ilike '%depth>=0%'
  ) then
    alter table public.taxonomy_nodes
      add constraint taxonomy_nodes_depth_nonnegative check (depth >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.taxonomy_nodes'::regclass
      and contype = 'c'
      and replace(pg_get_constraintdef(oid), ' ', '') ilike '%parent_idisnull%depth=0%'
      and replace(pg_get_constraintdef(oid), ' ', '') ilike '%parent_idisnotnull%depth>0%'
  ) then
    alter table public.taxonomy_nodes
      add constraint taxonomy_nodes_root_depth check (
        (parent_id is null and depth = 0) or (parent_id is not null and depth > 0)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.taxonomy_nodes'::regclass
      and contype = 'c'
      and replace(pg_get_constraintdef(oid), ' ', '') ilike '%classification_key%'
      and replace(pg_get_constraintdef(oid), ' ', '') ilike '%classification_value%'
  ) then
    alter table public.taxonomy_nodes
      add constraint taxonomy_nodes_classification_pair check (
        (classification_key is null and classification_value is null)
        or (classification_key in ('listing_purpose', 'property_type') and classification_value is not null)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.taxonomy_nodes'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.categories'::regclass
      and constraint_row.conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.taxonomy_nodes'::regclass and attname = 'legacy_category_id')
      ]::smallint[]
      and constraint_row.confkey = array[
        (select attnum from pg_attribute where attrelid = 'public.categories'::regclass and attname = 'id')
      ]::smallint[]
  ) then
    alter table public.taxonomy_nodes
      add constraint taxonomy_nodes_legacy_category_id_fkey
      foreign key (legacy_category_id) references public.categories(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.taxonomy_nodes'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.subcategories'::regclass
      and constraint_row.conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.taxonomy_nodes'::regclass and attname = 'legacy_subcategory_id')
      ]::smallint[]
      and constraint_row.confkey = array[
        (select attnum from pg_attribute where attrelid = 'public.subcategories'::regclass and attname = 'id')
      ]::smallint[]
  ) then
    alter table public.taxonomy_nodes
      add constraint taxonomy_nodes_legacy_subcategory_id_fkey
      foreign key (legacy_subcategory_id) references public.subcategories(id) on delete set null;
  end if;
end $$;

create or replace function public.taxonomy_nodes_prevent_cycle()
returns trigger
language plpgsql
as $$
declare
  current_parent text;
  visited_nodes text[];
begin
  if new.parent_id is null then
    new.depth := 0;
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'taxonomy node cannot parent itself';
  end if;

  current_parent := new.parent_id;
  visited_nodes := array[new.id];

  while current_parent is not null loop
    if current_parent = any(visited_nodes) then
      raise exception 'taxonomy node cycle detected';
    end if;

    visited_nodes := array_append(visited_nodes, current_parent);

    select parent_id into current_parent
    from public.taxonomy_nodes
    where id = current_parent;

    if not found then
      raise exception 'taxonomy node parent does not exist: %', current_parent;
    end if;

  end loop;

  new.depth := cardinality(visited_nodes) - 1;

  return new;
end;
$$;

drop trigger if exists taxonomy_nodes_prevent_cycle_trigger on public.taxonomy_nodes;
create trigger taxonomy_nodes_prevent_cycle_trigger
before insert or update of parent_id, depth on public.taxonomy_nodes
for each row execute function public.taxonomy_nodes_prevent_cycle();

create index if not exists idx_taxonomy_nodes_parent_sort
  on public.taxonomy_nodes (parent_id, sort_order, name_ar);
create index if not exists idx_taxonomy_nodes_active_parent_sort
  on public.taxonomy_nodes (is_active, parent_id, sort_order);
create index if not exists idx_taxonomy_nodes_legacy_category
  on public.taxonomy_nodes (legacy_category_id);
create index if not exists idx_taxonomy_nodes_legacy_subcategory
  on public.taxonomy_nodes (legacy_subcategory_id);

drop trigger if exists taxonomy_nodes_touch_updated_at on public.taxonomy_nodes;
drop function if exists public.touch_updated_at_old(text);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at := now();
  return new;
end;
$$;

create trigger taxonomy_nodes_touch_updated_at
before update on public.taxonomy_nodes
for each row execute function public.touch_updated_at();

create or replace function public.taxonomy_nodes_refresh_descendant_depths()
returns trigger
language plpgsql
as $$
begin
  if old.parent_id is not distinct from new.parent_id and old.depth is not distinct from new.depth then
    return null;
  end if;

  with recursive descendants as (
    select child.id, child.parent_id, new.depth + 1 as computed_depth, array[new.id, child.id] as visited
    from public.taxonomy_nodes child
    where child.parent_id = new.id

    union all

    select child.id, child.parent_id, descendants.computed_depth + 1, descendants.visited || child.id
    from public.taxonomy_nodes child
    join descendants on child.parent_id = descendants.id
    where not child.id = any(descendants.visited)
  )
  update public.taxonomy_nodes target
  set depth = descendants.computed_depth
  from descendants
  where target.id = descendants.id
    and target.depth is distinct from descendants.computed_depth;

  return null;
end;
$$;

drop trigger if exists taxonomy_nodes_refresh_descendant_depths_trigger on public.taxonomy_nodes;
create trigger taxonomy_nodes_refresh_descendant_depths_trigger
after update of parent_id, depth on public.taxonomy_nodes
for each row execute function public.taxonomy_nodes_refresh_descendant_depths();

create or replace function public.taxonomy_node_has_active_ancestors(node_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive chain as (
    select id, parent_id, is_active, array[id] as visited, false as has_cycle
    from public.taxonomy_nodes
    where id = node_id
    
    union all
    
    select parent.id, parent.parent_id, parent.is_active, 
           child.visited || parent.id,
           parent.id = any(child.visited)
    from public.taxonomy_nodes parent
    join chain child on parent.id = child.parent_id
    where not child.has_cycle
  )
  select coalesce(
    count(*) > 0
    and bool_and(is_active)
    and bool_or(parent_id is null)
    and not bool_or(has_cycle)
    and not exists (
      select 1
      from chain terminal
      left join public.taxonomy_nodes parent on parent.id = terminal.parent_id
      where terminal.parent_id is not null
        and parent.id is null
    ),
    false
  )
  from chain;
$$;

alter table public.taxonomy_nodes enable row level security;

drop policy if exists "Public reads active taxonomy nodes" on public.taxonomy_nodes;
create policy "Public reads active taxonomy nodes"
on public.taxonomy_nodes for select
using (is_active = true and public.taxonomy_node_has_active_ancestors(id));

drop policy if exists "Owner manages taxonomy nodes" on public.taxonomy_nodes;
create policy "Owner manages taxonomy nodes"
on public.taxonomy_nodes for all
to authenticated
using (public.current_user_can_manage_roles())
with check (public.current_user_can_manage_roles());

insert into public.taxonomy_nodes (
  id,
  parent_id,
  slug,
  name_ar,
  name_en,
  description_ar,
  description_en,
  icon_key,
  sort_order,
  depth,
  is_active,
  is_leaf,
  filter_schema_key,
  classification_key,
  classification_value,
  legacy_category_id,
  legacy_subcategory_id
)
values
  ('cars', null, 'cars', 'سيارات ومركبات', 'Cars and vehicles', 'سيارات ومركبات وقطع غيار وخدمات', 'Cars, vehicles, spare parts, and services', 'car', 10, 0, true, false, 'vehicles', null, null, 'cars', null),
  ('realestate', null, 'realestate', 'عقارات', 'Real estate', 'بيع وإيجار العقارات السكنية والتجارية', 'Residential and commercial property for sale or rent', 'realestate', 20, 0, true, false, 'real_estate', null, null, 'realestate', null),
  ('mobiles', null, 'mobiles', 'موبايلات وتابلت', 'Mobiles and tablets', 'أجهزة موبايل وتابلت وإكسسوارات وقطع غيار', 'Mobile devices, tablets, accessories, and parts', 'phone', 30, 0, true, false, 'electronics', null, null, 'mobiles', null),
  ('electronics', null, 'electronics', 'إلكترونيات', 'Electronics', 'لابتوبات وشاشات وأجهزة إلكترونية', 'Laptops, screens, and electronic devices', 'electronics', 40, 0, true, false, 'electronics', null, null, 'electronics', null),
  ('furniture', null, 'furniture', 'منزل وأثاث', 'Home and furniture', 'أثاث منزلي ومكتبي وديكور', 'Home, office, and decor', 'furniture', 50, 0, true, false, null, null, null, 'furniture', null),
  ('jobs', null, 'jobs', 'وظائف', 'Jobs', 'فرص عمل وباحثون عن عمل', 'Open roles and job seekers', 'job', 60, 0, true, false, 'jobs', null, null, 'jobs', null),
  ('services', null, 'services', 'خدمات', 'Services', 'صيانة ونقل وتنظيف وتصميم وخدمات أخرى', 'Maintenance, delivery, cleaning, design, and other services', 'service', 70, 0, true, false, 'services', null, null, 'services', null),
  ('fashion', null, 'fashion', 'أزياء ومستلزمات', 'Fashion and accessories', 'ملابس وساعات وعطور وإكسسوارات', 'Clothing, watches, perfumes, and accessories', 'fashion', 80, 0, true, false, null, null, null, 'fashion', null),
  ('food', null, 'food', 'أطعمة ومنتجات محلية', 'Food and local products', 'منتجات محلية ومواد غذائية', 'Local products and food items', 'food', 90, 0, true, false, null, null, null, 'food', null),
  ('animals', null, 'animals', 'حيوانات ومواشي', 'Animals and livestock', 'مواشي وطيور ومستلزمات', 'Livestock, birds, and supplies', 'animals', 100, 0, true, false, null, null, null, 'animals', null),
  ('education', null, 'education', 'تعليم ودورات', 'Education and courses', 'دورات ومدرسون وتدريب', 'Courses, tutors, and training', 'education', 110, 0, true, false, null, null, null, 'education', null),
  ('business', null, 'business', 'أعمال وصناعة', 'Business and industry', 'معدات ومحلات ومشاريع', 'Equipment, shops, and projects', 'business', 120, 0, true, false, null, null, null, 'business', null),
  ('misc', null, 'misc', 'المزيد', 'More', 'إعلانات متنوعة', 'Various listings', 'misc', 130, 0, true, false, null, null, null, 'misc', null),

  ('realestate-residential', 'realestate', 'realestate-residential', 'سكني', 'Residential', 'عقارات سكنية للبيع أو الإيجار', 'Residential property for sale or rent', 'realestate', 10, 1, true, false, 'real_estate', null, null, 'realestate', null),
  ('realestate-sale', 'realestate-residential', 'realestate-sale', 'للبيع', 'For sale', 'عقارات سكنية معروضة للبيع', 'Residential property offered for sale', 'realestate', 10, 2, true, false, 'real_estate', 'listing_purpose', 'sale', 'realestate', null),
  ('realestate-rent', 'realestate-residential', 'realestate-rent', 'للإيجار', 'For rent', 'عقارات سكنية معروضة للإيجار', 'Residential property offered for rent', 'realestate', 20, 2, true, false, 'real_estate', 'listing_purpose', 'rent', 'realestate', null),
  ('realestate-commercial', 'realestate', 'realestate-commercial', 'تجاري', 'Commercial', 'محلات ومكاتب ومستودعات وعقارات تجارية', 'Shops, offices, warehouses, and commercial property', 'business', 20, 1, true, false, 'real_estate', null, null, 'realestate', 'realestate-commercial'),
  ('realestate-land', 'realestate', 'realestate-land', 'أراضي', 'Land', 'أراضي للبيع أو الاستثمار', 'Land for sale or investment', 'realestate', 30, 1, true, true, 'real_estate', 'property_type', 'land', 'realestate', 'realestate-land'),

  ('realestate-apartments-sale', 'realestate-sale', 'realestate-apartments-sale', 'شقة', 'Apartment', 'شقق سكنية للبيع', 'Residential apartments for sale', 'realestate', 10, 3, true, true, 'real_estate', 'property_type', 'apartment', 'realestate', 'realestate-apartments-sale'),
  ('realestate-houses-sale', 'realestate-sale', 'realestate-houses-sale', 'بيت', 'House', 'بيوت ومنازل للبيع', 'Houses for sale', 'realestate', 20, 3, true, true, 'real_estate', 'property_type', 'house', 'realestate', 'realestate-houses-sale'),
  ('realestate-villas', 'realestate-sale', 'realestate-villas', 'فيلا', 'Villa', 'فلل للبيع', 'Villas for sale', 'realestate', 30, 3, true, true, 'real_estate', 'property_type', 'villa', 'realestate', 'realestate-villas'),
  ('realestate-apartments-rent', 'realestate-rent', 'realestate-apartments-rent', 'شقة', 'Apartment', 'شقق سكنية للإيجار', 'Residential apartments for rent', 'realestate', 10, 3, true, true, 'real_estate', 'property_type', 'apartment', 'realestate', 'realestate-apartments-rent'),
  ('realestate-houses-rent', 'realestate-rent', 'realestate-houses-rent', 'بيت', 'House', 'بيوت ومنازل للإيجار', 'Houses for rent', 'realestate', 20, 3, true, true, 'real_estate', 'property_type', 'house', 'realestate', 'realestate-houses-rent'),
  ('realestate-shops', 'realestate-commercial', 'realestate-shops', 'محل', 'Shop', 'محلات تجارية', 'Retail shops', 'business', 10, 2, true, true, 'real_estate', 'property_type', 'shop', 'realestate', 'realestate-shops'),
  ('realestate-offices', 'realestate-commercial', 'realestate-offices', 'مكتب', 'Office', 'مكاتب ومساحات عمل', 'Offices and workspaces', 'business', 20, 2, true, true, 'real_estate', 'property_type', 'office', 'realestate', 'realestate-offices'),
  ('realestate-warehouses', 'realestate-commercial', 'realestate-warehouses', 'مستودع', 'Warehouse', 'مستودعات ومخازن', 'Warehouses and storage spaces', 'business', 30, 2, true, true, 'real_estate', 'property_type', 'warehouse', 'realestate', 'realestate-warehouses'),

  ('cars-sale', 'cars', 'cars-sale', 'سيارات للبيع', 'Cars for sale', 'سيارات ومركبات للبيع', 'Cars and vehicles for sale', 'car', 10, 1, false, true, 'vehicles', null, null, 'cars', 'cars-sale'),
  ('cars-rent', 'cars', 'cars-rent', 'سيارات للإيجار', 'Cars for rent', 'سيارات للإيجار', 'Cars for rent', 'car', 20, 1, false, true, 'vehicles', null, null, 'cars', 'cars-rent'),
  ('cars-parts', 'cars', 'cars-parts', 'قطع غيار', 'Spare parts', 'قطع غيار وإكسسوارات سيارات', 'Car parts and accessories', 'car', 30, 1, false, true, 'vehicles', null, null, 'cars', 'cars-parts'),
  ('cars-motorcycles', 'cars', 'cars-motorcycles', 'دراجات نارية', 'Motorcycles', 'دراجات نارية ومستلزماتها', 'Motorcycles and related supplies', 'car', 40, 1, false, true, 'vehicles', null, null, 'cars', 'cars-motorcycles'),
  ('jobs-full-time', 'jobs', 'jobs-full-time', 'دوام كامل', 'Full-time', 'فرص عمل بدوام كامل', 'Full-time job openings', 'job', 10, 1, false, true, 'jobs', null, null, 'jobs', 'jobs-full-time'),
  ('jobs-seekers', 'jobs', 'jobs-seekers', 'باحثون عن عمل', 'Job seekers', 'سير ذاتية وباحثون عن عمل', 'CVs and job seekers', 'job', 20, 1, false, true, 'jobs', null, null, 'jobs', 'jobs-seekers'),
  ('services-maintenance', 'services', 'services-maintenance', 'صيانة وإصلاح', 'Maintenance and repair', 'خدمات صيانة وإصلاح', 'Maintenance and repair services', 'service', 10, 1, false, true, 'services', null, null, 'services', 'services-maintenance'),
  ('services-cleaning', 'services', 'services-cleaning', 'تنظيف', 'Cleaning', 'خدمات تنظيف', 'Cleaning services', 'service', 20, 1, false, true, 'services', null, null, 'services', 'services-cleaning'),
  ('services-moving', 'services', 'services-moving', 'نقل وتوصيل', 'Moving and delivery', 'خدمات نقل وتوصيل', 'Moving and delivery services', 'service', 30, 1, false, true, 'services', null, null, 'services', 'services-moving')
on conflict (id) do update set
  parent_id = excluded.parent_id,
  slug = excluded.slug,
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  description_ar = excluded.description_ar,
  description_en = excluded.description_en,
  icon_key = excluded.icon_key,
  sort_order = excluded.sort_order,
  depth = excluded.depth,
  is_active = excluded.is_active,
  is_leaf = excluded.is_leaf,
  filter_schema_key = excluded.filter_schema_key,
  classification_key = excluded.classification_key,
  classification_value = excluded.classification_value,
  legacy_category_id = excluded.legacy_category_id,
  legacy_subcategory_id = excluded.legacy_subcategory_id;
