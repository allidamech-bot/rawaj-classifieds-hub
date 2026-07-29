export type AuthErrorLike = {
  code?: string;
  message?: string;
  status?: number;
};

export type AuthErrorContext = "login" | "register" | "recovery" | "update-password" | "callback";

type TextResolver = (arabic: string, english: string) => string;

export function authErrorMessage(
  error: AuthErrorLike | null | undefined,
  context: AuthErrorContext,
  text: TextResolver,
): string {
  const code = error?.code?.toLowerCase() ?? "";
  const message = error?.message?.toLowerCase() ?? "";
  const status = error?.status;
  const contains = (...values: string[]) =>
    values.some((value) => code.includes(value) || message.includes(value));

  if (
    contains("over_email_send_rate_limit", "rate limit", "too many requests", "security purposes")
  ) {
    return text(
      "تم إرسال طلبات كثيرة خلال وقت قصير. انتظر قليلاً ثم حاول مرة أخرى.",
      "Too many requests were sent in a short time. Wait a moment and try again.",
    );
  }

  if (contains("network", "failed to fetch", "load failed") || status === 0) {
    return text(
      "تعذر الاتصال بخدمة الحسابات. تحقق من الإنترنت ثم حاول مرة أخرى.",
      "Could not reach the account service. Check your connection and try again.",
    );
  }

  if (contains("account_recovery_required")) {
    return text(
      "هذا حساب مستورد ويلزم إعداد كلمة مرور جديدة. استخدم «نسيت كلمة المرور؟» لاستعادة الحساب.",
      "This imported account needs a new password. Use “Forgot password?” to recover it.",
    );
  }

  if (context === "login" || contains("invalid_credentials", "invalid login credentials")) {
    return text("البريد الإلكتروني أو كلمة المرور غير صحيحة.", "Incorrect email or password.");
  }

  if (contains("user_already_exists", "user already registered", "already been registered")) {
    return text(
      "يوجد حساب مرتبط بهذا البريد الإلكتروني. سجل الدخول أو استخدم استعادة كلمة المرور.",
      "An account already exists for this email. Log in or use password recovery.",
    );
  }

  if (contains("weak_password", "password should be at least", "password is too weak")) {
    return text(
      "كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل ويفضل الجمع بين الأحرف والأرقام.",
      "The password is too weak. Use at least 6 characters, preferably with letters and numbers.",
    );
  }

  if (contains("email_address_invalid", "invalid email", "unable to validate email")) {
    return text("أدخل بريداً إلكترونياً صالحاً.", "Enter a valid email address.");
  }

  if (contains("same_password", "different from the old password")) {
    return text(
      "اختر كلمة مرور جديدة مختلفة عن كلمة المرور السابقة.",
      "Choose a new password that is different from the previous password.",
    );
  }

  if (
    contains(
      "otp_expired",
      "token has expired",
      "invalid token",
      "session_not_found",
      "auth session missing",
      "pkce code verifier not found",
    )
  ) {
    return text(
      "رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلب أحدث رابط وحاول مرة أخرى.",
      "The recovery link is invalid or expired. Request a new link and try again.",
    );
  }

  if (context === "register") {
    return text(
      "تعذر إنشاء الحساب الآن. تحقق من البيانات ثم حاول مرة أخرى.",
      "Could not create the account right now. Check the details and try again.",
    );
  }

  if (context === "recovery") {
    return text(
      "تعذر إرسال رابط إعادة التعيين الآن. حاول مرة أخرى بعد قليل.",
      "Could not send the reset link right now. Try again shortly.",
    );
  }

  if (context === "update-password") {
    return text(
      "تعذر تحديث كلمة المرور. اطلب رابطاً جديداً وحاول مرة أخرى.",
      "Could not update the password. Request a new link and try again.",
    );
  }

  return text(
    "تعذر إكمال عملية الحساب الآن. حاول مرة أخرى.",
    "Could not complete the account request right now. Try again.",
  );
}
