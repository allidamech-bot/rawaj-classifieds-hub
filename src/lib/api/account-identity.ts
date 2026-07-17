import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { mapError } from "@/lib/api/shared";

export async function resolveAuthenticatedAccountId(
  client: SupabaseClient,
  operation: string,
): Promise<ClassifiedsResult<string>> {
  const { data, error } = await client.auth.getUser();
  if (error) return { ok: false, error: mapError(error, operation) };

  const accountId = data.user?.id ?? null;
  if (!accountId) {
    return {
      ok: false,
      error: {
        code: "auth_required",
        message: "يجب تسجيل الدخول لإكمال هذه العملية.",
        operation,
      },
    };
  }

  return { ok: true, data: accountId };
}

export async function accountSessionStillMatches(
  client: SupabaseClient,
  expectedAccountId: string,
  operation: string,
): Promise<ClassifiedsResult<null>> {
  const current = await resolveAuthenticatedAccountId(client, operation);
  if (!current.ok) return current;
  if (current.data !== expectedAccountId) {
    return {
      ok: false,
      error: {
        code: "stale_account",
        message: "تغيّر الحساب أثناء العملية. أعد المحاولة من الحساب الحالي.",
        operation,
      },
    };
  }
  return { ok: true, data: null };
}
