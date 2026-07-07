import type { LocationNodeType } from "@/lib/api/location-taxonomy";

export function locationLevelLabel(type: LocationNodeType | undefined, language: "ar" | "en") {
  const ar: Record<string, string> = {
    governorate: "المحافظة",
    district: "المنطقة",
    subdistrict: "الناحية",
    city: "المدينة",
    town: "البلدة",
    village: "القرية",
    neighborhood: "الحي",
    locality: "الموقع",
  };
  const en: Record<string, string> = {
    governorate: "Governorate",
    district: "District",
    subdistrict: "Subdistrict",
    city: "City",
    town: "Town",
    village: "Village",
    neighborhood: "Neighborhood",
    locality: "Location",
  };
  const key = type ?? "locality";
  return language === "en" ? en[key] ?? "Location" : ar[key] ?? "الموقع";
}
