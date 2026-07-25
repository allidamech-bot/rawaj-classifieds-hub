import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";

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

  const user = firebaseAuth.currentUser;
  const email = user?.email;
  if (!user || !email) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "تسجيل الدخول مطلوب." },
    };
  }

  try {
    const credential = EmailAuthProvider.credential(email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    return { ok: true, data: null };
  } catch (error) {
    const source = error as { code?: unknown; message?: unknown };
    const code = typeof source.code === "string" ? source.code : "";
    const message = typeof source.message === "string" ? source.message : "تعذر تغيير كلمة المرور.";

    if (
      code === "auth/invalid-credential" ||
      code === "auth/wrong-password" ||
      code === "auth/user-mismatch"
    ) {
      return {
        ok: false,
        error: { code: "permission_denied", message: "كلمة المرور الحالية غير صحيحة." },
      };
    }

    if (code === "auth/requires-recent-login") {
      return {
        ok: false,
        error: {
          code: "permission_denied",
          message: "أعد تسجيل الدخول ثم حاول تغيير كلمة المرور مرة أخرى.",
        },
      };
    }

    if (code === "auth/weak-password") {
      return {
        ok: false,
        error: { code: "validation_error", message: "كلمة المرور الجديدة ضعيفة." },
      };
    }

    return { ok: false, error: { code: "unknown", message } };
  }
}
