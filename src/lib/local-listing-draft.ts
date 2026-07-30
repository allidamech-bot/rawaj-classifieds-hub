const VERSION = 1;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_SERIALIZED_LENGTH = 64 * 1024;
const KEY_PREFIX = "rawaj:add-listing-draft:v1:";

export interface LocalListingDraft {
  version: typeof VERSION;
  savedAt: string;
  mode: "create";
  serverDraftId: string | null;
  step: number;
  categoryId: string;
  subcategoryId: string;
  taxonomyNodeId: string;
  title: string;
  price: string;
  priceType: string;
  governorateId: string;
  district: string;
  locationNodeId: string;
  locationNodeType: string;
  locationLabel: string;
  description: string;
  condition: string;
  contactName: string;
  contact: { phone: boolean; whatsapp: boolean };
  phone: string;
  whatsapp: string;
  categoryDetails: Record<string, unknown>;
  dynamicValues: Record<string, unknown>;
}

function key(userId: string) {
  return `${KEY_PREFIX}${encodeURIComponent(userId)}`;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readLocalListingDraft(userId: string): LocalListingDraft | null {
  if (typeof window === "undefined" || !userId.trim()) return null;
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (!raw) return null;
    if (raw.length > MAX_SERIALIZED_LENGTH) {
      window.localStorage.removeItem(key(userId));
      return null;
    }
    const value = JSON.parse(raw) as Partial<LocalListingDraft>;
    const savedAtText = typeof value.savedAt === "string" ? value.savedAt : "";
    const savedAt = Date.parse(savedAtText);
    if (
      value.version !== VERSION ||
      value.mode !== "create" ||
      !Number.isFinite(savedAt) ||
      Date.now() - savedAt > MAX_AGE_MS ||
      typeof value.title !== "string"
    ) {
      window.localStorage.removeItem(key(userId));
      return null;
    }
    const contact = recordValue(value.contact);
    return {
      version: VERSION,
      savedAt: savedAtText,
      mode: "create",
      serverDraftId:
        typeof value.serverDraftId === "string" && value.serverDraftId.trim()
          ? value.serverDraftId
          : null,
      step: typeof value.step === "number" && Number.isFinite(value.step) ? value.step : 0,
      categoryId: stringValue(value.categoryId),
      subcategoryId: stringValue(value.subcategoryId),
      taxonomyNodeId: stringValue(value.taxonomyNodeId),
      title: value.title,
      price: stringValue(value.price),
      priceType: stringValue(value.priceType, "fixed"),
      governorateId: stringValue(value.governorateId),
      district: stringValue(value.district),
      locationNodeId: stringValue(value.locationNodeId),
      locationNodeType: stringValue(value.locationNodeType),
      locationLabel: stringValue(value.locationLabel),
      description: stringValue(value.description),
      condition: stringValue(value.condition, "not_applicable"),
      contactName: stringValue(value.contactName),
      contact: {
        phone: contact.phone === true,
        whatsapp: contact.whatsapp === true,
      },
      phone: stringValue(value.phone),
      whatsapp: stringValue(value.whatsapp),
      categoryDetails: recordValue(value.categoryDetails),
      dynamicValues: recordValue(value.dynamicValues),
    };
  } catch {
    return null;
  }
}

export function writeLocalListingDraft(
  userId: string,
  draft: Omit<LocalListingDraft, "version" | "savedAt" | "mode">,
) {
  if (typeof window === "undefined" || !userId.trim()) return;
  try {
    const value: LocalListingDraft = {
      ...draft,
      version: VERSION,
      mode: "create",
      savedAt: new Date().toISOString(),
    };
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_SERIALIZED_LENGTH) return;
    window.localStorage.setItem(key(userId), serialized);
  } catch {
    // Storage is optional. The server-side autosave remains authoritative.
  }
}

export function clearLocalListingDraft(userId: string) {
  if (typeof window === "undefined" || !userId.trim()) return;
  try {
    window.localStorage.removeItem(key(userId));
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}
