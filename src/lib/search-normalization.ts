import type { SupabaseClient } from "@supabase/supabase-js";

const arabicDiacritics = /[\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const whitespace = /\s+/g;
const normalizedSearchSupport = new WeakMap<object, Promise<boolean>>();

export function normalizeArabicSearchTerm(value: string) {
  return value
    .toLocaleLowerCase("ar")
    .replace(arabicDiacritics, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(whitespace, " ")
    .trim();
}

export function supportsNormalizedListingSearch(client: SupabaseClient) {
  const key = client as unknown as object;
  const cached = normalizedSearchSupport.get(key);
  if (cached) return cached;

  const pending = client
    .from("listings")
    .select("search_text_normalized")
    .limit(0)
    .then(({ error }) => !error)
    .catch(() => false);

  normalizedSearchSupport.set(key, pending);
  return pending;
}
