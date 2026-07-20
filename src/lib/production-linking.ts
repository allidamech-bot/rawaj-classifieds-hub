export const RAWAJ_PRODUCTION_ORIGIN = "https://rawa-j.com";
export const RAWAJ_PRODUCTION_HOST = "rawa-j.com";
export const RAWAJ_AUTH_CALLBACK_PATH = "/auth/callback";
export const RAWAJ_ANDROID_PACKAGE_NAME = "com.rawaj.marketplace";
export const RAWAJ_ANDROID_APP_LINK_RELATION = "delegate_permission/common.handle_all_urls";
export const RAWAJ_ANDROID_FINGERPRINT_ENV_NAME = "RAWAJ_ANDROID_SHA256_CERT_FINGERPRINTS";

const COLONIZED_SHA256_PATTERN = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const COMPACT_SHA256_PATTERN = /^[0-9A-F]{64}$/;

export interface AndroidAssetLinksStatement {
  relation: string[];
  target: {
    namespace: "android_app";
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}

export function parseAndroidSha256Fingerprints(value: unknown): string[] {
  if (typeof value !== "string") return [];

  const normalized = value
    .split(/[\s,;]+/)
    .map((entry) => normalizeAndroidSha256Fingerprint(entry))
    .filter((entry): entry is string => entry !== null);

  return [...new Set(normalized)];
}

export function buildAndroidAssetLinksStatements(
  fingerprints: string[],
): AndroidAssetLinksStatement[] {
  if (fingerprints.length === 0) return [];

  return [
    {
      relation: [RAWAJ_ANDROID_APP_LINK_RELATION],
      target: {
        namespace: "android_app",
        package_name: RAWAJ_ANDROID_PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

function normalizeAndroidSha256Fingerprint(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  if (COLONIZED_SHA256_PATTERN.test(normalized)) return normalized;
  if (!COMPACT_SHA256_PATTERN.test(normalized)) return null;

  return normalized.match(/.{2}/g)?.join(":") ?? null;
}
