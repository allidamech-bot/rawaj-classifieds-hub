import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { authChangePassword } from "@/lib/cloudflare-auth";

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<ClassifiedsResult<null>> {
  if (!currentPassword || newPassword.length < 8 || newPassword.length > 72) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "يجب أن تكون كلمة المرور بين 8 و72 حرفاً.",
      },
    };
  }

  const result = await authChangePassword(currentPassword, newPassword);
  if (!result.ok) {
    return {
      ok: false,
      error: {
        code: result.code === "invalid_credentials" ? "permission_denied" : "unknown",
        message: result.error,
      },
    };
  }
  return { ok: true, data: null };
}
