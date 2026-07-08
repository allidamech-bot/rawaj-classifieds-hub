export type ListingExpiryOption = 30 | 60 | 90 | "never";

export function publicListingExpiryFilter(_now = new Date().toISOString()) {
  // Compatibility guard: public listing queries already require status = approved.
  // Avoid referencing expires_at here until the lifecycle migration is confirmed in production,
  // otherwise one missing column makes every public marketplace query fail.
  return "id.not.is.null";
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
