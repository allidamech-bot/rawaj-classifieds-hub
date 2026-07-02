-- RAWAJ Syrian governorates/districts completion.
-- Manual review required. Do not apply automatically from frontend tooling.
--
-- This keeps existing governorate ids/slugs and appends any existing legacy
-- neighborhood/area values after the administrative district list so old
-- listing district_ar values remain selectable/filterable during transition.

create or replace function public.rawaj_merge_districts(
  preferred text[],
  existing text[]
)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(value order by first_seen), '{}'::text[])
  from (
    select value, min(position) as first_seen
    from (
      select value, position
      from unnest(preferred) with ordinality as preferred_values(value, position)
      where btrim(value) <> ''
      union all
      select value, position + 1000
      from unnest(coalesce(existing, '{}'::text[])) with ordinality as existing_values(value, position)
      where btrim(value) <> ''
    ) merged
    group by value
  ) deduped;
$$;

update public.governorates
set districts_ar = public.rawaj_merge_districts(array['دمشق'], districts_ar)
where id = 'damascus';

update public.governorates
set districts_ar = public.rawaj_merge_districts(
  array['دوما', 'التل', 'يبرود', 'النبك', 'القطيفة', 'الزبداني', 'قطنا', 'داريا', 'مركز ريف دمشق', 'قدسيا'],
  districts_ar
)
where id = 'rif-dimashq';

update public.governorates
set districts_ar = public.rawaj_merge_districts(
  array['جبل سمعان', 'الباب', 'أعزاز', 'عفرين', 'جرابلس', 'السفيرة', 'منبج', 'عين العرب', 'الأتارب', 'دير حافر'],
  districts_ar
)
where id = 'aleppo';

update public.governorates
set districts_ar = public.rawaj_merge_districts(
  array['حمص', 'تلدو', 'الرستن', 'تلكلخ', 'القصير', 'تدمر', 'المخرم', 'القريتين'],
  districts_ar
)
where id = 'homs';

update public.governorates
set districts_ar = public.rawaj_merge_districts(
  array['حماة', 'محردة', 'السقيلبية', 'مصياف', 'سلمية'],
  districts_ar
)
where id = 'hama';

update public.governorates
set districts_ar = public.rawaj_merge_districts(
  array['اللاذقية', 'جبلة', 'الحفة', 'القرداحة'],
  districts_ar
)
where id = 'latakia';

update public.governorates
set districts_ar = public.rawaj_merge_districts(
  array['طرطوس', 'بانياس', 'الشيخ بدر', 'الدريكيش', 'صافيتا'],
  districts_ar
)
where id = 'tartus';

update public.governorates
set districts_ar = public.rawaj_merge_districts(
  array['إدلب', 'أريحا', 'جسر الشغور', 'معرة النعمان', 'حارم'],
  districts_ar
)
where id = 'idlib';

update public.governorates
set districts_ar = public.rawaj_merge_districts(
  array['دير الزور', 'الميادين', 'البوكمال'],
  districts_ar
)
where id = 'deir-ez-zor';

update public.governorates
set districts_ar = public.rawaj_merge_districts(
  array['الرقة', 'الثورة', 'تل أبيض'],
  districts_ar
)
where id = 'raqqa';

update public.governorates
set districts_ar = public.rawaj_merge_districts(
  array['الحسكة', 'القامشلي', 'المالكية', 'رأس العين'],
  districts_ar
)
where id = 'hasakah';

update public.governorates
set districts_ar = public.rawaj_merge_districts(
  array['درعا', 'الصنمين', 'إزرع'],
  districts_ar
)
where id = 'daraa';

update public.governorates
set districts_ar = public.rawaj_merge_districts(
  array['السويداء', 'شهبا', 'صلخد'],
  districts_ar
)
where id = 'suwayda';

update public.governorates
set districts_ar = public.rawaj_merge_districts(
  array['القنيطرة', 'فيق'],
  districts_ar
)
where id = 'quneitra';

drop function public.rawaj_merge_districts(text[], text[]);
