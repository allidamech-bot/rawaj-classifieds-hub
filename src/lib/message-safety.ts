export type MessageSafetyFlag =
  | "external_link"
  | "advance_payment"
  | "credential_request"
  | "off_platform_contact";

export type MessageSafetyLevel = "safe" | "caution" | "danger";

export interface MessageSafetyResult {
  level: MessageSafetyLevel;
  flags: MessageSafetyFlag[];
  requiresConfirmation: boolean;
}

const externalLinkPattern = /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|io|me|co|ly|app)\b)/iu;
const advancePaymentPattern =
  /(?:حوّل|حول|تحويل|حوالة|عربون|دفعة\s*مقدم|دفع\s*مسبق|قبل\s*المعاينة|iban|bank\s*transfer|deposit|advance\s*payment|crypto|usdt|binance)/iu;
const credentialPattern =
  /(?:كلمة\s*المرور|رمز\s*التحقق|رمز\s*الدخول|كود\s*التحقق|otp|password|verification\s*code|login\s*code|security\s*code)/iu;
const offPlatformContactPattern =
  /(?:تلغرام|تيليغرام|telegram|واتساب\s*فقط|whatsapp\s*only|راسلني\s*خارج|تواصل\s*خارج)/iu;

export function analyzeMessageSafety(message: string): MessageSafetyResult {
  const source = message.trim();
  if (!source) return { level: "safe", flags: [], requiresConfirmation: false };

  const flags: MessageSafetyFlag[] = [];
  if (externalLinkPattern.test(source)) flags.push("external_link");
  if (advancePaymentPattern.test(source)) flags.push("advance_payment");
  if (credentialPattern.test(source)) flags.push("credential_request");
  if (offPlatformContactPattern.test(source)) flags.push("off_platform_contact");

  const requiresConfirmation =
    flags.includes("advance_payment") || flags.includes("credential_request");
  const level: MessageSafetyLevel = requiresConfirmation
    ? "danger"
    : flags.length > 0
      ? "caution"
      : "safe";

  return { level, flags, requiresConfirmation };
}
