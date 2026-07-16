import type { ClassifiedCategory, ClassifiedListing, TaxonomyNode } from "@/lib/classifieds-types";

export type CategoryFieldKind =
  "real_estate" | "vehicles" | "jobs" | "services" | "electronics" | "general";

const taxonomySchemaKindAliases: Record<string, CategoryFieldKind> = {
  real_estate: "real_estate",
  realestate: "real_estate",
  property: "real_estate",
  properties: "real_estate",
  vehicles: "vehicles",
  vehicle: "vehicles",
  automotive: "vehicles",
  car: "vehicles",
  cars: "vehicles",
  jobs: "jobs",
  job: "jobs",
  employment: "jobs",
  services: "services",
  service: "services",
  electronics: "electronics",
  electronic: "electronics",
  phones: "electronics",
  mobiles: "electronics",
  general: "general",
};

function normalizeTaxonomySchemaKey(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function explicitCategoryFieldKind(value?: string | null) {
  const normalized = normalizeTaxonomySchemaKey(value);
  return (
    taxonomySchemaKindAliases[normalized] ??
    taxonomySchemaKindAliases[normalized.replaceAll("_", "")]
  );
}

export function resolveCategoryFieldKind(
  taxonomyNode?: Pick<
    TaxonomyNode,
    "filterSchemaKey" | "classificationKey" | "legacyCategoryId"
  > | null,
  category?: Pick<ClassifiedCategory, "id" | "slug" | "nameAr" | "placeholder"> | null,
  listing?: Pick<ClassifiedListing, "categoryId" | "categoryNameAr" | "categoryPlaceholder"> | null,
): CategoryFieldKind {
  const schemaKind = explicitCategoryFieldKind(taxonomyNode?.filterSchemaKey);
  if (schemaKind) return schemaKind;

  const classificationKind = explicitCategoryFieldKind(taxonomyNode?.classificationKey);
  if (classificationKind) return classificationKind;

  const legacyCategoryKind = explicitCategoryFieldKind(taxonomyNode?.legacyCategoryId);
  if (legacyCategoryKind) return legacyCategoryKind;

  return detectCategoryFieldKind(category, listing);
}

export function categoryUsesGlobalCondition(kind: CategoryFieldKind) {
  return kind === "vehicles" || kind === "electronics" || kind === "general";
}

export function categoryRequiresPreciseLocation(kind: CategoryFieldKind) {
  return kind !== "jobs" && kind !== "services";
}

export interface CategorySpecificDetails {
  property_type?: string;
  listing_purpose?: string;
  rental_duration?: string;
  area_sqm?: number;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  floor?: number;
  furnished?: boolean;
  parking?: boolean;
  car_make?: string;
  car_model?: string;
  make?: string;
  model?: string;
  year?: number;
  mileage_km?: number;
  fuel_type?: string;
  transmission?: string;
  body_type?: string;
  vehicle_condition?: string;
  condition?: string;
  color?: string;
  job_type?: string;
  employment_type?: string;
  experience_level?: string;
  salary_type?: string;
  salary_min?: number;
  salary_max?: number;
  work_location?: string;
  contract_duration?: string;
  application_method?: string;
  service_type?: string;
  service_area?: string;
  delivery_time?: string;
  starting_price?: number;
  electronics_brand?: string;
  electronics_model?: string;
  storage?: string;
  ram?: string;
  warranty?: string;
  accessories?: string;
  location_neighborhood?: string;
  location_details?: string;
}

export const carMakeOptions = [
  "Toyota",
  "Hyundai",
  "Kia",
  "Mercedes-Benz",
  "BMW",
  "Nissan",
  "Honda",
  "Ford",
  "Chevrolet",
  "Renault",
  "Peugeot",
  "Volkswagen",
  "Audi",
  "Mitsubishi",
  "Mazda",
  "Suzuki",
  "Chery",
  "Geely",
  "BYD",
  "Other",
] as const;

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
export const rentalDurationOptions = ["daily", "monthly", "yearly", "negotiable"] as const;
export const fuelTypeOptions = [
  "gasoline",
  "diesel",
  "hybrid",
  "electric",
  "gas",
  "other",
] as const;
export const transmissionOptions = ["automatic", "manual", "semi_auto"] as const;
export const bodyTypeOptions = [
  "sedan",
  "hatchback",
  "suv",
  "pickup",
  "van",
  "coupe",
  "bus",
  "truck",
  "motorcycle",
  "other",
] as const;
export const vehicleConditionOptions = ["new", "used", "excellent", "good", "needs_work"] as const;
export const employmentTypeOptions = [
  "full_time",
  "part_time",
  "contract",
  "temporary",
  "internship",
] as const;
export const experienceLevelOptions = [
  "entry",
  "mid",
  "senior",
  "manager",
  "not_required",
] as const;
export const salaryTypeOptions = [
  "fixed",
  "range",
  "commission",
  "negotiable",
  "not_listed",
] as const;
export const workLocationOptions = ["onsite", "remote", "hybrid", "field"] as const;
export const contractDurationOptions = [
  "permanent",
  "temporary",
  "seasonal",
  "internship",
] as const;
export const applicationMethodOptions = [
  "rawaj_message",
  "phone",
  "whatsapp",
  "email",
  "external",
] as const;
export const deliveryTimeOptions = ["same_day", "two_three_days", "week", "negotiable"] as const;
export const electronicsConditionOptions = [
  "new",
  "used",
  "excellent",
  "good",
  "needs_work",
] as const;
export const warrantyOptions = ["yes", "no", "unknown"] as const;

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

  if (includesAny(haystack, ["real", "estate", "realestate", "عقار"])) return "real_estate";
  if (includesAny(haystack, ["car", "vehicle", "auto", "سيار", "مركب"])) return "vehicles";
  if (includesAny(haystack, ["job", "وظائف", "وظيفة", "عمل"])) return "jobs";
  if (includesAny(haystack, ["service", "خدمات", "خدمة"])) return "services";
  if (
    includesAny(haystack, [
      "phone",
      "mobile",
      "electronics",
      "الكترون",
      "إلكترون",
      "موبايل",
      "جوال",
    ])
  )
    return "electronics";
  return "general";
}

export function sanitizeCategoryDetails(
  kind: CategoryFieldKind,
  input: CategorySpecificDetails,
): Record<string, unknown> {
  const location = {
    location_neighborhood: textValue(input.location_neighborhood, 80),
    location_details: textValue(input.location_details, 180),
  };

  if (kind === "real_estate") {
    return stripEmpty({
      property_type: enumValue(input.property_type, propertyTypeOptions),
      listing_purpose: enumValue(input.listing_purpose, listingPurposeOptions),
      rental_duration: enumValue(input.rental_duration, rentalDurationOptions),
      area_sqm: numberValue(input.area_sqm, 1, 100000),
      rooms: numberValue(input.rooms, 0, 100),
      bedrooms: numberValue(input.bedrooms, 0, 30),
      bathrooms: numberValue(input.bathrooms, 0, 30),
      floor: numberValue(input.floor, -5, 200),
      furnished: booleanValue(input.furnished),
      parking: booleanValue(input.parking),
      ...location,
    });
  }

  if (kind === "vehicles") {
    const make =
      enumValue(input.car_make, carMakeOptions) ?? textValue(input.car_make ?? input.make, 60);
    return stripEmpty({
      car_make: make,
      car_model: textValue(input.car_model ?? input.model, 60),
      year: numberValue(input.year, 1900, new Date().getFullYear() + 1),
      mileage_km: numberValue(input.mileage_km, 0, 2000000),
      fuel_type: enumValue(input.fuel_type, fuelTypeOptions),
      transmission: enumValue(input.transmission, transmissionOptions),
      body_type: enumValue(input.body_type, bodyTypeOptions),
      vehicle_condition: enumValue(
        input.vehicle_condition ?? input.condition,
        vehicleConditionOptions,
      ),
      color: textValue(input.color, 40),
      ...location,
    });
  }

  if (kind === "jobs") {
    return stripEmpty({
      job_type: textValue(input.job_type, 80),
      employment_type: enumValue(input.employment_type, employmentTypeOptions),
      experience_level: enumValue(input.experience_level, experienceLevelOptions),
      salary_type: enumValue(input.salary_type, salaryTypeOptions),
      salary_min: numberValue(input.salary_min, 0, 1000000000),
      salary_max: numberValue(input.salary_max, 0, 1000000000),
      work_location: enumValue(input.work_location, workLocationOptions),
      contract_duration: enumValue(input.contract_duration, contractDurationOptions),
      application_method: enumValue(input.application_method, applicationMethodOptions),
      ...location,
    });
  }

  if (kind === "services") {
    return stripEmpty({
      service_type: textValue(input.service_type, 80),
      service_area: textValue(input.service_area, 100),
      delivery_time: enumValue(input.delivery_time, deliveryTimeOptions),
      starting_price: numberValue(input.starting_price, 0, 1000000000),
      ...location,
    });
  }

  if (kind === "electronics") {
    return stripEmpty({
      electronics_brand: textValue(input.electronics_brand ?? input.make, 60),
      electronics_model: textValue(input.electronics_model ?? input.model, 60),
      storage: textValue(input.storage, 40),
      ram: textValue(input.ram, 40),
      condition: enumValue(input.condition, electronicsConditionOptions),
      warranty: enumValue(input.warranty, warrantyOptions),
      accessories: textValue(input.accessories, 160),
      ...location,
    });
  }

  return stripEmpty(location);
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
    rental_duration: readString(details, "rental_duration"),
    area_sqm: readNumber(details, "area_sqm"),
    rooms: readNumber(details, "rooms"),
    bedrooms: readNumber(details, "bedrooms"),
    bathrooms: readNumber(details, "bathrooms"),
    floor: readNumber(details, "floor"),
    furnished: readBoolean(details, "furnished"),
    parking: readBoolean(details, "parking"),
    car_make: readString(details, "car_make") ?? readString(details, "make"),
    car_model: readString(details, "car_model") ?? readString(details, "model"),
    make: readString(details, "make"),
    model: readString(details, "model"),
    year: readNumber(details, "year"),
    mileage_km: readNumber(details, "mileage_km"),
    fuel_type: readString(details, "fuel_type"),
    transmission: readString(details, "transmission"),
    body_type: readString(details, "body_type"),
    vehicle_condition: readString(details, "vehicle_condition"),
    condition: readString(details, "condition"),
    color: readString(details, "color"),
    job_type: readString(details, "job_type"),
    employment_type: readString(details, "employment_type"),
    experience_level: readString(details, "experience_level"),
    salary_type: readString(details, "salary_type"),
    salary_min: readNumber(details, "salary_min"),
    salary_max: readNumber(details, "salary_max"),
    work_location: readString(details, "work_location"),
    contract_duration: readString(details, "contract_duration"),
    application_method: readString(details, "application_method"),
    service_type: readString(details, "service_type"),
    service_area: readString(details, "service_area"),
    delivery_time: readString(details, "delivery_time"),
    starting_price: readNumber(details, "starting_price"),
    electronics_brand: readString(details, "electronics_brand"),
    electronics_model: readString(details, "electronics_model"),
    storage: readString(details, "storage"),
    ram: readString(details, "ram"),
    warranty: readString(details, "warranty"),
    accessories: readString(details, "accessories"),
    location_neighborhood: readString(details, "location_neighborhood"),
    location_details: readString(details, "location_details"),
  };
}

export function categoryDetailDisplayRows(
  kind: CategoryFieldKind,
  details: Record<string, unknown>,
  text: (ar: string, en: string) => string,
) {
  const value = readCategoryDetails(details);
  const locationRows: Array<[string, string | undefined]> = [
    [text("الحي / الناحية", "Neighborhood"), value.location_neighborhood],
    [text("تفاصيل المكان", "Location details"), value.location_details],
  ];

  if (kind === "real_estate") {
    return compactRows([
      [text("نوع العقار", "Property type"), label(propertyTypeLabels, value.property_type, text)],
      [text("الغرض", "Purpose"), label(purposeLabels, value.listing_purpose, text)],
      [
        text("مدة الإيجار", "Rental duration"),
        label(rentalDurationLabels, value.rental_duration, text),
      ],
      [
        text("المساحة", "Area"),
        value.area_sqm ? `${value.area_sqm} ${text("متر مربع", "sqm")}` : "",
      ],
      [text("الغرف", "Rooms"), numberLabel(value.rooms)],
      [text("غرف النوم", "Bedrooms"), numberLabel(value.bedrooms)],
      [text("الحمامات", "Bathrooms"), numberLabel(value.bathrooms)],
      [text("الطابق", "Floor"), numberLabel(value.floor)],
      [text("مفروش", "Furnished"), boolLabel(value.furnished, text)],
      [text("موقف سيارة", "Parking"), boolLabel(value.parking, text)],
      ...locationRows,
    ]);
  }

  if (kind === "vehicles") {
    return compactRows([
      [text("الشركة", "Make"), value.car_make ?? value.make],
      [text("الطراز", "Model"), value.car_model ?? value.model],
      [text("سنة الصنع", "Year"), numberLabel(value.year)],
      [
        text("المسافة", "Mileage"),
        value.mileage_km !== undefined ? `${value.mileage_km} ${text("كم", "km")}` : "",
      ],
      [text("الوقود", "Fuel"), label(fuelLabels, value.fuel_type, text)],
      [text("ناقل الحركة", "Transmission"), label(transmissionLabels, value.transmission, text)],
      [text("شكل المركبة", "Body type"), label(bodyTypeLabels, value.body_type, text)],
      [text("الحالة", "Condition"), label(conditionLabels, value.vehicle_condition, text)],
      [text("اللون", "Color"), value.color],
      ...locationRows,
    ]);
  }

  if (kind === "jobs") {
    return compactRows([
      [text("نوع الوظيفة", "Job type"), value.job_type],
      [
        text("نمط العمل", "Employment type"),
        label(employmentTypeLabels, value.employment_type, text),
      ],
      [text("الخبرة", "Experience"), label(experienceLabels, value.experience_level, text)],
      [text("نوع الراتب", "Salary type"), label(salaryTypeLabels, value.salary_type, text)],
      [text("الراتب من", "Salary from"), numberLabel(value.salary_min)],
      [text("الراتب إلى", "Salary to"), numberLabel(value.salary_max)],
      [text("مكان العمل", "Work location"), label(workLocationLabels, value.work_location, text)],
      [
        text("مدة العقد", "Contract duration"),
        label(contractDurationLabels, value.contract_duration, text),
      ],
      [
        text("طريقة التقديم", "Application method"),
        label(applicationMethodLabels, value.application_method, text),
      ],
      ...locationRows,
    ]);
  }

  if (kind === "services") {
    return compactRows([
      [text("نوع الخدمة", "Service type"), value.service_type],
      [text("نطاق الخدمة", "Service area"), value.service_area],
      [text("وقت التنفيذ", "Delivery time"), label(deliveryTimeLabels, value.delivery_time, text)],
      [text("السعر يبدأ من", "Starting price"), numberLabel(value.starting_price)],
      ...locationRows,
    ]);
  }

  if (kind === "electronics") {
    return compactRows([
      [text("الشركة", "Brand"), value.electronics_brand],
      [text("الموديل", "Model"), value.electronics_model],
      [text("التخزين", "Storage"), value.storage],
      [text("الذاكرة", "RAM"), value.ram],
      [text("الحالة", "Condition"), label(conditionLabels, value.condition, text)],
      [text("الضمان", "Warranty"), label(warrantyLabels, value.warranty, text)],
      [text("الملحقات", "Accessories"), value.accessories],
      ...locationRows,
    ]);
  }

  return compactRows(locationRows);
}

export const categoryDetailKeys = [
  "property_type",
  "listing_purpose",
  "rental_duration",
  "area_sqm",
  "rooms",
  "bedrooms",
  "bathrooms",
  "floor",
  "furnished",
  "parking",
  "car_make",
  "car_model",
  "make",
  "model",
  "year",
  "mileage_km",
  "fuel_type",
  "transmission",
  "body_type",
  "vehicle_condition",
  "condition",
  "color",
  "job_type",
  "employment_type",
  "experience_level",
  "salary_type",
  "salary_min",
  "salary_max",
  "work_location",
  "contract_duration",
  "application_method",
  "service_type",
  "service_area",
  "delivery_time",
  "starting_price",
  "electronics_brand",
  "electronics_model",
  "storage",
  "ram",
  "warranty",
  "accessories",
  "location_neighborhood",
  "location_details",
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

const purposeLabels = { sale: ["بيع", "Sale"], rent: ["إيجار", "Rent"] } as const;
const rentalDurationLabels = {
  daily: ["يومي", "Daily"],
  monthly: ["شهري", "Monthly"],
  yearly: ["سنوي", "Yearly"],
  negotiable: ["قابل للاتفاق", "Negotiable"],
} as const;
const fuelLabels = {
  gasoline: ["بنزين", "Gasoline"],
  diesel: ["ديزل", "Diesel"],
  hybrid: ["هجين", "Hybrid"],
  electric: ["كهرباء", "Electric"],
  gas: ["غاز", "Gas"],
  other: ["أخرى", "Other"],
} as const;
const transmissionLabels = {
  automatic: ["أوتوماتيك", "Automatic"],
  manual: ["يدوي", "Manual"],
  semi_auto: ["نصف أوتوماتيك", "Semi-auto"],
} as const;
const bodyTypeLabels = {
  sedan: ["سيدان", "Sedan"],
  hatchback: ["هاتشباك", "Hatchback"],
  suv: ["SUV", "SUV"],
  pickup: ["بيك أب", "Pickup"],
  van: ["فان", "Van"],
  coupe: ["كوبيه", "Coupe"],
  bus: ["باص", "Bus"],
  truck: ["شاحنة", "Truck"],
  motorcycle: ["دراجة نارية", "Motorcycle"],
  other: ["أخرى", "Other"],
} as const;
const conditionLabels = {
  new: ["جديد", "New"],
  used: ["مستعمل", "Used"],
  excellent: ["ممتاز", "Excellent"],
  good: ["جيد", "Good"],
  needs_work: ["يحتاج صيانة", "Needs work"],
} as const;
const employmentTypeLabels = {
  full_time: ["دوام كامل", "Full-time"],
  part_time: ["دوام جزئي", "Part-time"],
  contract: ["عقد", "Contract"],
  temporary: ["مؤقت", "Temporary"],
  internship: ["تدريب", "Internship"],
} as const;
const experienceLabels = {
  entry: ["مبتدئ", "Entry"],
  mid: ["متوسط", "Mid"],
  senior: ["خبير", "Senior"],
  manager: ["إدارة", "Manager"],
  not_required: ["غير مطلوبة", "Not required"],
} as const;
const salaryTypeLabels = {
  fixed: ["ثابت", "Fixed"],
  range: ["نطاق", "Range"],
  commission: ["عمولة", "Commission"],
  negotiable: ["قابل للتفاوض", "Negotiable"],
  not_listed: ["غير معلن", "Not listed"],
} as const;
const workLocationLabels = {
  onsite: ["حضوري", "On-site"],
  remote: ["عن بعد", "Remote"],
  hybrid: ["هجين", "Hybrid"],
  field: ["ميداني", "Field"],
} as const;
const contractDurationLabels = {
  permanent: ["دائم", "Permanent"],
  temporary: ["مؤقت", "Temporary"],
  seasonal: ["موسمي", "Seasonal"],
  internship: ["تدريب", "Internship"],
} as const;
const applicationMethodLabels = {
  rawaj_message: ["رسائل رواج", "RAWAJ messages"],
  phone: ["هاتف", "Phone"],
  whatsapp: ["واتساب", "WhatsApp"],
  email: ["بريد إلكتروني", "Email"],
  external: ["رابط خارجي", "External"],
} as const;
const deliveryTimeLabels = {
  same_day: ["نفس اليوم", "Same day"],
  two_three_days: ["2-3 أيام", "2-3 days"],
  week: ["خلال أسبوع", "Within a week"],
  negotiable: ["حسب الاتفاق", "Negotiable"],
} as const;
const warrantyLabels = {
  yes: ["يوجد ضمان", "Warranty"],
  no: ["بدون ضمان", "No warranty"],
  unknown: ["غير محدد", "Unknown"],
} as const;

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle.toLowerCase()));
}

function enumValue<T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined {
  return typeof value === "string" && allowed.includes(value) ? (value as T[number]) : undefined;
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
