import { Capacitor, registerPlugin } from "@capacitor/core";

export type NativeGoogleAuthErrorCode =
  | "google_sign_in_cancelled"
  | "google_sign_in_no_account"
  | "google_sign_in_setup_required"
  | "google_sign_in_failed";

interface NativeGoogleAuthPlugin {
  signIn(): Promise<{ idToken: string }>;
  clearCredentialState(): Promise<void>;
}

const RawajGoogleAuth = registerPlugin<NativeGoogleAuthPlugin>("RawajGoogleAuth");

export class NativeGoogleAuthError extends Error {
  readonly code: NativeGoogleAuthErrorCode;

  constructor(code: NativeGoogleAuthErrorCode, message: string) {
    super(message);
    this.name = "NativeGoogleAuthError";
    this.code = code;
  }
}

export function isNativeAndroidGoogleAuthAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

export async function requestNativeGoogleIdToken(): Promise<string> {
  if (!isNativeAndroidGoogleAuthAvailable()) {
    throw new NativeGoogleAuthError(
      "google_sign_in_setup_required",
      "Native Google sign-in is not available on this platform.",
    );
  }

  try {
    const result = await RawajGoogleAuth.signIn();
    const idToken = result.idToken?.trim();
    if (!idToken) {
      throw new NativeGoogleAuthError(
        "google_sign_in_failed",
        "Google sign-in returned an empty ID token.",
      );
    }
    return idToken;
  } catch (error) {
    if (error instanceof NativeGoogleAuthError) throw error;
    const code = nativeErrorCode(error);
    throw new NativeGoogleAuthError(code, nativeErrorMessage(error, code));
  }
}

export async function clearNativeGoogleCredentialState(): Promise<void> {
  if (!isNativeAndroidGoogleAuthAvailable()) return;
  await RawajGoogleAuth.clearCredentialState().catch(() => undefined);
}

export function nativeGoogleAuthErrorMessage(error: unknown): string {
  const code = error instanceof NativeGoogleAuthError ? error.code : nativeErrorCode(error);
  switch (code) {
    case "google_sign_in_cancelled":
      return "تم إلغاء تسجيل الدخول باستخدام Google.";
    case "google_sign_in_no_account":
      return "لم يتم العثور على حساب Google متاح على الجهاز.";
    case "google_sign_in_setup_required":
      return "إعداد تسجيل Google في تطبيق أندرويد غير مكتمل.";
    default:
      return "تعذر تسجيل الدخول باستخدام Google. حاول مرة أخرى.";
  }
}

function nativeErrorCode(error: unknown): NativeGoogleAuthErrorCode {
  if (!error || typeof error !== "object") return "google_sign_in_failed";
  const code = (error as { code?: unknown }).code;
  return code === "google_sign_in_cancelled" ||
    code === "google_sign_in_no_account" ||
    code === "google_sign_in_setup_required"
    ? code
    : "google_sign_in_failed";
}

function nativeErrorMessage(error: unknown, code: NativeGoogleAuthErrorCode): string {
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return code;
}
