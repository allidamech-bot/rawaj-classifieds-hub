import { detectCategoryFieldKind } from "@/lib/category-fields";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { absoluteUrl, plainText } from "@/lib/seo";

export function buildListingStructuredData(listing: ClassifiedListing): Record<string, unknown> {
  const kind = detectCategoryFieldKind(null, listing);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaTypeForKind(kind),
    name: listing.title,
    description: plainText(listing.description, 300),
    url: absoluteUrl(`/listings/${listing.id}`),
    category: listing.categoryNameAr,
    areaServed: listing.governorateNameAr,
  };

  if (listing.primaryImageUrl) data.image = [absoluteUrl(listing.primaryImageUrl)];

  if (kind === "vehicles") {
    const make = detailValue(listing, "car_make", "make");
    addDefined(data, {
      vehicleModelDate: detailValue(listing, "year"),
      model: detailValue(listing, "car_model", "model"),
      brand: make
        ? {
            "@type": "Brand",
            name: make,
          }
        : undefined,
      mileageFromOdometer: numericProperty(detailNumber(listing, "mileage_km"), "KMT"),
      fuelType: detailValue(listing, "fuel_type"),
      vehicleTransmission: detailValue(listing, "transmission"),
      color: detailValue(listing, "color"),
    });
  } else if (kind === "real_estate") {
    addDefined(data, {
      floorSize: numericProperty(detailNumber(listing, "area_sqm"), "MTK"),
      numberOfRooms: detailNumber(listing, "rooms"),
      numberOfBedrooms: detailNumber(listing, "bedrooms"),
      numberOfBathroomsTotal: detailNumber(listing, "bathrooms"),
      accommodationCategory: detailValue(listing, "property_type"),
      address: listing.governorateNameAr
        ? postalAddress(listing.governorateNameAr, listing.districtAr)
        : undefined,
    });
  } else if (kind === "jobs") {
    const isRemote = detailValue(listing, "work_location") === "remote";
    addDefined(data, {
      title: listing.title,
      datePosted: listing.createdAt,
      employmentType: detailValue(listing, "employment_type", "job_type"),
      jobLocationType: isRemote ? "TELECOMMUTE" : undefined,
      jobLocation:
        !isRemote && listing.governorateNameAr
          ? {
              "@type": "Place",
              address: postalAddress(listing.governorateNameAr, listing.districtAr),
            }
          : undefined,
      validThrough: listing.expiresAt ?? undefined,
      applicantLocationRequirements:
        isRemote && listing.governorateNameAr
          ? {
              "@type": "AdministrativeArea",
              name: listing.governorateNameAr,
            }
          : undefined,
    });
  } else if (kind === "services") {
    addDefined(data, {
      serviceType: detailValue(listing, "service_type") ?? listing.categoryNameAr,
      providerMobility: detailValue(listing, "service_area") ? "dynamic" : undefined,
    });
  }

  if (kind !== "jobs" && listing.price !== null) {
    data.offers = {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: listing.currency,
      availability: listing.reservedAt
        ? "https://schema.org/LimitedAvailability"
        : "https://schema.org/InStock",
      url: absoluteUrl(`/listings/${listing.id}`),
    };
  }

  return data;
}

function schemaTypeForKind(kind: ReturnType<typeof detectCategoryFieldKind>) {
  switch (kind) {
    case "real_estate":
      return "RealEstateListing";
    case "vehicles":
      return "Vehicle";
    case "jobs":
      return "JobPosting";
    case "services":
      return "Service";
    default:
      return "Product";
  }
}

function detailValue(listing: ClassifiedListing, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = listing.details[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function detailNumber(listing: ClassifiedListing, key: string): number | undefined {
  const value = listing.details[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function numericProperty(value: number | undefined, unitCode: string) {
  if (value === undefined) return undefined;
  return {
    "@type": "QuantitativeValue",
    value,
    unitCode,
  };
}

function postalAddress(addressRegion: string, addressLocality?: string | null) {
  return {
    "@type": "PostalAddress",
    addressCountry: "SY",
    addressRegion,
    ...(addressLocality?.trim() ? { addressLocality: addressLocality.trim() } : {}),
  };
}

function addDefined(target: Record<string, unknown>, values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") target[key] = value;
  }
}
