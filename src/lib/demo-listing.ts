import type { ClassifiedListing } from "@/lib/classifieds-types";

export const RAWAJ_DEMO_BATCH = "launch-catalog-v1";

export function isLaunchDemoListing(listing: Pick<ClassifiedListing, "id" | "details">): boolean {
  const marker = listing.details?._rawaj_seed;
  if (!marker || typeof marker !== "object" || Array.isArray(marker)) return false;

  const seed = marker as Record<string, unknown>;
  return (
    listing.id.startsWith("da100001-") &&
    seed.batch === RAWAJ_DEMO_BATCH &&
    seed.kind === "launch_demo" &&
    seed.removable === true
  );
}
