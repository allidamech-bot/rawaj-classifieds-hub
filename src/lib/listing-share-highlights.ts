import type { CategoryFieldKind } from "@/lib/category-fields";
import type { ClassifiedListing, ListingCondition } from "@/lib/classifieds-types";

export interface ListingShareHighlight {
  label: string;
  value: string;
}

type Language = "ar" | "en";
type LocalizedLabels = Record<string, readonly [ar: string, en: string]>;

const propertyTypeLabels: LocalizedLabels = {
  apartment: ["شقة", "Apartment"],
  house: ["منزل", "House"],
  villa: ["فيلا", "Villa"],
  land: ["أرض", "Land"],
  shop: ["محل", "Shop"],
  office: ["مكتب", "Office"],
  warehouse: ["مستودع", "Warehouse"],
  other: ["أخرى", "Other"],
};

const purposeLabels: LocalizedLabels = {
  sale: ["بيع", "Sale"],
  rent: ["إيجار", "Rent"],
};

const transmissionLabels: LocalizedLabels = {
  automatic: ["أوتوماتيك", "Automatic"],
  manual: ["يدوي", "Manual"],
  semi_auto: ["نصف أوتوماتيك", "Semi-auto"],
};

const conditionLabels: Record<
  ListingCondition | "excellent" | "good" | "needs_work",
  readonly [string, string]
> = {
  new: ["جديد", "New"],
  like_new: ["كالجديد", "Like new"],
  used: ["مستعمل", "Used"],
  for_parts: ["للقطع", "For parts"],
  not_applicable: ["", ""],
  excellent: ["ممتاز", "Excellent"],
  good: ["جيد", "Good"],
  needs_work: ["يحتاج صيانة", "Needs work"],
};

const employmentTypeLabels: LocalizedLabels = {
  full_time: ["دوام كامل", "Full-time"],
  part_time: ["دوام جزئي", "Part-time"],
  contract: ["عقد", "Contract"],
  temporary: ["مؤقت", "Temporary"],
  internship: ["تدريب", "Internship"],
};

const workLocationLabels: LocalizedLabels = {
  onsite: ["حضوري", "On-site"],
  remote: ["عن بعد", "Remote"],
  hybrid: ["هجين", "Hybrid"],
  field: ["ميداني", "Field"],
};

const deliveryTimeLabels: LocalizedLabels = {
  same_day: ["نفس اليوم", "Same day"],
  two_three_days: ["2-3 أيام", "2-3 days"],
  week: ["خلال أسبوع", "Within a week"],
  negotiable: ["حسب الاتفاق", "Negotiable"],
};

export function listingShareHighlights(
  listing: Pick<ClassifiedListing, "condition" | "details">,
  kind: CategoryFieldKind,
  language: string,
): ListingShareHighlight[] {
  const locale: Language = language === "en" ? "en" : "ar";
  const details = listing.details ?? {};
  const candidates: Array<ListingShareHighlight | null> = [];

  if (kind === "vehicles") {
    candidates.push(
      combinedHighlight(
        label(locale, "المركبة", "Vehicle"),
        [readText(details, "car_make", "make"), readText(details, "car_model", "model")],
      ),
      numberHighlight(label(locale, "السنة", "Year"), readNumber(details, "year"), locale),
      numberHighlight(
        label(locale, "المسافة", "Mileage"),
        readNumber(details, "mileage_km"),
        locale,
        label(locale, "كم", "km"),
      ),
      enumHighlight(
        label(locale, "ناقل الحركة", "Transmission"),
        readText(details, "transmission"),
        transmissionLabels,
        locale,
      ),
      conditionHighlight(
        readText(details, "vehicle_condition") ?? listing.condition,
        locale,
      ),
    );
  } else if (kind === "real_estate") {
    candidates.push(
      combinedHighlight(label(locale, "العقار", "Property"), [
        localizedValue(readText(details, "property_type"), propertyTypeLabels, locale),
        localizedValue(readText(details, "listing_purpose"), purposeLabels, locale),
      ]),
      numberHighlight(
        label(locale, "غرف النوم", "Bedrooms"),
        readNumber(details, "bedrooms") ?? readNumber(details, "rooms"),
        locale,
      ),
      numberHighlight(
        label(locale, "المساحة", "Area"),
        readNumber(details, "area_sqm"),
        locale,
        label(locale, "م²", "sqm"),
      ),
    );
  } else if (kind === "electronics") {
    candidates.push(
      combinedHighlight(label(locale, "الجهاز", "Device"), [
        readText(details, "electronics_brand", "make"),
        readText(details, "electronics_model", "model"),
      ]),
      textHighlight(label(locale, "التخزين", "Storage"), readText(details, "storage")),
      textHighlight(label(locale, "الذاكرة", "RAM"), readText(details, "ram")),
      conditionHighlight(readText(details, "condition") ?? listing.condition, locale),
    );
  } else if (kind === "jobs") {
    candidates.push(
      textHighlight(label(locale, "الوظيفة", "Role"), readText(details, "job_type")),
      enumHighlight(
        label(locale, "نمط العمل", "Employment"),
        readText(details, "employment_type"),
        employmentTypeLabels,
        locale,
      ),
      enumHighlight(
        label(locale, "مكان العمل", "Work location"),
        readText(details, "work_location"),
        workLocationLabels,
        locale,
      ),
    );
  } else if (kind === "services") {
    candidates.push(
      textHighlight(label(locale, "الخدمة", "Service"), readText(details, "service_type")),
      textHighlight(label(locale, "نطاق الخدمة", "Service area"), readText(details, "service_area")),
      enumHighlight(
        label(locale, "وقت التنفيذ", "Delivery"),
        readText(details, "delivery_time"),
        deliveryTimeLabels,
        locale,
      ),
    );
  }

  return candidates.filter((item): item is ListingShareHighlight => Boolean(item)).slice(0, 3);
}

function label(language: Language, ar: string, en: string) {
  return language === "en" ? en : ar;
}

function readText(details: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = details[key];
    if (typeof value !== "string") continue;
    const normalized = value.trim().replace(/\s+/g, " ");
    if (
      normalized &&
      !["undefined", "null", "nan", "n/a"].includes(normalized.toLowerCase()) &&
      !looksLikeInternalId(normalized)
    ) {
      return normalized.slice(0, 80);
    }
  }
  return undefined;
}

function readNumber(details: Record<string, unknown>, key: string) {
  const value = details[key];
  const number =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : undefined;
}

function looksLikeInternalId(value: string) {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ||
    /^(?:cat|category|subcategory|taxonomy|node|listing|user)_[a-z0-9_-]{6,}$/i.test(value)
  );
}

function localizedValue(
  value: string | undefined,
  labels: LocalizedLabels,
  language: Language,
) {
  if (!value) return undefined;
  const localized = labels[value];
  return localized?.[language === "en" ? 1 : 0];
}

function textHighlight(labelValue: string, value: string | undefined): ListingShareHighlight | null {
  return value ? { label: labelValue, value } : null;
}

function combinedHighlight(
  labelValue: string,
  values: Array<string | undefined>,
): ListingShareHighlight | null {
  const value = values.filter((item): item is string => Boolean(item)).join(" · ");
  return textHighlight(labelValue, value || undefined);
}

function enumHighlight(
  labelValue: string,
  value: string | undefined,
  labels: LocalizedLabels,
  language: Language,
) {
  return textHighlight(labelValue, localizedValue(value, labels, language));
}

function numberHighlight(
  labelValue: string,
  value: number | undefined,
  language: Language,
  suffix?: string,
): ListingShareHighlight | null {
  if (value === undefined) return null;
  const formatted = new Intl.NumberFormat(language === "en" ? "en-US" : "ar-SY", {
    maximumFractionDigits: 0,
  }).format(value);
  return { label: labelValue, value: suffix ? `${formatted} ${suffix}` : formatted };
}

function conditionHighlight(value: string | undefined, language: Language) {
  return enumHighlight(label(language, "الحالة", "Condition"), value, conditionLabels, language);
}
