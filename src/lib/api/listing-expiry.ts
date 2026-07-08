export type ListingExpiryOption = 30 | 60 | 90 | "never";

export function publicListingExpiryFilter(now = new Date().toISOString()) {
  return `expires_at.is.null,expires_at.gt.${now}`;
}

export function resolveListingExpiryDate(option: ListingExpiryOption, now = new Date()) {
  if (option === "never") return null;
  return new Date(now.getTime() + option * 24 * 60 * 60 * 1000).toISOString();
}

export function isListingPastExpiry(expiresAt: string | null | undefined, now = Date.now()) {
  if (!expiresAt) return false;
  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) && timestamp <= now;
}
