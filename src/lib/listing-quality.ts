import type { CategoryFieldKind, CategorySpecificDetails } from "@/lib/category-fields";
import type { ListingCondition } from "@/lib/classifieds-types";

export type ListingQualityCheckKey =
  | "category"
  | "title"
  | "description"
  | "primary_photo"
  | "photo_depth"
  | "price"
  | "location"
  | "category_details";

export interface ListingQualityCheck {
  key: ListingQualityCheckKey;
  done: boolean;
  weight: number;
}

export interface ListingQualityInput {
  categoryReady: boolean;
  title: string;
  description: string;
  imageCount: number;
  priceReady: boolean;
  locationReady: boolean;
  categoryFieldKind: CategoryFieldKind;
  categoryDetails: CategorySpecificDetails;
  condition: ListingCondition;
}

export interface ListingQualityResult {
  score: number;
  ready: boolean;
  checks: ListingQualityCheck[];
  completedWeight: number;
  totalWeight: number;
}

const QUALITY_WEIGHTS: Record<ListingQualityCheckKey, number> = {
  category: 15,
  title: 10,
  description: 15,
  primary_photo: 20,
  photo_depth: 10,
  price: 10,
  location: 10,
  category_details: 10,
};

export function calculateListingQuality(input: ListingQualityInput): ListingQualityResult {
  const safeImageCount = Math.max(0, Math.floor(input.imageCount));
  const checks: ListingQualityCheck[] = [
    qualityCheck("category", input.categoryReady),
    qualityCheck("title", input.title.trim().length >= 12),
    qualityCheck("description", input.description.trim().length >= 60),
    qualityCheck("primary_photo", safeImageCount >= 1),
    qualityCheck("photo_depth", safeImageCount >= 3),
    qualityCheck("price", input.priceReady),
    qualityCheck("location", input.locationReady),
    qualityCheck(
      "category_details",
      hasMeaningfulCategoryDetails(input.categoryFieldKind, input.categoryDetails, input.condition),
    ),
  ];
  const totalWeight = checks.reduce((total, check) => total + check.weight, 0);
  const completedWeight = checks.reduce(
    (total, check) => total + (check.done ? check.weight : 0),
    0,
  );
  const score = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

  return {
    score,
    ready: checks.every((check) => check.done),
    checks,
    completedWeight,
    totalWeight,
  };
}

export function listingQualityCheckLabel(
  key: ListingQualityCheckKey,
  text: (ar: string, en: string) => string,
) {
  const labels: Record<ListingQualityCheckKey, [string, string]> = {
    category: ["القسم الدقيق محدد", "Precise category selected"],
    title: ["عنوان واضح من 12 حرفاً", "Clear title of at least 12 characters"],
    description: ["وصف مفيد من 60 حرفاً", "Useful description of at least 60 characters"],
    primary_photo: ["صورة رئيسية مضافة", "Primary photo added"],
    photo_depth: ["ثلاث صور أو أكثر", "Three or more photos"],
    price: ["السعر أو نوعه مكتمل", "Price or price type completed"],
    location: ["الموقع مكتمل", "Location completed"],
    category_details: ["مواصفات القسم الأساسية", "Essential category details"],
  };
  const [ar, en] = labels[key];
  return text(ar, en);
}

function qualityCheck(key: ListingQualityCheckKey, done: boolean): ListingQualityCheck {
  return { key, done, weight: QUALITY_WEIGHTS[key] };
}

function hasMeaningfulCategoryDetails(
  kind: CategoryFieldKind,
  details: CategorySpecificDetails,
  condition: ListingCondition,
) {
  if (kind === "real_estate") {
    return completedFields([
      details.property_type,
      details.listing_purpose,
      details.area_sqm,
      details.rooms ?? details.bedrooms,
    ]) >= 2;
  }

  if (kind === "vehicles") {
    return completedFields([
      details.car_make ?? details.make,
      details.car_model ?? details.model,
      details.year,
      details.mileage_km,
      details.fuel_type,
      details.transmission,
    ]) >= 2;
  }

  if (kind === "electronics") {
    return completedFields([
      details.electronics_brand,
      details.electronics_model,
      details.storage,
      details.ram,
      details.condition,
    ]) >= 2;
  }

  if (kind === "jobs") {
    return completedFields([
      details.job_type ?? details.employment_type,
      details.experience_level,
      details.work_location,
      details.salary_type,
    ]) >= 2;
  }

  if (kind === "services") {
    return completedFields([
      details.service_type,
      details.service_area,
      details.delivery_time,
      details.starting_price,
    ]) >= 1;
  }

  return condition !== "not_applicable" || completedFields(Object.values(details)) > 0;
}

function completedFields(values: unknown[]) {
  return values.filter((value) => {
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return Number.isFinite(value) && value >= 0;
    if (typeof value === "boolean") return true;
    return value !== null && value !== undefined;
  }).length;
}
