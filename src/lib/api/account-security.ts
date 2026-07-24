import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { supabase } from "@/lib/supabase";

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

  if (!supabase) {
    return {
      ok: false,
      error: { code: "unknown", message: "خدمة الحسابات غير متاحة مؤقتًا." },
    };
  }
  const session = await supabase.auth.getSession();
  const email = session.data.session?.user.email;
  if (!email) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "تسجيل الدخول مطلوب." },
    };
  }
  const verified = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (verified.error) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: verified.error.message,
      },
    };
  }
  const updated = await supabase.auth.updateUser({ password: newPassword });
  if (updated.error) {
    return { ok: false, error: { code: "unknown", message: updated.error.message } };
  }
  return { ok: true, data: null };
}
