import type { ClassifiedCategory, ClassifiedListing } from "@/lib/classifieds-types";

export type CategoryFieldKind = "real_estate" | "vehicles" | "general";

export interface CategorySpecificDetails {
  property_type?: string;
  listing_purpose?: string;
  bedrooms?: number;
  bathrooms?: number;
  area_sqm?: number;
  floor?: number;
  furnished?: boolean;
  parking?: boolean;
  make?: string;
  model?: string;
  year?: number;
  mileage_km?: number;
  fuel_type?: string;
  transmission?: string;
  vehicle_condition?: string;
  color?: string;
}

export const propertyTypeOptions = [
  "apartment",
  "house",
  "villa",
  "land",
  "shop",
  "office",
  "warehouse",
  "other",
] as const;

export const listingPurposeOptions = ["sale", "rent"] as const;
export const fuelTypeOptions = ["gasoline", "diesel", "hybrid", "electric", "other"] as const;
export const transmissionOptions = ["automatic", "manual"] as const;
export const vehicleConditionOptions = ["new", "used"] as const;

export function detectCategoryFieldKind(
  category?: Pick<ClassifiedCategory, "id" | "slug" | "nameAr" | "placeholder"> | null,
  listing?: Pick<ClassifiedListing, "categoryId" | "categoryNameAr" | "categoryPlaceholder"> | null,
): CategoryFieldKind {
  const haystack = [
    category?.id,
    category?.slug,
    category?.nameAr,
    category?.placeholder,
    listing?.categoryId,
    listing?.categoryNameAr,
    listing?.categoryPlaceholder,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    haystack.includes("real") ||
    haystack.includes("estate") ||
    haystack.includes("عقار") ||
    haystack.includes("عقارات") ||
    haystack.includes("realestate")
  ) {
    return "real_estate";
  }

  if (
    haystack.includes("car") ||
    haystack.includes("vehicle") ||
    haystack.includes("auto") ||
    haystack.includes("سيار") ||
    haystack.includes("مركب")
  ) {
    return "vehicles";
  }

  return "general";
}

export function sanitizeCategoryDetails(
  kind: CategoryFieldKind,
  input: CategorySpecificDetails,
): Record<string, unknown> {
  if (kind === "real_estate") {
    return stripEmpty({
      property_type: enumValue(input.property_type, propertyTypeOptions),
      listing_purpose: enumValue(input.listing_purpose, listingPurposeOptions),
      bedrooms: numberValue(input.bedrooms, 0, 30),
      bathrooms: numberValue(input.bathrooms, 0, 30),
      area_sqm: numberValue(input.area_sqm, 1, 100000),
      floor: numberValue(input.floor, -5, 200),
      furnished: booleanValue(input.furnished),
      parking: booleanValue(input.parking),
    });
  }

  if (kind === "vehicles") {
    return stripEmpty({
      make: textValue(input.make, 60),
      model: textValue(input.model, 60),
      year: numberValue(input.year, 1900, new Date().getFullYear() + 1),
      mileage_km: numberValue(input.mileage_km, 0, 2000000),
      fuel_type: enumValue(input.fuel_type, fuelTypeOptions),
      transmission: enumValue(input.transmission, transmissionOptions),
      vehicle_condition: enumValue(input.vehicle_condition, vehicleConditionOptions),
      color: textValue(input.color, 40),
    });
  }

  return {};
}

export function mergeCategoryDetails(
  existingDetails: Record<string, unknown>,
  kind: CategoryFieldKind,
  input: CategorySpecificDetails,
) {
  const next = { ...existingDetails };
  for (const key of categoryDetailKeys) delete next[key];
  return { ...next, ...sanitizeCategoryDetails(kind, input) };
}

export function readCategoryDetails(details: Record<string, unknown>): CategorySpecificDetails {
  return {
    property_type: readString(details, "property_type"),
    listing_purpose: readString(details, "listing_purpose"),
    bedrooms: readNumber(details, "bedrooms"),
    bathrooms: readNumber(details, "bathrooms"),
    area_sqm: readNumber(details, "area_sqm"),
    floor: readNumber(details, "floor"),
    furnished: readBoolean(details, "furnished"),
    parking: readBoolean(details, "parking"),
    make: readString(details, "make"),
    model: readString(details, "model"),
    year: readNumber(details, "year"),
    mileage_km: readNumber(details, "mileage_km"),
    fuel_type: readString(details, "fuel_type"),
    transmission: readString(details, "transmission"),
    vehicle_condition: readString(details, "vehicle_condition"),
    color: readString(details, "color"),
  };
}

export function categoryDetailDisplayRows(
  kind: CategoryFieldKind,
  details: Record<string, unknown>,
  text: (ar: string, en: string) => string,
) {
  const value = readCategoryDetails(details);
  if (kind === "real_estate") {
    return compactRows([
      [text("نوع العقار", "Property type"), label(propertyTypeLabels, value.property_type, text)],
      [text("الغرض", "Purpose"), label(purposeLabels, value.listing_purpose, text)],
      [text("غرف النوم", "Bedrooms"), numberLabel(value.bedrooms)],
      [text("الحمامات", "Bathrooms"), numberLabel(value.bathrooms)],
      [text("المساحة", "Area"), value.area_sqm ? `${value.area_sqm} ${text("م²", "sqm")}` : ""],
      [text("الطابق", "Floor"), numberLabel(value.floor)],
      [text("مفروش", "Furnished"), boolLabel(value.furnished, text)],
      [text("موقف سيارة", "Parking"), boolLabel(value.parking, text)],
    ]);
  }

  if (kind === "vehicles") {
    return compactRows([
      [text("الشركة", "Make"), value.make],
      [text("الطراز", "Model"), value.model],
      [text("السنة", "Year"), numberLabel(value.year)],
      [
        text("المسافة", "Mileage"),
        value.mileage_km ? `${value.mileage_km} ${text("كم", "km")}` : "",
      ],
      [text("الوقود", "Fuel"), label(fuelLabels, value.fuel_type, text)],
      [text("ناقل الحركة", "Transmission"), label(transmissionLabels, value.transmission, text)],
      [
        text("حالة السيارة", "Vehicle condition"),
        label(vehicleConditionLabels, value.vehicle_condition, text),
      ],
      [text("اللون", "Color"), value.color],
    ]);
  }

  return [];
}

const categoryDetailKeys = [
  "property_type",
  "listing_purpose",
  "bedrooms",
  "bathrooms",
  "area_sqm",
  "floor",
  "furnished",
  "parking",
  "make",
  "model",
  "year",
  "mileage_km",
  "fuel_type",
  "transmission",
  "vehicle_condition",
  "color",
];

const propertyTypeLabels = {
  apartment: ["شقة", "Apartment"],
  house: ["منزل", "House"],
  villa: ["فيلا", "Villa"],
  land: ["أرض", "Land"],
  shop: ["محل", "Shop"],
  office: ["مكتب", "Office"],
  warehouse: ["مستودع", "Warehouse"],
  other: ["أخرى", "Other"],
} as const;

const purposeLabels = {
  sale: ["بيع", "Sale"],
  rent: ["إيجار", "Rent"],
} as const;

const fuelLabels = {
  gasoline: ["بنزين", "Gasoline"],
  diesel: ["ديزل", "Diesel"],
  hybrid: ["هايبرد", "Hybrid"],
  electric: ["كهرباء", "Electric"],
  other: ["أخرى", "Other"],
} as const;

const transmissionLabels = {
  automatic: ["أوتوماتيك", "Automatic"],
  manual: ["يدوي", "Manual"],
} as const;

const vehicleConditionLabels = {
  new: ["جديدة", "New"],
  used: ["مستعملة", "Used"],
} as const;

function enumValue<T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined {
  return typeof value === "string" && allowed.includes(value) ? value : undefined;
}

function textValue(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : undefined;
}

function numberValue(value: unknown, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return undefined;
  const rounded = Math.trunc(number);
  return rounded >= min && rounded <= max ? rounded : undefined;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function stripEmpty(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function readString(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return typeof value === "string" ? value : undefined;
}

function readNumber(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return typeof value === "number" ? value : undefined;
}

function readBoolean(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return typeof value === "boolean" ? value : undefined;
}

function compactRows(rows: Array<[string, string | undefined]>) {
  return rows.filter((row): row is [string, string] => Boolean(row[1]));
}

function numberLabel(value: number | undefined) {
  return value === undefined ? "" : String(value);
}

function boolLabel(value: boolean | undefined, text: (ar: string, en: string) => string) {
  if (value === undefined) return "";
  return value ? text("نعم", "Yes") : text("لا", "No");
}

function label(
  labels: Record<string, readonly [string, string]>,
  key: string | undefined,
  text: (ar: string, en: string) => string,
) {
  if (!key) return "";
  const value = labels[key];
  return value ? text(value[0], value[1]) : key;
}
