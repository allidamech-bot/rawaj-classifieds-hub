import {
  categoryDetailDisplayRows,
  categoryDetailKeys,
  categoryUsesGlobalCondition,
  type CategoryFieldKind,
} from "@/lib/category-fields";
import type { ClassifiedListing, ListingCondition, ListingImage } from "@/lib/classifieds-types";
import type { CanonicalLocationNode } from "@/lib/api/location-taxonomy";
import { normalizeContactPhone } from "@/lib/contact-phone";
import { governorateName } from "@/lib/i18n";

const publicDetailKeys = new Set(categoryDetailKeys);
const phoneKeys = ["phone", "mobile", "contact_phone", "رقم الهاتف", "الهاتف"];
const whatsappKeys = ["whatsapp", "whatsApp", "contact_whatsapp", "واتساب", "رقم واتساب"];

export function isPublicListingVisible(listing: ClassifiedListing) {
  if (listing.status !== "approved" || listing.archivedAt) return false;
  if (!listing.expiresAt) return true;
  const expiresAt = new Date(listing.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export function sanitizePublicListing(listing: ClassifiedListing): ClassifiedListing {
  const details: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(listing.details)) {
    if (publicDetailKeys.has(key) && isPublicDetailValue(value)) details[key] = value;
  }

  const taxonomyNodeId = readString(listing.details, ["_taxonomy_node_id"]);
  if (taxonomyNodeId) details._taxonomy_node_id = taxonomyNodeId;

  const contactOptions = {
    phone: listing.contactOptions.phone === true,
    whatsapp: listing.contactOptions.whatsapp === true,
  };
  const phone = normalizeContactPhone(readString(listing.details, phoneKeys));
  const whatsapp = normalizeContactPhone(readString(listing.details, whatsappKeys));
  if (contactOptions.phone && phone) details.phone = phone.e164;
  if (contactOptions.whatsapp && whatsapp) details.whatsapp = whatsapp.e164;

  return {
    ...listing,
    price: listing.price !== null && Number.isFinite(listing.price) ? listing.price : null,
    districtAr: listing.districtAr?.trim().startsWith("@") ? null : listing.districtAr,
    contactOptions,
    details,
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
  };
}

export function buildPublicListingDetailRows(
  kind: CategoryFieldKind,
  listing: ClassifiedListing,
  text: (ar: string, en: string) => string,
) {
  const rows = categoryDetailDisplayRows(kind, listing.details, text);
  const hasSpecificCondition =
    (kind === "vehicles" && Boolean(listing.details.vehicle_condition)) ||
    (kind === "electronics" && Boolean(listing.details.condition));
  if (
    categoryUsesGlobalCondition(kind) &&
    listing.condition !== "not_applicable" &&
    !hasSpecificCondition
  ) {
    rows.unshift([text("الحالة", "Condition"), conditionLabel(listing.condition, text)]);
  }

  const labels = new Set<string>();
  return rows.filter(([label, value]) => {
    const normalizedValue = value?.trim();
    if (!label.trim() || !normalizedValue || labels.has(label)) return false;
    labels.add(label);
    return true;
  });
}

export function resolvePublicLocationLabel({
  canonicalPath,
  listing,
  language,
}: {
  canonicalPath: CanonicalLocationNode[];
  listing: ClassifiedListing;
  language: "ar" | "en";
}) {
  const canonicalLabels = dedupeStrings(
    canonicalPath
      .filter((node) => node.nodeType !== "country")
      .map((node) => (language === "en" ? node.nameEn || node.nameAr : node.nameAr)),
  );
  if (canonicalLabels.length > 0) return canonicalLabels.join(" / ");

  const governorate = governorateName(
    listing.governorateId,
    listing.governorateNameAr ?? undefined,
    language,
  );
  const district = listing.districtAr?.trim();
  return dedupeStrings([governorate, district?.startsWith("@") ? "" : (district ?? "")]).join(
    " / ",
  );
}

export function normalizePublicListingImages(images: ListingImage[], listing: ClassifiedListing) {
  const seen = new Set<string>();
  const normalized = [...images]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .filter((image) => {
      const url = image.publicUrl?.trim() ?? "";
      if (!isSafePublicMediaUrl(url) || seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .map((image, index) => ({
      ...image,
      publicUrl: image.publicUrl!.trim(),
      altAr: image.altAr?.trim() || listing.title,
      sortOrder: index,
    }));

  const primaryUrl = listing.primaryImageUrl?.trim() ?? "";
  if (normalized.length === 0 && isSafePublicMediaUrl(primaryUrl)) {
    normalized.push({
      id: `primary-${listing.id}`,
      listingId: listing.id,
      storagePath: null,
      publicUrl: primaryUrl,
      altAr: listing.title,
      sortOrder: 0,
      createdAt: listing.createdAt,
    });
  }
  return normalized;
}

export function publicListingShareUrl(origin: string, listingId: string) {
  return new URL(`/listings/${encodeURIComponent(listingId)}`, origin).toString();
}

export function publicSeoDescription(value: string, maxLength = 160) {
  const withoutContacts = value
    .replace(/<[^>]*>/g, " ")
    .replace(/(?:\+|00)?[\d٠-٩۰-۹][\d٠-٩۰-۹\s().-]{6,}[\d٠-٩۰-۹]/g, " ")
    .replace(/(?:واتساب|whatsapp|هاتف|phone)\s*[:：-]?\s*\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return withoutContacts.length <= maxLength
    ? withoutContacts
    : `${withoutContacts.slice(0, maxLength - 1).trim()}…`;
}

function isPublicDetailValue(value: unknown) {
  return (
    (typeof value === "string" && value.trim() !== "") ||
    (typeof value === "number" && Number.isFinite(value)) ||
    value === true
  );
}

function readString(details: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = details[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function conditionLabel(
  condition: Exclude<ListingCondition, "not_applicable">,
  text: (ar: string, en: string) => string,
) {
  const labels = {
    new: text("جديد", "New"),
    like_new: text("شبه جديد", "Like new"),
    used: text("مستعمل", "Used"),
    for_parts: text("للقطع", "For parts"),
  };
  return labels[condition];
}

function dedupeStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function isSafePublicMediaUrl(value: string) {
  return /^https?:\/\//i.test(value) || value.startsWith("/");
}
