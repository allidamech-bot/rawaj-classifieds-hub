-- RAWAJ Phase 8: Arabic-normalized listing search.
-- Source-controlled only. Review and apply explicitly in Supabase Production.

create extension if not exists pg_trgm;

create or replace function public.rawaj_normalize_arabic_search(input text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select trim(
    regexp_replace(
      regexp_replace(
        translate(
          lower(coalesce(input, '')),
          'أإآٱىؤئ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
          'اااايوي01234567890123456789'
        ),
        '[ـًٌٍَُِّْٰۖۗۘۙۚۛۜ۝۞ۣ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬]',
        '',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

alter table public.listings
  add column if not exists search_text_normalized text
  generated always as (
    public.rawaj_normalize_arabic_search(
      coalesce(title, '') || ' ' || coalesce(description, '')
    )
  ) stored;

create index if not exists listings_search_text_normalized_trgm_idx
  on public.listings
  using gin (search_text_normalized gin_trgm_ops)
  where status = 'approved' and archived_at is null;

comment on column public.listings.search_text_normalized is
  'Generated Arabic-normalized search text used for indexed public listing discovery.';
comment on function public.rawaj_normalize_arabic_search(text) is
  'Normalizes Arabic alef/hamza variants, ya variants, diacritics, tatweel, Arabic digits, case, and whitespace for search.';
