import {
  createAccountDeletionRequest as baseCreateAccountDeletionRequest,
  createMySupportRequest as baseCreateMySupportRequest,
  fetchMySupportRequest,
  fetchMySupportRequests,
} from "@/lib/api/support";
import { resolveAuthenticatedAccountId } from "@/lib/api/account-identity";
import { runDeduplicatedRequest } from "@/lib/api/request-dedup";
import { getClient } from "@/lib/api/shared";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";

const pendingSupportRequests = new Map<string, ReturnType<typeof baseCreateMySupportRequest>>();

export async function createMySupportRequest(
  payload: Parameters<typeof baseCreateMySupportRequest>[0],
) {
  if (isCloudflarePublicDataProvider()) return cloudflareSupportUnavailable();
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actor = await resolveAuthenticatedAccountId(clientResult.data, "support_dedup_auth");
  if (!actor.ok) return actor;
  const key = JSON.stringify([
    actor.data,
    payload.type,
    payload.subject.trim(),
    payload.message.trim(),
    payload.relatedListingId?.trim() ?? "",
    payload.relatedReportId?.trim() ?? "",
  ]);
  return runDeduplicatedRequest(key, pendingSupportRequests, () =>
    baseCreateMySupportRequest(payload),
  );
}

export const createSupportRequest = createMySupportRequest;

export function createAccountDeletionRequest() {
  if (isCloudflarePublicDataProvider()) return cloudflareSupportUnavailable();
  return baseCreateAccountDeletionRequest();
}

export function fetchMySupportRequestGuarded(
  requestId: Parameters<typeof fetchMySupportRequest>[0],
) {
  if (isCloudflarePublicDataProvider()) return cloudflareSupportUnavailable();
  return fetchMySupportRequest(requestId);
}

export function fetchMySupportRequestsGuarded() {
  if (isCloudflarePublicDataProvider()) return cloudflareSupportUnavailable();
  return fetchMySupportRequests();
}

export {
  fetchMySupportRequestGuarded as fetchMySupportRequest,
  fetchMySupportRequestsGuarded as fetchMySupportRequests,
};

function cloudflareSupportUnavailable<T>() {
  return Promise.resolve({
    ok: false as const,
    error: {
      code: "setup_required" as const,
      message: "خدمة الدعم غير متاحة مؤقتًا أثناء استكمال نقلها.",
      operation: "cloudflare_support_unavailable",
    },
  });
}
