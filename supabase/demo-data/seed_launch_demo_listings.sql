-- RAWAJ removable launch catalog.
-- Run manually in Supabase SQL Editor only after reviewing the owner email below.
-- This is operational demo data, not a schema migration.

begin;

do $$
declare
  v_owner_email constant text := 'allidamech@gmail.com';
  v_batch constant text := 'launch-catalog-v1';
  v_owner_id uuid;
  v_missing text;
begin
  select u.id
    into v_owner_id
  from auth.users u
  where lower(u.email) = lower(v_owner_email)
  limit 1;

  if v_owner_id is null then
    raise exception 'RAWAJ demo seed aborted: no auth user found for %', v_owner_email;
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.user_roles r on r.user_id = p.id
    where p.id = v_owner_id
      and p.account_status = 'active'
      and r.role in ('owner', 'admin')
  ) then
    raise exception 'RAWAJ demo seed aborted: % must be an active owner/admin', v_owner_email;
  end if;

  select string_agg(required.slug, ', ' order by required.slug)
    into v_missing
  from (values
    ('cars'), ('realestate'), ('mobiles'), ('electronics'), ('furniture'),
    ('jobs'), ('services'), ('fashion'), ('food'), ('animals'),
    ('education'), ('business'), ('misc')
  ) as required(slug)
  left join public.categories c on c.slug = required.slug and c.is_active = true
  where c.id is null;

  if v_missing is not null then
    raise exception 'RAWAJ demo seed aborted: missing active categories: %', v_missing;
  end if;

  select string_agg(required.slug, ', ' order by required.slug)
    into v_missing
  from (values
    ('damascus'), ('rif-dimashq'), ('aleppo'), ('homs'), ('hama'),
    ('latakia'), ('tartus'), ('idlib'), ('daraa'), ('hasakah')
  ) as required(slug)
  left join public.governorates g on g.slug = required.slug and g.is_active = true
  where g.id is null;

  if v_missing is not null then
    raise exception 'RAWAJ demo seed aborted: missing active governorates: %', v_missing;
  end if;

  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);

  create temporary table rawaj_demo_catalog (
    id uuid primary key,
    category_slug text not null,
    governorate_slug text not null,
    title text not null,
    description text not null,
    price numeric,
    price_type text not null,
    listing_condition text not null,
    district_ar text,
    is_featured boolean not null,
    age_days integer not null,
    attributes jsonb not null default '{}'::jsonb
  ) on commit drop;

  insert into rawaj_demo_catalog values
    ('da100001-0000-4000-8000-000000000001','cars','damascus','كيا ريو 2015 بحالة جيدة','سيارة استخدام شخصي، محرك وميكانيك بحالة جيدة، دهان نظيف ومقصورة مرتبة. المعاينة بعد التواصل والاتفاق على موعد.',185000000,'negotiable','used','المزة',true,1,'{"brand":"Kia","model":"Rio","year":2015,"transmission":"automatic"}'),
    ('da100001-0000-4000-8000-000000000002','cars','aleppo','هيونداي أفانتي 2012 أوتوماتيك','سيارة اقتصادية مناسبة للاستخدام اليومي. صيانة دورية وإطارات جيدة، البيع بسبب السفر.',142000000,'negotiable','used','حلب الجديدة',false,4,'{"brand":"Hyundai","model":"Avante","year":2012,"transmission":"automatic"}'),
    ('da100001-0000-4000-8000-000000000003','realestate','damascus','شقة غرفتين وصالون للإيجار في مشروع دمر','شقة مرتبة بإضاءة جيدة وقريبة من الخدمات والمواصلات. الإيجار لعائلة صغيرة ومدة سنوية.',4500000,'fixed','not_applicable','مشروع دمر',true,2,'{"property_type":"apartment","purpose":"rent","bedrooms":2,"area_sqm":110}'),
    ('da100001-0000-4000-8000-000000000004','realestate','homs','محل تجاري على شارع حيوي','محل واجهته جيدة ومناسب لمكتب أو متجر صغير. يوجد كهرباء ومياه وإمكانية معاينة مباشرة.',320000000,'negotiable','not_applicable','الإنشاءات',false,7,'{"property_type":"shop","purpose":"sale","area_sqm":42}'),
    ('da100001-0000-4000-8000-000000000005','mobiles','damascus','آيفون 13 سعة 128 غيغابايت','الجهاز نظيف ويعمل بشكل ممتاز، البطارية جيدة مع العلبة والكابل. لا يوجد تبديل قطع حسب معرفة المعلن.',9800000,'negotiable','like_new','كفرسوسة',true,1,'{"brand":"Apple","model":"iPhone 13","storage_gb":128,"color":"blue"}'),
    ('da100001-0000-4000-8000-000000000006','mobiles','latakia','سامسونج A54 مع كامل الملحقات','هاتف استخدام خفيف، الشاشة والهيكل بحالة ممتازة، مع شاحن وغطاء حماية.',5200000,'fixed','like_new','الزراعة',false,3,'{"brand":"Samsung","model":"Galaxy A54","storage_gb":128}'),
    ('da100001-0000-4000-8000-000000000007','electronics','aleppo','لابتوب Lenovo ThinkPad للعمل والدراسة','معالج Core i5 وذاكرة 16GB وقرص SSD. مناسب للبرمجة والأعمال المكتبية والدراسة.',8900000,'negotiable','used','الفرقان',true,2,'{"brand":"Lenovo","model":"ThinkPad","ram_gb":16,"storage":"512GB SSD"}'),
    ('da100001-0000-4000-8000-000000000008','electronics','tartus','شاشة LG قياس 43 بوصة سمارت','صورة واضحة واتصال واي فاي وتطبيقات أساسية. الجهاز مجرب ولا توجد كسور.',6100000,'fixed','used','الكورنيش',false,6,'{"brand":"LG","screen_size":43,"smart":true}'),
    ('da100001-0000-4000-8000-000000000009','furniture','rif-dimashq','غرفة نوم خشب زان كاملة','تتضمن سرير وخزانة وطاولتين وتسريحة. الاستخدام محدود والنقل على المشتري.',24500000,'negotiable','used','جرمانا',true,3,'{"material":"beech wood","pieces":5}'),
    ('da100001-0000-4000-8000-000000000010','furniture','hama','طاولة سفرة مع ستة كراسي','طاولة متينة بحالة جيدة مع ستة كراسي، مناسبة لمساحة متوسطة.',7800000,'fixed','used','جنوب الملعب',false,8,'{"seats":6,"material":"wood"}'),
    ('da100001-0000-4000-8000-000000000011','jobs','damascus','مطلوب موظف مبيعات لمتجر إلكترونيات','دوام كامل، خبرة بسيطة بالمبيعات والتعامل مع العملاء، راتب ثابت مع حوافز.',null,'contact','not_applicable','الشعلان',true,1,'{"employment_type":"full_time","experience":"entry_level"}'),
    ('da100001-0000-4000-8000-000000000012','jobs','aleppo','فرصة عمل لمصمم جرافيك','مطلوب مصمم يجيد Photoshop وIllustrator للعمل ضمن فريق تسويق. يفضل إرسال نماذج أعمال.',null,'contact','not_applicable','الجميلية',false,5,'{"employment_type":"full_time","field":"graphic_design"}'),
    ('da100001-0000-4000-8000-000000000013','services','damascus','صيانة موبايلات داخل دمشق','صيانة أعطال الشاشة والشحن والبرمجيات مع فحص أولي وتوضيح التكلفة قبل العمل.',null,'contact','not_applicable','برزة',true,2,'{"service_type":"mobile_repair","coverage":"Damascus"}'),
    ('da100001-0000-4000-8000-000000000014','services','homs','نقل أثاث منزلي مع عمال تحميل','خدمة نقل داخل حمص والمناطق القريبة مع إمكانية الفك والتركيب حسب الاتفاق.',null,'contact','not_applicable','الوعر',false,6,'{"service_type":"moving","crew_included":true}'),
    ('da100001-0000-4000-8000-000000000015','fashion','damascus','ساعة رجالية ستانلس ستيل','ساعة أنيقة للاستخدام اليومي، جديدة ضمن علبتها ومتوفرة بلونين.',950000,'fixed','new','أبو رمانة',false,4,'{"item_type":"watch","material":"stainless steel"}'),
    ('da100001-0000-4000-8000-000000000016','fashion','idlib','فستان سهرة جديد مقاس متوسط','فستان جديد لم يستخدم، قماش مريح وتفصيل أنيق. المعاينة قبل الشراء متاحة.',1650000,'negotiable','new','إدلب المدينة',false,9,'{"item_type":"dress","size":"M"}'),
    ('da100001-0000-4000-8000-000000000017','food','latakia','زيت زيتون بلدي عصر أول','زيت من محصول الموسم بطعم متوازن، متوفر بعبوات خمسة لترات.',750000,'fixed','new','الشيخ ضاهر',true,3,'{"product":"olive_oil","package_liters":5}'),
    ('da100001-0000-4000-8000-000000000018','food','daraa','عسل طبيعي من إنتاج محلي','عسل موسمي معبأ بمرطبانات محكمة، الكمية محدودة والتسليم حسب الاتفاق.',420000,'fixed','new','إزرع',false,7,'{"product":"honey","package_grams":1000}'),
    ('da100001-0000-4000-8000-000000000019','animals','hama','خراف بلدية للبيع','خراف بصحة جيدة ومتوفرة بعدة أوزان. السعر يحدد حسب الوزن والكمية.',null,'contact','not_applicable','طريق حلب',false,5,'{"animal_type":"sheep"}'),
    ('da100001-0000-4000-8000-000000000020','animals','hasakah','طيور زينة مع أقفاص','مجموعة طيور زينة أليفة مع أقفاص مناسبة، البيع كامل أو بشكل منفصل.',850000,'negotiable','not_applicable','القامشلي',false,10,'{"animal_type":"birds","cages_included":true}'),
    ('da100001-0000-4000-8000-000000000021','education','damascus','دورة محادثة باللغة الإنجليزية','مجموعات صغيرة وتدريب عملي على المحادثة، ثلاثة أيام أسبوعياً مع اختبار تحديد مستوى.',600000,'fixed','not_applicable','ركن الدين',true,2,'{"course":"English conversation","delivery":"in_person"}'),
    ('da100001-0000-4000-8000-000000000022','education','aleppo','مدرس رياضيات للمرحلة الثانوية','دروس فردية أو ضمن مجموعات صغيرة مع متابعة وحل نماذج امتحانية.',null,'contact','not_applicable','المحافظة',false,8,'{"subject":"mathematics","level":"secondary"}'),
    ('da100001-0000-4000-8000-000000000023','business','rif-dimashq','ماكينة تعبئة نصف أوتوماتيك','ماكينة مناسبة لمشروع إنتاج صغير، بحالة تشغيل جيدة مع شرح طريقة الاستخدام.',68000000,'negotiable','used','صحنايا',true,4,'{"equipment":"filling_machine","automation":"semi_automatic"}'),
    ('da100001-0000-4000-8000-000000000024','business','aleppo','معدات محل قهوة للبيع','طاولات وكراسي وتجهيزات تحضير أساسية، مناسبة لمن يرغب ببدء مشروع صغير.',39000000,'negotiable','used','الشهباء',false,11,'{"business_type":"coffee_shop","sale_type":"equipment"}'),
    ('da100001-0000-4000-8000-000000000025','misc','tartus','دراجة هوائية قياس 26','دراجة عملية بحالة جيدة، مكابح وإطارات مجربة ومناسبة للتنقل اليومي.',2400000,'fixed','used','صافيتا',false,6,'{"item_type":"bicycle","wheel_size":26}'),
    ('da100001-0000-4000-8000-000000000026','misc','homs','جهاز رياضي منزلي متعدد الاستخدام','جهاز تمارين منزلي قابل للتعديل، نظيف وقليل الاستخدام.',5600000,'negotiable','like_new','الحمرا',false,12,'{"item_type":"home_gym"}');

  insert into public.listings (
    id, owner_id, category_id, subcategory_id, governorate_id, title, description,
    price, currency, price_type, listing_condition, status, district_ar,
    contact_name, contact_options, details, is_featured, featured_until,
    reviewed_by, reviewed_at, rejection_reason, published_at, archived_at,
    created_at, updated_at
  )
  select
    d.id,
    v_owner_id,
    c.id,
    null,
    g.id,
    d.title,
    d.description,
    d.price,
    'SYP',
    d.price_type,
    d.listing_condition,
    'approved',
    d.district_ar,
    'فريق رواج',
    '{"message": true, "phone": false, "whatsapp": false}'::jsonb,
    d.attributes || jsonb_build_object(
      '_rawaj_seed', jsonb_build_object(
        'batch', v_batch,
        'kind', 'launch_demo',
        'removable', true
      )
    ),
    d.is_featured,
    case when d.is_featured then now() + interval '30 days' else null end,
    v_owner_id,
    now() - make_interval(days => d.age_days),
    null,
    now() - make_interval(days => d.age_days),
    null,
    now() - make_interval(days => d.age_days),
    now() - make_interval(days => d.age_days)
  from rawaj_demo_catalog d
  join public.categories c on c.slug = d.category_slug
  join public.governorates g on g.slug = d.governorate_slug
  on conflict (id) do update set
    owner_id = excluded.owner_id,
    category_id = excluded.category_id,
    governorate_id = excluded.governorate_id,
    title = excluded.title,
    description = excluded.description,
    price = excluded.price,
    currency = excluded.currency,
    price_type = excluded.price_type,
    listing_condition = excluded.listing_condition,
    status = excluded.status,
    district_ar = excluded.district_ar,
    contact_name = excluded.contact_name,
    contact_options = excluded.contact_options,
    details = excluded.details,
    is_featured = excluded.is_featured,
    featured_until = excluded.featured_until,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at,
    rejection_reason = null,
    published_at = excluded.published_at,
    archived_at = null,
    updated_at = now()
  where public.listings.details #>> '{_rawaj_seed,batch}' = v_batch;

  raise notice 'RAWAJ demo seed complete: % listings in batch %',
    (select count(*) from public.listings where details #>> '{_rawaj_seed,batch}' = v_batch),
    v_batch;
end $$;

commit;

select id, title, status, is_featured, created_at
from public.listings
where details #>> '{_rawaj_seed,batch}' = 'launch-catalog-v1'
order by created_at desc;
