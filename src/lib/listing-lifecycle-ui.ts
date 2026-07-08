import type { Language } from "@/lib/ui-preferences";

const CLOSED_LISTING_STATUSES = new Set([
  "sold",
  "rented",
  "unavailable",
  "expired",
  "archived",
]);

const REACTIVATABLE_LISTING_STATUSES = new Set([
  "sold",
  "rented",
  "unavailable",
  "expired",
]);

export function isClosedListingStatus(status: string) {
  return CLOSED_LISTING_STATUSES.has(status);
}

export function isReactivatableListingStatus(status: string) {
  return REACTIVATABLE_LISTING_STATUSES.has(status);
}

export function lifecycleStatusLabel(status: string, language: Language) {
  switch (status) {
    case "sold":
      return language === "ar" ? "تم البيع" : "Sold";
    case "rented":
      return language === "ar" ? "تم التأجير" : "Rented";
    case "unavailable":
      return language === "ar" ? "غير متاح" : "Unavailable";
    case "expired":
      return language === "ar" ? "منتهي" : "Expired";
    case "archived":
      return language === "ar" ? "مؤرشف" : "Archived";
    default:
      return null;
  }
}
