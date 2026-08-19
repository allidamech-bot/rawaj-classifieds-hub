import type {
  ClassifiedsResult,
  SupportRequest,
  SupportRequestStatus,
} from "@/lib/classifieds-types";
import {
  adminFetchSupportRequests,
  adminUpdateSupportRequest,
  createMySupportRequest,
  fetchMySupportRequests,
  type AdminSupportRequest,
  type SupportPriority,
} from "@/lib/api/support";

export type AdvertisingRequestKind = "home" | "search_results" | "categories" | "campaign";
export type AdvertisingRequestDevice = "both" | "mobile" | "desktop";

export interface AdvertisingRequestDetails {
  kind: AdvertisingRequestKind;
  listingId: string | null;
  requestedDays: number;
  device: AdvertisingRequestDevice;
  destinationUrl: string | null;
  budgetNote: string | null;
  customerNote: string | null;
}

export interface AdvertisingRequest {
  support: SupportRequest;
  details: AdvertisingRequestDetails;
}

export interface AdminAdvertisingRequest {
  support: AdminSupportRequest;
  details: AdvertisingRequestDetails;
}

export interface CreateAdvertisingRequestInput {
  listingId?: string | null;
  kind: AdvertisingRequestKind;
  requestedDays: number;
  device: AdvertisingRequestDevice;
  destinationUrl?: string | null;
  budgetNote?: string | null;
  customerNote?: string | null;
}

const ADVERTISING_REQUEST_MARKER = "[RAWAJ_AD_REQUEST_V1]";
const ADVERTISING_INTENT_KEY = "rawaj.advertising-request-intent.v1";
const ADVERTISING_INTENT_TTL_MS = 30 * 60 * 1000;
const KINDS = new Set<AdvertisingRequestKind>([
  "home",
  "search_results",
  "categories",
  "campaign",
]);
const DEVICES = new Set<AdvertisingRequestDevice>(["both", "mobile", "desktop"]);

export async function createAdvertisingRequest(
  input: CreateAdvertisingRequestInput,
): Promise<ClassifiedsResult<AdvertisingRequest>> {
  const normalized = normalizeInput(input);
  if (!normalized.ok) return normalized;

  const params = new URLSearchParams({
    kind: normalized.data.kind,
    days: String(normalized.data.requestedDays),
    device: normalized.data.device,
  });
  if (normalized.data.destinationUrl) params.set("url", normalized.data.destinationUrl);
  if (normalized.data.budgetNote) params.set("budget", normalized.data.budgetNote);
  if (normalized.data.customerNote) params.set("note", normalized.data.customerNote);

  const result = await createMySupportRequest({
    type: "other",
    subject: `${ADVERTISING_REQUEST_MARKER} ${normalized.data.kind}`,
    message: `${ADVERTISING_REQUEST_MARKER} ${params.toString()}`,
    relatedListingId: normalized.data.listingId,
  });
  if (!result.ok) return result;

  return {
    ok: true,
    data: { support: result.data, details: normalized.data },
  };
}

export async function fetchMyAdvertisingRequests(): Promise<
  ClassifiedsResult<AdvertisingRequest[]>
> {
  const result = await fetchMySupportRequests();
  if (!result.ok) return result;
  return {
    ok: true,
    data: result.data.flatMap((support) => {
      const details = parseAdvertisingRequest(support);
      return details ? [{ support, details }] : [];
    }),
  };
}

export async function fetchAdminAdvertisingRequests(
  canModerate: boolean,
): Promise<ClassifiedsResult<AdminAdvertisingRequest[]>> {
  const result = await adminFetchSupportRequests(canModerate);
  if (!result.ok) return result;
  return {
    ok: true,
    data: result.data.flatMap((support) => {
      const details = parseAdvertisingRequest(support);
      return details ? [{ support, details }] : [];
    }),
  };
}

export async function updateAdminAdvertisingRequest(
  canModerate: boolean,
  request: AdminAdvertisingRequest,
  status: SupportRequestStatus,
  options?: {
    publicResponse?: string | null;
    adminNote?: string | null;
    priority?: SupportPriority;
  },
): Promise<ClassifiedsResult<AdminAdvertisingRequest>> {
  const result = await adminUpdateSupportRequest(canModerate, {
    requestId: request.support.id,
    status,
    expectedUpdatedAt: request.support.updatedAt,
    publicResponse: options?.publicResponse ?? null,
    adminNote: options?.adminNote ?? null,
    priority: options?.priority ?? request.support.priority,
  });
  if (!result.ok) return result;
  return { ok: true, data: { support: result.data, details: request.details } };
}

export function parseAdvertisingRequest(
  support: SupportRequest | AdminSupportRequest,
): AdvertisingRequestDetails | null {
  if (!support.subject.startsWith(ADVERTISING_REQUEST_MARKER)) return null;
  const markerIndex = support.message.indexOf(ADVERTISING_REQUEST_MARKER);
  if (markerIndex < 0) return null;
  const encoded = support.message.slice(markerIndex + ADVERTISING_REQUEST_MARKER.length).trim();
  const params = new URLSearchParams(encoded);
  const kind = params.get("kind") as AdvertisingRequestKind | null;
  const device = params.get("device") as AdvertisingRequestDevice | null;
  const requestedDays = Number(params.get("days"));
  if (
    !kind ||
    !KINDS.has(kind) ||
    !device ||
    !DEVICES.has(device) ||
    !Number.isInteger(requestedDays) ||
    requestedDays < 1 ||
    requestedDays > 90
  ) {
    return null;
  }
  return {
    kind,
    listingId: support.relatedListingId?.trim() || null,
    requestedDays,
    device,
    destinationUrl: cleanOptional(params.get("url"), 500),
    budgetNote: cleanOptional(params.get("budget"), 100),
    customerNote: cleanOptional(params.get("note"), 900),
  };
}

export function queueAdvertisingRequestIntent(listingId?: string | null): void {
  if (typeof window === "undefined") return;
  const clean = listingId?.trim() || null;
  try {
    window.sessionStorage.setItem(
      ADVERTISING_INTENT_KEY,
      JSON.stringify({ listingId: clean, queuedAt: Date.now() }),
    );
  } catch {
    // The form remains reachable even when session storage is unavailable.
  }
  window.location.assign("/promotion#advertise");
}

export function consumeAdvertisingRequestIntent(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ADVERTISING_INTENT_KEY);
    window.sessionStorage.removeItem(ADVERTISING_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { listingId?: unknown; queuedAt?: unknown };
    if (
      typeof parsed.queuedAt !== "number" ||
      Date.now() - parsed.queuedAt > ADVERTISING_INTENT_TTL_MS
    ) {
      return null;
    }
    return typeof parsed.listingId === "string" ? parsed.listingId.trim() || null : null;
  } catch {
    return null;
  }
}

function normalizeInput(
  input: CreateAdvertisingRequestInput,
): ClassifiedsResult<AdvertisingRequestDetails> {
  if (!KINDS.has(input.kind) || !DEVICES.has(input.device)) {
    return validation("اختر نوع الإعلان والأجهزة المستهدفة.");
  }
  if (!Number.isInteger(input.requestedDays) || input.requestedDays < 1 || input.requestedDays > 90) {
    return validation("اختر مدة بين يوم واحد و90 يوماً.");
  }
  const destinationUrl = cleanOptional(input.destinationUrl, 500);
  if (destinationUrl && !isHttpUrl(destinationUrl)) {
    return validation("أدخل رابط وجهة يبدأ بـ http:// أو https:// أو اتركه فارغاً.");
  }
  return {
    ok: true,
    data: {
      kind: input.kind,
      listingId: cleanOptional(input.listingId, 120),
      requestedDays: input.requestedDays,
      device: input.device,
      destinationUrl,
      budgetNote: cleanOptional(input.budgetNote, 100),
      customerNote: cleanOptional(input.customerNote, 900),
    },
  };
}

function cleanOptional(value: string | null | undefined, maxLength: number): string | null {
  const clean = value?.trim() ?? "";
  if (!clean) return null;
  return clean.slice(0, maxLength);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validation(message: string): ClassifiedsResult<never> {
  return {
    ok: false,
    error: { code: "validation_error", message, operation: "advertising_request_create" },
  };
}
