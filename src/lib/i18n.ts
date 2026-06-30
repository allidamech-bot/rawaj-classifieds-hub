import type { Language } from "@/lib/ui-preferences";
import type { PriceType } from "@/types";

export const categoryLabels: Record<string, { ar: string; en: string; hintEn?: string }> = {
  cars: { ar: "سيارات ومركبات", en: "Cars and Vehicles", hintEn: "Cars, parts, and vehicles" },
  realestate: { ar: "عقارات", en: "Real Estate", hintEn: "Homes, rentals, shops, and land" },
  mobiles: { ar: "موبايلات وتابلت", en: "Mobiles and Tablets", hintEn: "Devices and accessories" },
  electronics: { ar: "إلكترونيات", en: "Electronics", hintEn: "Laptops, screens, and devices" },
  furniture: { ar: "منزل وأثاث", en: "Home and Furniture", hintEn: "Home, office, and decor" },
  jobs: { ar: "وظائف", en: "Jobs", hintEn: "Open roles and job seekers" },
  services: { ar: "خدمات", en: "Services", hintEn: "Repair, delivery, cleaning, and design" },
  fashion: {
    ar: "أزياء ومستلزمات",
    en: "Fashion and Accessories",
    hintEn: "Clothing, watches, and accessories",
  },
  food: {
    ar: "أطعمة ومنتجات محلية",
    en: "Food and Local Products",
    hintEn: "Local goods and groceries",
  },
  animals: { ar: "حيوانات ومواشي", en: "Animals and Livestock", hintEn: "Livestock and supplies" },
  education: {
    ar: "تعليم ودورات",
    en: "Education and Courses",
    hintEn: "Courses, tutors, and training",
  },
  business: {
    ar: "أعمال وصناعة",
    en: "Business and Industry",
    hintEn: "Equipment, shops, and projects",
  },
  misc: { ar: "المزيد", en: "More", hintEn: "General listings" },
};

export const governorateLabels: Record<string, { ar: string; en: string }> = {
  damascus: { ar: "دمشق", en: "Damascus" },
  "rif-dimashq": { ar: "ريف دمشق", en: "Rif Dimashq" },
  aleppo: { ar: "حلب", en: "Aleppo" },
  homs: { ar: "حمص", en: "Homs" },
  hama: { ar: "حماة", en: "Hama" },
  latakia: { ar: "اللاذقية", en: "Latakia" },
  tartus: { ar: "طرطوس", en: "Tartus" },
  idlib: { ar: "إدلب", en: "Idlib" },
  "deir-ez-zor": { ar: "دير الزور", en: "Deir ez-Zor" },
  raqqa: { ar: "الرقة", en: "Raqqa" },
  hasakah: { ar: "الحسكة", en: "Hasakah" },
  daraa: { ar: "درعا", en: "Daraa" },
  suwayda: { ar: "السويداء", en: "Suwayda" },
  quneitra: { ar: "القنيطرة", en: "Quneitra" },
};

export function localized(language: Language, ar: string, en: string) {
  return language === "ar" ? ar : en;
}

export function categoryName(
  id: string | undefined,
  fallback: string | undefined,
  language: Language,
) {
  if (!id) return fallback ?? localized(language, "إعلان", "Listing");
  const label = categoryLabels[id];
  if (!label) return fallback ?? localized(language, "إعلان", "Listing");
  return language === "ar" ? label.ar : label.en;
}

export function categoryHint(id: string, fallbackAr: string, language: Language) {
  const label = categoryLabels[id];
  if (!label) return fallbackAr;
  return language === "ar" ? fallbackAr || label.ar : (label.hintEn ?? label.en);
}

export function governorateName(
  id: string | undefined,
  fallback: string | undefined,
  language: Language,
) {
  if (!id) return fallback ?? localized(language, "سوريا", "Syria");
  const label = governorateLabels[id];
  if (!label) return fallback ?? localized(language, "سوريا", "Syria");
  return language === "ar" ? label.ar : label.en;
}

const arNumber = new Intl.NumberFormat("ar-SY", { maximumFractionDigits: 0 });
const enNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatPriceLocalized(
  price: number,
  type: PriceType | string,
  language: Language,
  currency: "SYP" | "USD" = "SYP",
) {
  const number = language === "ar" ? arNumber.format(price) : enNumber.format(price);
  const currencyLabel = currency === "SYP" ? localized(language, "ل.س", "SYP") : "$";
  const amount = `${number} ${currencyLabel}`;

  switch (type) {
    case "free":
      return localized(language, "مجاناً", "Free");
    case "contact":
      return localized(language, "السعر عند التواصل", "Price on contact");
    case "exchange":
      return localized(language, "للمبادلة", "For exchange");
    case "negotiable":
      return price
        ? localized(language, `${amount} · قابل للتفاوض`, `${amount} · Negotiable`)
        : localized(language, "السعر قابل للتفاوض", "Price negotiable");
    default:
      return price ? amount : localized(language, "السعر غير محدد", "Price not set");
  }
}
