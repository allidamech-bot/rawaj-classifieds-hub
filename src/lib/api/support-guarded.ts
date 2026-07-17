import {
  createAccountDeletionRequest as baseCreateAccountDeletionRequest,
  createSupportRequest as baseCreateSupportRequest,
  fetchMySupportRequests,
} from "@/lib/api/support";
import { runDeduplicatedRequest } from "@/lib/api/request-dedup";

const pendingSupportRequests = new Map<string, ReturnType<typeof baseCreateSupportRequest>>();

export function createSupportRequest(
  userId: Parameters<typeof baseCreateSupportRequest>[0],
  payload: Parameters<typeof baseCreateSupportRequest>[1],
) {
  const key = JSON.stringify([
    userId ?? "anonymous",
    payload.type,
    payload.subject.trim(),
    payload.message.trim(),
    payload.relatedListingId?.trim() ?? "",
    payload.relatedReportId?.trim() ?? "",
  ]);
  return runDeduplicatedRequest(key, pendingSupportRequests, () =>
    baseCreateSupportRequest(userId, payload),
  );
}

export function createAccountDeletionRequest() {
  return baseCreateAccountDeletionRequest();
}

export { fetchMySupportRequests };
