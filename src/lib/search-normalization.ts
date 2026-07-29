const combiningMarks = /\p{M}/gu;
const arabicTatweel = /\u0640/g;
const whitespace = /\s+/g;

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

/**
 * D1 search support is part of the Worker contract, so callers no longer probe
 * database columns from the browser. The parameter remains for source compatibility.
 */
export async function supportsNormalizedListingSearch(_retiredClient?: unknown): Promise<boolean> {
  return true;
}
