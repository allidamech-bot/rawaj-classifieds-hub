import type { Language } from "@/lib/ui-preferences";

export const MARKET_LOCALES: Record<Language, string> = {
  ar: "ar-SY",
  en: "en-US",
};

export function marketLocale(language: Language) {
  return MARKET_LOCALES[language];
}
