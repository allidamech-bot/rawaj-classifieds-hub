import type { ClassifiedsResult } from "@/lib/classifieds-types";
import {
  accountSessionStillMatches,
  resolveAuthenticatedAccountId,
} from "@/lib/api/account-identity";
import { getClient, mapError } from "@/lib/api/shared";

export async function changeOwnPassword(newPassword: string): Promise<ClassifiedsResult<null>> {
  if (newPassword.length < 8 || newPassword.length > 72) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "يجب أن تكون كلمة المرور بين 8 و72 حرفاً.",
      },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const client = clientResult.data;
  const actor = await resolveAuthenticatedAccountId(client, "account_password_verify");
  if (!actor.ok) return actor;
  const session = await accountSessionStillMatches(
    client,
    actor.data,
    "account_password_stale_guard",
  );
  if (!session.ok) return session;

  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: mapError(error, "account_password_update") };
  return { ok: true, data: null };
}
