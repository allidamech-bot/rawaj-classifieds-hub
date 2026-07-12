import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { getClient, mapError } from "@/lib/api/shared";

export async function changeOwnPassword(
  userId: string | null,
  newPassword: string,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتغيير كلمة المرور." },
    };
  }

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
  const { data: userResult, error: userError } = await client.auth.getUser();
  if (userError) return { ok: false, error: mapError(userError, "account_password_verify") };
  if (userResult.user?.id !== userId) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "تعذر التحقق من جلسة الحساب. أعد تسجيل الدخول ثم حاول مجدداً.",
        operation: "account_password_verify",
      },
    };
  }

  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: mapError(error, "account_password_update") };
  return { ok: true, data: null };
}
