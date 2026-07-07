export type LocationNodeType =
  | "country"
  | "governorate"
  | "district"
  | "subdistrict"
  | "city"
  | "town"
  | "village"
  | "neighborhood"
  | "locality";

export interface LocationNode {
  id: string;
  parentId: string | null;
  countryCode: string;
  nodeType: LocationNodeType;
  nameAr: string;
  nameEn: string | null;
  slug: string;
  officialCode: string | null;
  externalSource: string | null;
  externalId: string | null;
  latitude: number | null;
  longitude: number | null;
  sortOrder: number;
  depth: number;
  isActive: boolean;
  searchAliases: string[];
  legacyGovernorateId: string | null;
  legacyDistrictAr: string | null;
}
