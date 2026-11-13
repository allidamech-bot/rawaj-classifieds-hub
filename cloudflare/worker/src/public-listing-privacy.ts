/**
 * One privacy policy for all public listing representations (canonical and legacy).
 * Owner-facing representations must use their authenticated private mapper instead.
 */
const PRIVATE_DETAIL_KEYS = new Set([
  "phone",
  "phonenumber",
  "mobile",
  "mobilenumber",
  "telephone",
  "contactphone",
  "whatsapp",
  "whatsappnumber",
  "contactwhatsapp",
  "email",
  "contactemail",
]);

export function sanitizePublicListingDetails(
  details: Record<string, unknown>,
): Record<string, unknown> {
  return sanitizeObject(details, 0);
}

function sanitizeObject(value: Record<string, unknown>, depth: number): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[-_\s]/g, "");
    if (PRIVATE_DETAIL_KEYS.has(normalized)) continue;
    safe[key] = sanitizeValue(item, depth + 1);
  }
  return safe;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  // Deep or malicious JSON should not cause recursive worker failures.
  if (depth >= 12) return null;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, depth + 1));
  if (value !== null && typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>, depth);
  }
  return value;
}
