import type { SupabaseClient } from "@supabase/supabase-js";

const combiningMarks = /\p{M}/gu;
const arabicTatweel = /\u0640/g;
const whitespace = /\s+/g;
const normalizedSearchSupport = new WeakMap<SupabaseClient, boolean>();

export function normalizeArabicSearchTerm(value: string): string {
  return value
    .toLocaleLowerCase("ar")
    .normalize("NFD")
    .replace(combiningMarks, "")
    .replace(arabicTatweel, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(whitespace, " ")
    .trim();
}

export async function supportsNormalizedListingSearch(client: SupabaseClient): Promise<boolean> {
  const cached = normalizedSearchSupport.get(client);
  if (cached !== undefined) return cached;

  try {
    const { error } = await client.from("listings").select("search_text_normalized").limit(0);
    const supported = !error;
    normalizedSearchSupport.set(client, supported);
    return supported;
  } catch {
    normalizedSearchSupport.set(client, false);
    return false;
  }
}
