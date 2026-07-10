import type { LocationNodeType } from "@/lib/api/location-taxonomy";

export type LocationDisplayLanguage = "ar" | "en";

const LOCATION_NODE_TYPE_LABELS: Record<
  LocationNodeType,
  Record<LocationDisplayLanguage, string>
> = {
  country: { ar: "بلد", en: "Country" },
  governorate: { ar: "محافظة", en: "Governorate" },
  district: { ar: "منطقة", en: "District" },
  subdistrict: { ar: "ناحية", en: "Subdistrict" },
  city: { ar: "مدينة", en: "City" },
  town: { ar: "بلدة", en: "Town" },
  village: { ar: "قرية", en: "Village" },
  neighborhood: { ar: "حي", en: "Neighborhood" },
  locality: { ar: "تجمّع سكاني", en: "Community" },
};

export function getLocationNodeTypeLabel(
  nodeType: LocationNodeType,
  language: LocationDisplayLanguage,
) {
  return LOCATION_NODE_TYPE_LABELS[nodeType][language];
}

export function getLocationNodeOptionLabel(
  node: Pick<{ nodeType: LocationNodeType; nameAr: string; nameEn: string | null }, "nodeType" | "nameAr" | "nameEn">,
  language: LocationDisplayLanguage,
) {
  const name = language === "en" ? node.nameEn || node.nameAr : node.nameAr;
  return `${name} — ${getLocationNodeTypeLabel(node.nodeType, language)}`;
}
