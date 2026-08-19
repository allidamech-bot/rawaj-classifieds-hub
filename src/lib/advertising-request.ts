import type { AdPlacementPage } from "@/lib/api/ad-placements";
import { createMySupportRequest, fetchMySupportRequests } from "@/lib/api/support-guarded";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import type {
  ClassifiedsErrorCode,
  ClassifiedsResult,
  SupportRequest,
  SupportRequestStatus,
} from "@/lib/classifieds-types";

export type AdvertisingRequestKind = "placement" | "campaign";

export interface AdvertisingRequestIntent {
  placementPage?: AdPlacementPage | null;
  listingId?: string | null;
}

export interface CreateAdvertisingRequestInput {
  kind: AdvertisingRequestKind;
  placementPage?: AdPlacementPage | null;
  listingId?: string | null;
  requestedDays: number;
  destinationUrl?: string | null;
  budget?: string | null;
  notes?: string | null;
}

export interface AdminAdvertisingRequest extends SupportRequest {
  email: string | null;
  priority: "low" | "normal" | "high" | "urgent" | string;
  assignedTo: string | null;
  adminNote: string | null;
}

export const ADVERTISING_REQUEST_EVENT = "rawaj:open-advertising-request";
export const ADVERTISING_REQUEST_SUBJECT_PREFIX = "[RAWAJ_AD_REQUEST_V1]";
const ADVERTISING_REQUEST_INTENT_KEY = "rawaj.advertising-request-intent.v1";

export const ADVERTISING_PLACEMENT_PAGES: readonly AdPlacementPage[] = [
  "home",
  "search_results",
  "categories",
  "listing_detail",
  "offers",
] as const;

export function advertisingPlacementLabel(
  page: AdPlacementPage,
  text: (ar: string, en: string) => string,
): string {
  if (page === "home") return text("الرئيسية", "Home");
  if (page === "search_results") return text("نتائج البحث", "Search results");
  if (page === "categories") return text("الأقسام", "Categories");
  if (page === "listing_detail") return text("صفحة الإعلان", "Listing detail");
  return text("العروض", "Offers");
}

export function openAdvertisingRequest(intent: AdvertisingRequestIntent = {}): void {
  if (typeof window === "undefined") return;
  const normalized: AdvertisingRequestIntent = {
    placementPage:
      intent.placementPage && ADVERTISING_PLACEMENT_PAGES.includes(intent.placementPage)
        ? intent.placementPage
        : null,
    listingId: intent.listingId?.trim() || null,
  };
  try {
    window.sessionStorage.setItem(
      ADVERTISING_REQUEST_INTENT_KEY,
      JSON.stringify({ ...normalized, queuedAt: Date.now() }),
    );
  } catch {
    // The event still opens the request center when storage is unavailable.
  }
  window.dispatchEvent(
    new CustomEvent<AdvertisingRequestIntent>(ADVERTISING_REQUEST_EVENT, {
      detail: normalized,
    }),
  );
}

export function consumeAdvertisingRequestIntent(): AdvertisingRequestIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ADVERTISING_REQUEST_INTENT_KEY);
    window.sessionStorage.removeItem(ADVERTISING_REQUEST_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdvertisingRequestIntent & { queuedAt?: unknown };
    if (typeof parsed.queuedAt !== "number" || Date.now() - parsed.queuedAt > 30 * 60 * 1000) {
      return null;
    }
    return {
      placementPage:
        parsed.placementPage && ADVERTISING_PLACEMENT_PAGES.includes(parsed.placementPage)
          ? parsed.placementPage
          : null,
      listingId: typeof parsed.listingId === "string" ? parsed.listingId.trim() || null : null,
    };
  } catch {
    return null;
  }
}

export async function createAdvertisingRequest(
  input: CreateAdvertisingRequestInput,
): Promise<ClassifiedsResult<SupportRequest>> {
  const requestedDays = Math.trunc(input.requestedDays);
  if (!Number.isFinite(requestedDays) || requestedDays < 1 || requestedDays > 90) {
    return validation("اختر مدة بين يوم واحد و90 يوماً.");
  }
  if (input.kind === "placement" && !input.placementPage) {
    return validation("اختر مكان المساحة الإعلانية.");
  }
  const destinationUrl = input.destinationUrl?.trim() || "";
  if (destinationUrl && !/^https?:\/\//i.test(destinationUrl)) {
    return validation("رابط الوجهة يجب أن يبدأ بـ http:// أو https://.");
  }
  const notes = input.notes?.trim() || "";
  const budget = input.budget?.trim() || "";
  const subject = `${ADVERTISING_REQUEST_SUBJECT_PREFIX} ${
    input.kind === "campaign" ? "Campaign" : `Placement:${input.placementPage}`
  }`;
  const message = [
    ADVERTISING_REQUEST_SUBJECT_PREFIX,
    `request_kind=${input.kind}`,
    `placement_page=${input.kind === "placement" ? input.placementPage : "campaign"}`,
    `requested_days=${requestedDays}`,
    `listing_id=${input.listingId?.trim() || "none"}`,
    `destination_url=${destinationUrl || "not_provided"}`,
    `budget=${budget || "not_provided"}`,
    `notes=${notes || "No additional notes."}`,
  ].join("\n");

  return createMySupportRequest({
    type: "other",
    subject,
    message,
    relatedListingId: input.listingId?.trim() || null,
  });
}

export async function fetchMyAdvertisingRequests(): Promise<ClassifiedsResult<SupportRequest[]>> {
  const result = await fetchMySupportRequests();
  if (!result.ok) return result;
  return {
    ok: true,
    data: result.data.filter(isAdvertisingRequest),
  };
}

export async function adminFetchAdvertisingRequests(): Promise<
  ClassifiedsResult<AdminAdvertisingRequest[]>
> {
  const result = await cloudflareApiRequest<AdminAdvertisingRequest[]>(
    "/v1/admin/support-requests?limit=200",
  );
  if (!result.ok) return fromApiFailure(result.code, result.error);
  return { ok: true, data: result.data.filter(isAdvertisingRequest) };
}

export async function adminUpdateAdvertisingRequest(input: {
  id: string;
  expectedUpdatedAt: string;
  status: SupportRequestStatus;
  publicResponse?: string | null;
  adminNote?: string | null;
  priority?: "low" | "normal" | "high" | "urgent";
}): Promise<ClassifiedsResult<AdminAdvertisingRequest>> {
  const result = await cloudflareApiRequest<AdminAdvertisingRequest>(
    `/v1/admin/support-requests/${encodeURIComponent(input.id)}`,
    {
      method: "PATCH",
      body: {
        status: input.status,
        expectedUpdatedAt: input.expectedUpdatedAt,
        publicResponse: input.publicResponse?.trim() || null,
        adminNote: input.adminNote?.trim() || null,
        priority: input.priority ?? "normal",
      },
    },
  );
  return result.ok ? { ok: true, data: result.data } : fromApiFailure(result.code, result.error);
}

export function isAdvertisingRequest(
  request: Pick<SupportRequest, "subject">,
): boolean {
  return request.subject.startsWith(ADVERTISING_REQUEST_SUBJECT_PREFIX);
}

export function advertisingRequestKind(
  request: Pick<SupportRequest, "subject" | "message">,
): AdvertisingRequestKind {
  return request.subject.includes("Campaign") || request.message.includes("request_kind=campaign")
    ? "campaign"
    : "placement";
}

function validation<T>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "validation_error", message, operation: "advertising_request" } };
}

function fromApiFailure<T>(code: string, message: string): ClassifiedsResult<T> {
  return {
    ok: false,
    error: {
      code: code as ClassifiedsErrorCode,
      message,
      operation: "advertising_request_admin",
    },
  };
}
