export type MarketId = "SY" | "SA";
export type GatewayScope = "customer" | "admin";
export type DecisionSource = "explicit" | "stored" | "geo" | "fallback";

export interface MarketDefinition {
  id: MarketId;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  customerUrl: string;
  adminUrl: string;
}

export interface MarketDecision {
  market: MarketId;
  source: DecisionSource;
  mayAutoRedirect: boolean;
}

export const GATEWAY_HOSTS = {
  customer: "go.rawa-j.com",
  admin: "admin.rawa-j.com",
} as const;

export const GATEWAY_ORIGINS = {
  customer: `https://${GATEWAY_HOSTS.customer}`,
  admin: `https://${GATEWAY_HOSTS.admin}`,
} as const;

export const MARKET_DIRECTORY: Readonly<Record<MarketId, MarketDefinition>> = {
  SY: {
    id: "SY",
    nameAr: "سوريا",
    nameEn: "Syria",
    descriptionAr: "الإعلانات والمدن والحسابات الخاصة برواج سوريا",
    descriptionEn: "Listings, cities, and accounts for RAWAJ Syria",
    customerUrl: "https://rawa-j.com/",
    adminUrl: "https://rawa-j.com/admin",
  },
  SA: {
    id: "SA",
    nameAr: "السعودية",
    nameEn: "Saudi Arabia",
    descriptionAr: "الإعلانات والمناطق والحسابات الخاصة برواج السعودية",
    descriptionEn: "Listings, regions, and accounts for RAWAJ Saudi Arabia",
    customerUrl: "https://sa.rawa-j.com/",
    adminUrl: "https://sa.rawa-j.com/admin",
  },
} as const;

export const MARKET_IDS = Object.freeze(
  Object.keys(MARKET_DIRECTORY) as MarketId[],
);

const CUSTOMER_COOKIE = "rawaj.preferredMarket.v1";
const ADMIN_COOKIE = "rawaj.preferredAdminMarket.v1";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function normalizeMarketId(value: unknown): MarketId | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return normalized === "SY" || normalized === "SA" ? normalized : null;
}

export function normalizeScope(value: unknown): GatewayScope {
  return typeof value === "string" && value.trim().toLowerCase() === "admin"
    ? "admin"
    : "customer";
}

export function preferenceCookieName(scope: GatewayScope): string {
  return scope === "admin" ? ADMIN_COOKIE : CUSTOMER_COOKIE;
}

export function parseCookiePreference(
  cookieHeader: string,
  scope: GatewayScope,
): MarketId | null {
  const expectedName = preferenceCookieName(scope);
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name !== expectedName) continue;

    try {
      return normalizeMarketId(
        decodeURIComponent(part.slice(separator + 1).trim()),
      );
    } catch {
      return null;
    }
  }
  return null;
}

export function buildPreferenceCookie(
  market: MarketId,
  scope: GatewayScope,
): string {
  return [
    `${preferenceCookieName(scope)}=${market}`,
    "Path=/",
    "Domain=.rawa-j.com",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    "Secure",
  ].join("; ");
}

export function marketFromCountry(country: unknown): MarketId | null {
  if (typeof country !== "string") return null;
  const normalized = country.trim().toUpperCase();
  if (normalized === "SA") return "SA";
  if (normalized === "SY") return "SY";
  return null;
}

export function resolveMarketDecision(input: {
  explicit?: unknown;
  stored?: unknown;
  country?: unknown;
  fallback?: MarketId;
}): MarketDecision {
  const explicit = normalizeMarketId(input.explicit);
  if (explicit)
    return { market: explicit, source: "explicit", mayAutoRedirect: true };

  const stored = normalizeMarketId(input.stored);
  if (stored)
    return { market: stored, source: "stored", mayAutoRedirect: true };

  const geo = marketFromCountry(input.country);
  if (geo) return { market: geo, source: "geo", mayAutoRedirect: false };

  return {
    market: input.fallback ?? "SA",
    source: "fallback",
    mayAutoRedirect: false,
  };
}

export function marketDestination(
  market: MarketId,
  scope: GatewayScope,
): string {
  const definition = MARKET_DIRECTORY[market];
  return scope === "admin" ? definition.adminUrl : definition.customerUrl;
}

export function isAllowedGatewayHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  const isVercelDeployment =
    normalized === "rawaj-market-gateway.vercel.app" ||
    (normalized.startsWith("rawaj-market-gateway-") &&
      normalized.endsWith(".vercel.app"));
  return (
    normalized === GATEWAY_HOSTS.customer ||
    normalized === GATEWAY_HOSTS.admin ||
    isVercelDeployment ||
    normalized === "gateway.local" ||
    normalized === "localhost" ||
    normalized === "127.0.0.1"
  );
}
