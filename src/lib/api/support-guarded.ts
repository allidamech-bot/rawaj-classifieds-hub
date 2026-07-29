import {
  createAccountDeletionRequest as baseCreateAccountDeletionRequest,
  createMySupportRequest as baseCreateMySupportRequest,
  fetchMySupportRequest,
  fetchMySupportRequests,
} from "@/lib/api/support";
import { runDeduplicatedRequest } from "@/lib/api/request-dedup";

const pendingSupportRequests = new Map<string, ReturnType<typeof baseCreateMySupportRequest>>();

export function createMySupportRequest(payload: Parameters<typeof baseCreateMySupportRequest>[0]) {
  const key = JSON.stringify([
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
  return runDeduplicatedRequest(
    "account-deletion",
    pendingSupportRequests,
    baseCreateAccountDeletionRequest,
  );
}

export { fetchMySupportRequest, fetchMySupportRequests };
