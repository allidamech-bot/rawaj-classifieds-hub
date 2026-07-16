import type { ClassifiedListing } from "@/lib/classifieds-types";
import { governorateName } from "@/lib/i18n";

export function listingLocationDisplay(listing: ClassifiedListing, language: "ar" | "en"): string {
  const governorate = governorateName(
    listing.governorateId,
    listing.governorateNameAr ?? undefined,
    language,
  );
  const district = listing.districtAr?.trim();
  if (!district || district.startsWith("@")) return governorate;
  return [governorate, district].join(" / ");
}
