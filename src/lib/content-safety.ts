const prohibitedTerms = [
  "سلاح",
  "مسدس",
  "بندقية",
  "ذخيرة",
  "متفجرات",
  "مخدر",
  "حشيش",
  "كبتاغون",
  "هيروين",
  "كوكايين",
  "مسروق",
  "تزوير",
  "وثيقة مزورة",
  "جواز سفر",
  "هوية مزورة",
  "أعضاء بشرية",
  "تهريب",
  "ابتزاز",
  "weapon",
  "gun",
  "rifle",
  "ammo",
  "explosive",
  "drug",
  "narcotic",
  "stolen",
  "counterfeit",
  "forged",
  "blackmail",
];

export interface ContentSafetyResult {
  blocked: boolean;
  flags: string[];
  messageAr: string | null;
}

export function checkListingContentSafety(values: Array<unknown>): ContentSafetyResult {
  const source = values
    .flatMap((value) => collectText(value))
    .join(" ")
    .toLowerCase();

  const flags = prohibitedTerms.filter((term) => source.includes(term.toLowerCase()));

  return {
    blocked: flags.length > 0,
    flags,
    messageAr:
      flags.length > 0
        ? "لا يمكن إرسال الإعلان لأن النص يحتوي على كلمات مرتبطة بمواد أو خدمات ممنوعة. عدل النص ثم حاول مرة أخرى."
        : null,
  };
}

export function normalizeContactValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function isSafePhoneValue(value: string) {
  const normalized = normalizeContactValue(value);
  return /^[+\d\s().-]{6,24}$/.test(normalized);
}

function collectText(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectText(item));
  return Object.values(value as Record<string, unknown>).flatMap((item) => collectText(item));
}
