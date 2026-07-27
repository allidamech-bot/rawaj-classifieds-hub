import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { supabaseAuth } from "@/lib/supabase-auth";

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

  const client = supabaseAuth;
  if (!client) {
    return {
      ok: false,
      error: { code: "setup_required", message: "خدمة الحسابات غير متاحة الآن." },
    };
  }

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  const currentUser = sessionData.session?.user ?? null;
  const email = currentUser?.email?.trim() ?? "";
  if (sessionError || !currentUser || !email) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "تسجيل الدخول مطلوب." },
    };
  }

  const { data: reauthenticated, error: reauthError } = await client.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (reauthError || reauthenticated.user?.id !== currentUser.id) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "كلمة المرور الحالية غير صحيحة." },
    };
  }

  const { error: updateError } = await client.auth.updateUser({ password: newPassword });
  if (!updateError) return { ok: true, data: null };

  const message = updateError.message || "تعذر تغيير كلمة المرور.";
  const normalized = message.toLowerCase();
  if (normalized.includes("weak") || normalized.includes("password")) {
    return {
      ok: false,
      error: { code: "validation_error", message: "كلمة المرور الجديدة غير مقبولة." },
    };
  }
  return { ok: false, error: { code: "unknown", message } };
}
