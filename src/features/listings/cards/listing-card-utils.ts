import {
  detectCategoryFieldKind,
  readCategoryDetails,
  type CategorySpecificDetails,
} from "@/lib/category-fields";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { marketLocale } from "@/lib/market-locale";

export type ListingCardVariant = "product" | "vehicle" | "property";
export type ListingCardLanguage = "ar" | "en";

export interface ListingCardFact {
  key: string;
  label: string;
  value: string;
}

export function resolveListingCardVariant(listing: ClassifiedListing): ListingCardVariant {
  const kind = detectCategoryFieldKind(undefined, listing);
  if (kind === "vehicles") return "vehicle";
  if (kind === "real_estate") return "property";
  return "product";
}

export function listingCardDetails(listing: ClassifiedListing): CategorySpecificDetails {
  return readCategoryDetails(listing.details);
}

export function vehicleCardFacts(
  listing: ClassifiedListing,
  language: ListingCardLanguage,
): ListingCardFact[] {
  const details = listingCardDetails(listing);
  return compactFacts([
    details.year
      ? { key: "year", label: text(language, "السنة", "Year"), value: String(details.year) }
      : null,
    typeof details.mileage_km === "number"
      ? {
          key: "mileage",
          label: text(language, "المسافة", "Mileage"),
          value: `${formatNumber(details.mileage_km, language)} ${text(language, "كم", "km")}`,
        }
      : null,
    details.transmission
      ? {
          key: "transmission",
          label: text(language, "الناقل", "Transmission"),
          value: optionLabel(details.transmission, transmissionLabels, language),
        }
      : null,
    details.fuel_type
      ? {
          key: "fuel",
          label: text(language, "الوقود", "Fuel"),
          value: optionLabel(details.fuel_type, fuelLabels, language),
        }
      : null,
  ]).slice(0, 3);
}

export function propertyCardFacts(
  listing: ClassifiedListing,
  language: ListingCardLanguage,
): ListingCardFact[] {
  const details = listingCardDetails(listing);
  return compactFacts([
    details.listing_purpose
      ? {
          key: "purpose",
          label: text(language, "الغرض", "Purpose"),
          value: optionLabel(details.listing_purpose, propertyPurposeLabels, language),
        }
      : null,
    typeof details.area_sqm === "number"
      ? {
          key: "area",
          label: text(language, "المساحة", "Area"),
          value: `${formatNumber(details.area_sqm, language)} م²`,
        }
      : null,
    typeof details.bedrooms === "number"
      ? {
          key: "bedrooms",
          label: text(language, "غرف النوم", "Bedrooms"),
          value: formatNumber(details.bedrooms, language),
        }
      : typeof details.rooms === "number"
        ? {
            key: "rooms",
            label: text(language, "الغرف", "Rooms"),
            value: formatNumber(details.rooms, language),
          }
        : null,
    details.property_type
      ? {
          key: "propertyType",
          label: text(language, "النوع", "Type"),
          value: optionLabel(details.property_type, propertyTypeLabels, language),
        }
      : null,
  ]).slice(0, 3);
}

export function productCardFacts(
  listing: ClassifiedListing,
  language: ListingCardLanguage,
): ListingCardFact[] {
  const details = listingCardDetails(listing);
  return compactFacts([
    details.electronics_brand
      ? {
          key: "brand",
          label: text(language, "الشركة", "Brand"),
          value: details.electronics_brand,
        }
      : null,
    details.storage
      ? {
          key: "storage",
          label: text(language, "السعة", "Storage"),
          value: details.storage,
        }
      : null,
    details.ram
      ? { key: "ram", label: text(language, "الذاكرة", "RAM"), value: details.ram }
      : null,
    details.condition
      ? {
          key: "condition",
          label: text(language, "الحالة", "Condition"),
          value: optionLabel(details.condition, conditionLabels, language),
        }
      : null,
  ]).slice(0, 2);
}

function compactFacts(facts: Array<ListingCardFact | null>): ListingCardFact[] {
  return facts.filter((fact): fact is ListingCardFact => Boolean(fact));
}

function text(language: ListingCardLanguage, ar: string, en: string) {
  return language === "ar" ? ar : en;
}

function formatNumber(value: number, language: ListingCardLanguage) {
  return new Intl.NumberFormat(marketLocale(language), {
    maximumFractionDigits: 0,
  }).format(value);
}

function optionLabel(
  value: string,
  labels: Record<string, { ar: string; en: string }>,
  language: ListingCardLanguage,
) {
  const label = labels[value];
  return label ? label[language] : value.replaceAll("_", " ");
}

const transmissionLabels = {
  automatic: { ar: "أوتوماتيك", en: "Automatic" },
  manual: { ar: "يدوي", en: "Manual" },
  semi_auto: { ar: "نصف أوتوماتيك", en: "Semi-auto" },
};

const fuelLabels = {
  gasoline: { ar: "بنزين", en: "Gasoline" },
  diesel: { ar: "ديزل", en: "Diesel" },
  hybrid: { ar: "هجين", en: "Hybrid" },
  electric: { ar: "كهرباء", en: "Electric" },
  gas: { ar: "غاز", en: "Gas" },
  other: { ar: "أخرى", en: "Other" },
};

const propertyPurposeLabels = {
  sale: { ar: "بيع", en: "Sale" },
  rent: { ar: "إيجار", en: "Rent" },
};

const propertyTypeLabels = {
  apartment: { ar: "شقة", en: "Apartment" },
  house: { ar: "منزل", en: "House" },
  villa: { ar: "فيلا", en: "Villa" },
  land: { ar: "أرض", en: "Land" },
  shop: { ar: "محل", en: "Shop" },
  office: { ar: "مكتب", en: "Office" },
  warehouse: { ar: "مستودع", en: "Warehouse" },
  other: { ar: "أخرى", en: "Other" },
};

const conditionLabels = {
  new: { ar: "جديد", en: "New" },
  used: { ar: "مستعمل", en: "Used" },
  excellent: { ar: "ممتاز", en: "Excellent" },
  good: { ar: "جيد", en: "Good" },
  needs_work: { ar: "يحتاج صيانة", en: "Needs work" },
};
