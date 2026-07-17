import {
  createAccountDeletionRequest as baseCreateAccountDeletionRequest,
  createMySupportRequest as baseCreateMySupportRequest,
  fetchMySupportRequest,
  fetchMySupportRequests,
} from "@/lib/api/support";
import { resolveAuthenticatedAccountId } from "@/lib/api/account-identity";
import { runDeduplicatedRequest } from "@/lib/api/request-dedup";
import { getClient } from "@/lib/api/shared";

const pendingSupportRequests = new Map<string, ReturnType<typeof baseCreateMySupportRequest>>();

export async function createMySupportRequest(
  payload: Parameters<typeof baseCreateMySupportRequest>[0],
) {
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
  return baseCreateAccountDeletionRequest();
}

export { fetchMySupportRequest, fetchMySupportRequests };
