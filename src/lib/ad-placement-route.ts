import type { AdPlacementPage } from "@/lib/api/ad-placements";

export function resolveAdPlacementPage(pathname: string): AdPlacementPage | null {
  if (pathname === "/") return "home";
  if (pathname === "/listings" || pathname === "/listings/") return "search_results";
  if (pathname.startsWith("/listings/")) return "listing_detail";
  if (pathname === "/categories" || pathname === "/categories/") return "categories";
  if (pathname === "/offers" || pathname === "/offers/") return "offers";
  return null;
}
