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

const LOCATION_LEVEL_PROMPTS: Record<LocationNodeType, Record<LocationDisplayLanguage, string>> = {
  country: { ar: "اختر البلد", en: "Choose country" },
  governorate: { ar: "اختر المحافظة", en: "Choose governorate" },
  district: { ar: "اختر المنطقة", en: "Choose district" },
  subdistrict: { ar: "اختر الناحية", en: "Choose subdistrict" },
  city: { ar: "اختر المدينة", en: "Choose city" },
  town: { ar: "اختر البلدة", en: "Choose town" },
  village: { ar: "اختر القرية", en: "Choose village" },
  neighborhood: { ar: "اختر الحي", en: "Choose neighborhood" },
  locality: { ar: "اختر التجمّع السكاني", en: "Choose community" },
};

const POPULATED_PLACE_TYPES = new Set<LocationNodeType>([
  "city",
  "town",
  "village",
  "locality",
]);

export function getLocationNodeTypeLabel(
  nodeType: LocationNodeType,
  language: LocationDisplayLanguage,
) {
  return LOCATION_NODE_TYPE_LABELS[nodeType][language];
}

export function getLocationNodeOptionLabel(
  node: Pick<
    { nodeType: LocationNodeType; nameAr: string; nameEn: string | null },
    "nodeType" | "nameAr" | "nameEn"
  >,
  language: LocationDisplayLanguage,
) {
  const name = language === "en" ? node.nameEn || node.nameAr : node.nameAr;
  return `${name} — ${getLocationNodeTypeLabel(node.nodeType, language)}`;
}

export function getLocationLevelPrompt(
  nodes: Array<Pick<{ nodeType: LocationNodeType }, "nodeType">>,
  language: LocationDisplayLanguage,
) {
  const types = [...new Set(nodes.map((node) => node.nodeType))];
  const singleType = types.length === 1 ? types[0] : undefined;
  if (singleType) return LOCATION_LEVEL_PROMPTS[singleType][language];

  if (types.length > 1 && types.every((type) => POPULATED_PLACE_TYPES.has(type))) {
    return language === "en"
      ? "Choose city, town, village, or community"
      : "اختر المدينة أو البلدة أو القرية أو التجمّع";
  }

  return language === "en" ? "Choose next location" : "اختر الموقع التالي";
}
