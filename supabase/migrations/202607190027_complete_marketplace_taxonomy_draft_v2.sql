-- RAWAJ Taxonomy, Data & Search Foundation V1: complete governed marketplace draft V2.
-- This migration creates a draft only. It does not publish or mutate runtime taxonomy_nodes.

DO $seed$
declare
  v_published_version_id uuid;
  v_draft_version_id uuid;
begin
  select id
    into v_published_version_id
  from public.taxonomy_versions
  where status = 'published'
  order by version_number desc
  limit 1;

  if v_published_version_id is null then
    raise exception 'Published taxonomy baseline is required before creating draft V2.';
  end if;

  insert into public.taxonomy_versions (
    version_number,
    status,
    based_on_version_id,
    change_summary
  )
  values (
    2,
    'draft',
    v_published_version_id,
    'Complete marketplace leaf taxonomy, domain schemas, and legacy compatibility mappings.'
  )
  on conflict (version_number) do nothing;

  select id
    into v_draft_version_id
  from public.taxonomy_versions
  where version_number = 2;

  if v_draft_version_id is null then
    raise exception 'Unable to resolve taxonomy draft V2.';
  end if;

  if exists (
    select 1
    from public.taxonomy_versions
    where id = v_draft_version_id
      and status <> 'draft'
  ) then
    raise exception 'Taxonomy version 2 already exists and is not a draft.';
  end if;

  set constraints taxonomy_version_nodes_parent_fkey deferred;

  -- Root nodes remain aligned with stable category IDs.
  insert into public.taxonomy_version_nodes (
    version_id,
    node_id,
    parent_node_id,
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
    display_schema_key,
    legacy_category_id,
    seo_title_ar,
    seo_title_en,
    seo_description_ar,
    seo_description_en
  )
  select
    v_draft_version_id,
    category_row.id,
    null,
    category_row.slug,
    category_row.name_ar,
    category_row.name_en,
    category_row.hint_ar,
    category_row.hint_en,
    coalesce(runtime_root.icon_key, category_row.slug),
    category_row.sort_order,
    0,
    category_row.is_active,
    false,
    case category_row.id
      when 'cars' then 'vehicles'
      when 'realestate' then 'real_estate'
      when 'mobiles' then 'mobile_devices'
      when 'electronics' then 'electronics'
      when 'furniture' then 'furniture'
      when 'jobs' then 'jobs'
      when 'services' then 'services'
      when 'fashion' then 'fashion'
      when 'food' then 'food'
      when 'animals' then 'animals'
      when 'education' then 'education'
      when 'business' then 'business'
      else 'general'
    end,
    case category_row.id
      when 'cars' then 'vehicles'
      when 'realestate' then 'real_estate'
      when 'mobiles' then 'mobile_devices'
      when 'electronics' then 'electronics'
      when 'furniture' then 'furniture'
      when 'jobs' then 'jobs'
      when 'services' then 'services'
      when 'fashion' then 'fashion'
      when 'food' then 'food'
      when 'animals' then 'animals'
      when 'education' then 'education'
      when 'business' then 'business'
      else 'general'
    end,
    category_row.id,
    category_row.name_ar || ' في سوريا | رواج',
    coalesce(category_row.name_en, category_row.name_ar) || ' in Syria | RAWAJ',
    category_row.hint_ar,
    category_row.hint_en
  from public.categories category_row
  left join public.taxonomy_nodes runtime_root
    on runtime_root.id = category_row.id
  on conflict (version_id, node_id) do update set
    parent_node_id = excluded.parent_node_id,
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
    display_schema_key = excluded.display_schema_key,
    legacy_category_id = excluded.legacy_category_id,
    seo_title_ar = excluded.seo_title_ar,
    seo_title_en = excluded.seo_title_en,
    seo_description_ar = excluded.seo_description_ar,
    seo_description_en = excluded.seo_description_en,
    updated_at = now();

  -- Most legacy subcategories are valid canonical leaves. Attribute-like legacy
  -- buckets are excluded and consolidated below.
  insert into public.taxonomy_version_nodes (
    version_id,
    node_id,
    parent_node_id,
    slug,
    name_ar,
    name_en,
    sort_order,
    depth,
    is_active,
    is_leaf,
    filter_schema_key,
    display_schema_key,
    legacy_category_id,
    legacy_subcategory_id,
    seo_title_ar,
    seo_title_en
  )
  select
    v_draft_version_id,
    subcategory_row.id,
    subcategory_row.category_id,
    subcategory_row.id,
    subcategory_row.name_ar,
    subcategory_row.name_en,
    subcategory_row.sort_order,
    1,
    true,
    true,
    case
      when subcategory_row.id = 'cars-parts' then 'general_product'
      when subcategory_row.id = 'cars-services' then 'services'
      when subcategory_row.category_id = 'cars' then 'vehicles'
      when subcategory_row.category_id = 'mobiles' then 'mobile_devices'
      when subcategory_row.category_id = 'electronics' then 'electronics'
      when subcategory_row.category_id = 'furniture' then 'furniture'
      when subcategory_row.category_id = 'jobs' then 'jobs'
      when subcategory_row.category_id = 'services' then 'services'
      when subcategory_row.category_id = 'fashion' then 'fashion'
      when subcategory_row.category_id = 'food' then 'food'
      when subcategory_row.category_id = 'animals' then 'animals'
      when subcategory_row.category_id = 'education' then 'education'
      when subcategory_row.category_id = 'business' then 'business'
      else 'general'
    end,
    case
      when subcategory_row.id = 'cars-parts' then 'general_product'
      when subcategory_row.id = 'cars-services' then 'services'
      when subcategory_row.category_id = 'cars' then 'vehicles'
      when subcategory_row.category_id = 'mobiles' then 'mobile_devices'
      when subcategory_row.category_id = 'electronics' then 'electronics'
      when subcategory_row.category_id = 'furniture' then 'furniture'
      when subcategory_row.category_id = 'jobs' then 'jobs'
      when subcategory_row.category_id = 'services' then 'services'
      when subcategory_row.category_id = 'fashion' then 'fashion'
      when subcategory_row.category_id = 'food' then 'food'
      when subcategory_row.category_id = 'animals' then 'animals'
      when subcategory_row.category_id = 'education' then 'education'
      when subcategory_row.category_id = 'business' then 'business'
      else 'general'
    end,
    subcategory_row.category_id,
    subcategory_row.id,
    subcategory_row.name_ar || ' | رواج',
    coalesce(subcategory_row.name_en, subcategory_row.name_ar) || ' | RAWAJ'
  from public.subcategories subcategory_row
  where subcategory_row.category_id <> 'realestate'
    and subcategory_row.id not in (
      'mobiles-iphone',
      'mobiles-samsung',
      'mobiles-xiaomi',
      'mobiles-huawei',
      'mobiles-oppo',
      'jobs-full-time',
      'jobs-part-time',
      'jobs-remote'
    )
  on conflict (version_id, node_id) do update set
    parent_node_id = excluded.parent_node_id,
    slug = excluded.slug,
    name_ar = excluded.name_ar,
    name_en = excluded.name_en,
    sort_order = excluded.sort_order,
    depth = excluded.depth,
    is_active = excluded.is_active,
    is_leaf = excluded.is_leaf,
    filter_schema_key = excluded.filter_schema_key,
    display_schema_key = excluded.display_schema_key,
    legacy_category_id = excluded.legacy_category_id,
    legacy_subcategory_id = excluded.legacy_subcategory_id,
    seo_title_ar = excluded.seo_title_ar,
    seo_title_en = excluded.seo_title_en,
    updated_at = now();

  -- Correct canonical leaves for legacy attributes rather than preserving them as categories.
  insert into public.taxonomy_version_nodes (
    version_id,
    node_id,
    parent_node_id,
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
    display_schema_key,
    legacy_category_id,
    seo_title_ar,
    seo_title_en
  )
  values
    (v_draft_version_id, 'mobiles-phones', 'mobiles', 'mobiles-phones', 'هواتف محمولة', 'Mobile phones', 'هواتف ذكية وتقليدية من جميع الشركات.', 'Smartphones and feature phones across all makes.', 'smartphone', 10, 1, true, true, 'mobile_devices', 'mobile_devices', 'mobiles', 'هواتف محمولة للبيع | رواج', 'Mobile phones | RAWAJ'),
    (v_draft_version_id, 'jobs-opportunities', 'jobs', 'jobs-opportunities', 'فرص عمل', 'Job opportunities', 'وظائف منشورة من شركات وأفراد مع حقول دوام وموقع منظمة.', 'Structured job opportunities from businesses and individuals.', 'briefcase-business', 10, 1, true, true, 'jobs', 'jobs', 'jobs', 'فرص عمل في سوريا | رواج', 'Jobs in Syria | RAWAJ')
  on conflict (version_id, node_id) do update set
    parent_node_id = excluded.parent_node_id,
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
    display_schema_key = excluded.display_schema_key,
    legacy_category_id = excluded.legacy_category_id,
    seo_title_ar = excluded.seo_title_ar,
    seo_title_en = excluded.seo_title_en,
    updated_at = now();

  -- Real-estate keeps a meaningful hierarchy while every legacy bucket resolves to a leaf.
  insert into public.taxonomy_version_nodes (
    version_id,
    node_id,
    parent_node_id,
    slug,
    name_ar,
    name_en,
    sort_order,
    depth,
    is_active,
    is_leaf,
    filter_schema_key,
    display_schema_key,
    classification_key,
    classification_value,
    legacy_category_id,
    legacy_subcategory_id,
    seo_title_ar,
    seo_title_en
  )
  values
    (v_draft_version_id, 'realestate-residential', 'realestate', 'realestate-residential', 'سكني', 'Residential', 10, 1, true, false, 'real_estate', 'real_estate', null, null, 'realestate', null, 'عقارات سكنية | رواج', 'Residential real estate | RAWAJ'),
    (v_draft_version_id, 'realestate-commercial', 'realestate', 'realestate-commercial', 'تجاري', 'Commercial', 20, 1, true, false, 'real_estate', 'real_estate', null, null, 'realestate', null, 'عقارات تجارية | رواج', 'Commercial real estate | RAWAJ'),
    (v_draft_version_id, 'realestate-sale', 'realestate-residential', 'realestate-sale', 'للبيع', 'For sale', 10, 2, true, false, 'real_estate', 'real_estate', 'listing_purpose', 'sale', 'realestate', null, 'عقارات سكنية للبيع | رواج', 'Residential property for sale | RAWAJ'),
    (v_draft_version_id, 'realestate-rent', 'realestate-residential', 'realestate-rent', 'للإيجار', 'For rent', 20, 2, true, false, 'real_estate', 'real_estate', 'listing_purpose', 'rent', 'realestate', null, 'عقارات سكنية للإيجار | رواج', 'Residential property for rent | RAWAJ'),
    (v_draft_version_id, 'realestate-apartments-sale', 'realestate-sale', 'realestate-apartments-sale', 'شقق للبيع', 'Apartments for sale', 10, 3, true, true, 'real_estate', 'real_estate', 'property_type', 'apartment', 'realestate', 'realestate-apartments-sale', 'شقق للبيع | رواج', 'Apartments for sale | RAWAJ'),
    (v_draft_version_id, 'realestate-houses-sale', 'realestate-sale', 'realestate-houses-sale', 'بيوت للبيع', 'Houses for sale', 20, 3, true, true, 'real_estate', 'real_estate', 'property_type', 'house', 'realestate', 'realestate-houses-sale', 'بيوت للبيع | رواج', 'Houses for sale | RAWAJ'),
    (v_draft_version_id, 'realestate-villas', 'realestate-sale', 'realestate-villas', 'فلل', 'Villas', 30, 3, true, true, 'real_estate', 'real_estate', 'property_type', 'villa', 'realestate', 'realestate-villas', 'فلل للبيع | رواج', 'Villas for sale | RAWAJ'),
    (v_draft_version_id, 'realestate-apartments-rent', 'realestate-rent', 'realestate-apartments-rent', 'شقق للإيجار', 'Apartments for rent', 10, 3, true, true, 'real_estate', 'real_estate', 'property_type', 'apartment', 'realestate', 'realestate-apartments-rent', 'شقق للإيجار | رواج', 'Apartments for rent | RAWAJ'),
    (v_draft_version_id, 'realestate-houses-rent', 'realestate-rent', 'realestate-houses-rent', 'بيوت للإيجار', 'Houses for rent', 20, 3, true, true, 'real_estate', 'real_estate', 'property_type', 'house', 'realestate', 'realestate-houses-rent', 'بيوت للإيجار | رواج', 'Houses for rent | RAWAJ'),
    (v_draft_version_id, 'realestate-shops', 'realestate-commercial', 'realestate-shops', 'محلات', 'Shops', 10, 2, true, true, 'real_estate', 'real_estate', 'property_type', 'shop', 'realestate', 'realestate-shops', 'محلات | رواج', 'Shops | RAWAJ'),
    (v_draft_version_id, 'realestate-offices', 'realestate-commercial', 'realestate-offices', 'مكاتب', 'Offices', 20, 2, true, true, 'real_estate', 'real_estate', 'property_type', 'office', 'realestate', 'realestate-offices', 'مكاتب | رواج', 'Offices | RAWAJ'),
    (v_draft_version_id, 'realestate-warehouses', 'realestate-commercial', 'realestate-warehouses', 'مستودعات', 'Warehouses', 30, 2, true, true, 'real_estate', 'real_estate', 'property_type', 'warehouse', 'realestate', 'realestate-warehouses', 'مستودعات | رواج', 'Warehouses | RAWAJ'),
    (v_draft_version_id, 'realestate-commercial-other', 'realestate-commercial', 'realestate-commercial-other', 'عقار تجاري آخر', 'Other commercial property', 40, 2, true, true, 'real_estate', 'real_estate', 'property_type', 'other', 'realestate', null, 'عقارات تجارية أخرى | رواج', 'Other commercial real estate | RAWAJ'),
    (v_draft_version_id, 'realestate-land', 'realestate', 'realestate-land', 'أراضي', 'Land', 30, 1, true, true, 'real_estate', 'real_estate', 'property_type', 'land', 'realestate', 'realestate-land', 'أراضي | رواج', 'Land | RAWAJ'),
    (v_draft_version_id, 'realestate-farms', 'realestate', 'realestate-farms', 'مزارع', 'Farms', 40, 1, true, true, 'real_estate', 'real_estate', 'property_type', 'farm', 'realestate', 'realestate-farms', 'مزارع | رواج', 'Farms | RAWAJ')
  on conflict (version_id, node_id) do update set
    parent_node_id = excluded.parent_node_id,
    slug = excluded.slug,
    name_ar = excluded.name_ar,
    name_en = excluded.name_en,
    sort_order = excluded.sort_order,
    depth = excluded.depth,
    is_active = excluded.is_active,
    is_leaf = excluded.is_leaf,
    filter_schema_key = excluded.filter_schema_key,
    display_schema_key = excluded.display_schema_key,
    classification_key = excluded.classification_key,
    classification_value = excluded.classification_value,
    legacy_category_id = excluded.legacy_category_id,
    legacy_subcategory_id = excluded.legacy_subcategory_id,
    seo_title_ar = excluded.seo_title_ar,
    seo_title_en = excluded.seo_title_en,
    updated_at = now();

  -- Explicitly map every legacy subcategory to an active canonical leaf.
  insert into public.taxonomy_legacy_mappings (
    version_id,
    legacy_category_id,
    legacy_subcategory_id,
    taxonomy_node_id,
    mapping_kind,
    priority,
    attribute_patch,
    is_active
  )
  select
    v_draft_version_id,
    subcategory_row.category_id,
    subcategory_row.id,
    case subcategory_row.id
      when 'mobiles-iphone' then 'mobiles-phones'
      when 'mobiles-samsung' then 'mobiles-phones'
      when 'mobiles-xiaomi' then 'mobiles-phones'
      when 'mobiles-huawei' then 'mobiles-phones'
      when 'mobiles-oppo' then 'mobiles-phones'
      when 'jobs-full-time' then 'jobs-opportunities'
      when 'jobs-part-time' then 'jobs-opportunities'
      when 'jobs-remote' then 'jobs-opportunities'
      when 'realestate-commercial' then 'realestate-commercial-other'
      else subcategory_row.id
    end,
    case
      when subcategory_row.id in (
        'mobiles-iphone',
        'mobiles-samsung',
        'mobiles-xiaomi',
        'mobiles-huawei',
        'mobiles-oppo'
      ) then 'brand_attribute'
      when subcategory_row.id in ('jobs-full-time', 'jobs-part-time', 'jobs-remote') then 'compatibility'
      when subcategory_row.id = 'realestate-commercial' then 'compatibility'
      else 'exact'
    end,
    100,
    case subcategory_row.id
      when 'mobiles-iphone' then jsonb_build_object('electronics_brand', 'Apple')
      when 'mobiles-samsung' then jsonb_build_object('electronics_brand', 'Samsung')
      when 'mobiles-xiaomi' then jsonb_build_object('electronics_brand', 'Xiaomi')
      when 'mobiles-huawei' then jsonb_build_object('electronics_brand', 'Huawei')
      when 'mobiles-oppo' then jsonb_build_object('electronics_brand', 'Oppo')
      when 'jobs-full-time' then jsonb_build_object('employment_type', 'full_time')
      when 'jobs-part-time' then jsonb_build_object('employment_type', 'part_time')
      when 'jobs-remote' then jsonb_build_object('remote_mode', 'remote')
      when 'jobs-freelance' then jsonb_build_object('employment_type', 'freelance')
      when 'jobs-training' then jsonb_build_object('employment_type', 'internship')
      when 'realestate-apartments-sale' then jsonb_build_object('property_purpose', 'sale', 'property_type', 'apartment')
      when 'realestate-apartments-rent' then jsonb_build_object('property_purpose', 'rent', 'property_type', 'apartment')
      when 'realestate-houses-sale' then jsonb_build_object('property_purpose', 'sale', 'property_type', 'house')
      when 'realestate-houses-rent' then jsonb_build_object('property_purpose', 'rent', 'property_type', 'house')
      when 'realestate-villas' then jsonb_build_object('property_purpose', 'sale', 'property_type', 'villa')
      when 'realestate-land' then jsonb_build_object('property_type', 'land')
      when 'realestate-shops' then jsonb_build_object('property_type', 'shop')
      when 'realestate-offices' then jsonb_build_object('property_type', 'office')
      when 'realestate-warehouses' then jsonb_build_object('property_type', 'warehouse')
      when 'realestate-farms' then jsonb_build_object('property_type', 'farm')
      when 'realestate-commercial' then jsonb_build_object('property_type', 'other')
      else '{}'::jsonb
    end,
    true
  from public.subcategories subcategory_row
  on conflict do nothing;

  -- Assign schema rules by canonical schema key. Core listing columns such as title,
  -- description, price, currency, location, and images remain governed by listings.
  with schema_rules as (
    select *
    from (values
      ('vehicles', 'listing_condition', 10, true, true, true),
      ('vehicles', 'vehicle_make', 20, true, true, true),
      ('vehicles', 'vehicle_model', 30, true, true, true),
      ('vehicles', 'vehicle_generation', 40, false, true, true),
      ('vehicles', 'vehicle_trim', 50, false, true, true),
      ('vehicles', 'vehicle_year', 60, true, true, true),
      ('vehicles', 'mileage_km', 70, true, true, true),
      ('vehicles', 'vehicle_fuel_type', 80, true, true, true),
      ('vehicles', 'vehicle_transmission', 90, true, true, true),
      ('vehicles', 'vehicle_body_type', 100, true, true, true),
      ('vehicles', 'engine_size_cc', 110, false, true, true),
      ('vehicles', 'exterior_color', 120, false, true, true),
      ('vehicles', 'exchange_allowed', 130, false, true, true),

      ('real_estate', 'property_purpose', 10, true, true, true),
      ('real_estate', 'property_type', 20, true, true, true),
      ('real_estate', 'area_sqm', 30, true, true, true),
      ('real_estate', 'bedrooms', 40, false, true, true),
      ('real_estate', 'bathrooms', 50, false, true, true),
      ('real_estate', 'floor_number', 60, false, true, true),
      ('real_estate', 'furnished', 70, false, true, true),
      ('real_estate', 'rental_period', 80, false, true, true),

      ('mobile_devices', 'listing_condition', 10, true, true, true),
      ('mobile_devices', 'electronics_brand', 20, true, true, true),
      ('mobile_devices', 'electronics_model', 30, true, true, true),
      ('mobile_devices', 'storage_gb', 40, false, true, true),
      ('mobile_devices', 'memory_gb', 50, false, true, true),
      ('mobile_devices', 'battery_health_percent', 60, false, true, true),
      ('mobile_devices', 'includes_box', 70, false, true, true),
      ('mobile_devices', 'includes_charger', 80, false, true, true),
      ('mobile_devices', 'warranty_available', 90, false, true, true),
      ('mobile_devices', 'delivery_available', 100, false, true, true),

      ('electronics', 'listing_condition', 10, true, true, true),
      ('electronics', 'electronics_brand', 20, false, true, true),
      ('electronics', 'electronics_model', 30, false, true, true),
      ('electronics', 'storage_gb', 40, false, true, true),
      ('electronics', 'memory_gb', 50, false, true, true),
      ('electronics', 'warranty_available', 60, false, true, true),
      ('electronics', 'delivery_available', 70, false, true, true),

      ('furniture', 'listing_condition', 10, true, true, true),
      ('furniture', 'material', 20, false, true, true),
      ('furniture', 'dimensions_text', 30, false, false, true),
      ('furniture', 'pieces_count', 40, false, true, true),
      ('furniture', 'delivery_available', 50, false, true, true),
      ('furniture', 'assembly_available', 60, false, true, true),

      ('jobs', 'job_title', 10, true, true, true),
      ('jobs', 'employment_type', 20, false, true, true),
      ('jobs', 'remote_mode', 30, false, true, true),
      ('jobs', 'experience_years', 40, false, true, true),
      ('jobs', 'salary_min', 50, false, true, true),
      ('jobs', 'salary_max', 60, false, true, true),
      ('jobs', 'salary_period', 70, false, true, true),

      ('services', 'service_type', 10, true, true, true),
      ('services', 'service_area', 20, false, true, true),
      ('services', 'years_experience', 30, false, true, true),
      ('services', 'home_visit_available', 40, false, true, true),
      ('services', 'emergency_service_available', 50, false, true, true),
      ('services', 'service_pricing_unit', 60, false, true, true),
      ('services', 'starting_price', 70, false, true, true),
      ('services', 'service_warranty_available', 80, false, true, true),

      ('fashion', 'listing_condition', 10, true, true, true),
      ('fashion', 'fashion_audience', 20, false, true, true),
      ('fashion', 'fashion_size', 30, false, true, true),
      ('fashion', 'fashion_color', 40, false, true, true),
      ('fashion', 'material', 50, false, true, true),
      ('fashion', 'product_brand', 60, false, true, true),
      ('fashion', 'product_authenticity', 70, false, true, true),
      ('fashion', 'delivery_available', 80, false, true, true),

      ('food', 'food_quantity', 10, true, true, true),
      ('food', 'food_unit', 20, true, true, true),
      ('food', 'production_date', 30, false, true, true),
      ('food', 'expiry_date', 40, false, true, true),
      ('food', 'ingredients', 50, false, false, true),
      ('food', 'minimum_order', 60, false, true, true),
      ('food', 'delivery_available', 70, false, true, true),

      ('animals', 'animal_species', 10, true, true, true),
      ('animals', 'animal_breed', 20, false, true, true),
      ('animals', 'animal_age_months', 30, false, true, true),
      ('animals', 'animal_gender', 40, false, true, true),
      ('animals', 'vaccinated', 50, false, true, true),
      ('animals', 'health_certificate_available', 60, false, true, true),
      ('animals', 'quantity_available', 70, false, true, true),
      ('animals', 'delivery_available', 80, false, true, true),

      ('education', 'education_subject', 10, true, true, true),
      ('education', 'education_level', 20, false, true, true),
      ('education', 'education_delivery_mode', 30, true, true, true),
      ('education', 'session_duration_minutes', 40, false, true, true),
      ('education', 'course_duration_text', 50, false, false, true),
      ('education', 'certificate_available', 60, false, true, true),
      ('education', 'starting_price', 70, false, true, true),

      ('business', 'business_item_type', 10, true, true, true),
      ('business', 'product_brand', 20, false, true, true),
      ('business', 'product_model', 30, false, true, true),
      ('business', 'manufacture_year', 40, false, true, true),
      ('business', 'country_of_origin', 50, false, true, true),
      ('business', 'operating_hours', 60, false, true, true),
      ('business', 'power_specification', 70, false, true, true),
      ('business', 'capacity_specification', 80, false, true, true),
      ('business', 'listing_condition', 90, true, true, true),
      ('business', 'warranty_available', 100, false, true, true),
      ('business', 'delivery_available', 110, false, true, true),

      ('general_product', 'listing_condition', 10, true, true, true),
      ('general_product', 'product_brand', 20, false, true, true),
      ('general_product', 'product_model', 30, false, true, true),
      ('general_product', 'product_authenticity', 40, false, true, true),
      ('general_product', 'quantity_available', 50, false, true, true),
      ('general_product', 'delivery_available', 60, false, true, true),
      ('general_product', 'warranty_available', 70, false, true, true),

      ('general', 'listing_condition', 10, true, true, true),
      ('general', 'product_brand', 20, false, true, true),
      ('general', 'product_model', 30, false, true, true),
      ('general', 'product_authenticity', 40, false, true, true),
      ('general', 'quantity_available', 50, false, true, true),
      ('general', 'delivery_available', 60, false, true, true)
    ) as rule_rows(schema_key, field_key, sort_order, is_required, is_filterable, is_displayable)
  )
  insert into public.taxonomy_field_rules (
    version_id,
    taxonomy_node_id,
    field_key,
    group_key,
    sort_order,
    is_required,
    is_searchable,
    is_filterable,
    is_displayable,
    display_surfaces,
    validation_override
  )
  select
    v_draft_version_id,
    leaf_row.node_id,
    schema_rule.field_key,
    leaf_row.filter_schema_key,
    schema_rule.sort_order,
    schema_rule.is_required,
    field_row.is_searchable,
    schema_rule.is_filterable,
    schema_rule.is_displayable,
    case
      when schema_rule.is_filterable then array['listing_card', 'listing_detail', 'listing_studio', 'search_filter', 'comparison']::text[]
      else array['listing_card', 'listing_detail', 'listing_studio', 'comparison']::text[]
    end,
    '{}'::jsonb
  from public.taxonomy_version_nodes leaf_row
  join schema_rules schema_rule
    on schema_rule.schema_key = leaf_row.filter_schema_key
  join public.field_definitions field_row
    on field_row.key = schema_rule.field_key
   and field_row.is_active
  where leaf_row.version_id = v_draft_version_id
    and leaf_row.is_active
    and leaf_row.is_leaf
  on conflict (version_id, taxonomy_node_id, field_key) do update set
    group_key = excluded.group_key,
    sort_order = excluded.sort_order,
    is_required = excluded.is_required,
    is_searchable = excluded.is_searchable,
    is_filterable = excluded.is_filterable,
    is_displayable = excluded.is_displayable,
    display_surfaces = excluded.display_surfaces,
    validation_override = excluded.validation_override,
    updated_at = now();

  -- Real-estate intent/type values are prefilled from the exact legacy mapping
  -- where available, while remaining editable through the listing studio rules.
  update public.taxonomy_field_rules rule_row
  set default_value = mapping_row.attribute_patch -> rule_row.field_key,
      updated_at = now()
  from public.taxonomy_legacy_mappings mapping_row
  where rule_row.version_id = v_draft_version_id
    and mapping_row.version_id = rule_row.version_id
    and mapping_row.taxonomy_node_id = rule_row.taxonomy_node_id
    and mapping_row.attribute_patch ? rule_row.field_key
    and rule_row.field_key in ('property_purpose', 'property_type', 'employment_type', 'remote_mode', 'electronics_brand');

  insert into public.field_conditional_rules (
    version_id,
    taxonomy_node_id,
    trigger_field_key,
    operator,
    trigger_value,
    target_field_key,
    effect,
    priority,
    is_active
  )
  select
    v_draft_version_id,
    leaf_row.node_id,
    'property_purpose',
    'equals',
    '"rent"'::jsonb,
    'rental_period',
    'require',
    10,
    true
  from public.taxonomy_version_nodes leaf_row
  where leaf_row.version_id = v_draft_version_id
    and leaf_row.is_active
    and leaf_row.is_leaf
    and leaf_row.filter_schema_key = 'real_estate'
  on conflict do nothing;
end;
$seed$;

comment on table public.taxonomy_versions is
  'Governed taxonomy releases. Version 2 is installed as a complete draft and requires owner validation before atomic publication.';
