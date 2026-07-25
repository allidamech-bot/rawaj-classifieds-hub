import baseWorker from "./index";
import { handlePublicListingsRequest, type PublicListingsEnv } from "./public-listings";
import type { AuthEnv } from "./auth";
import { handleMarketplacePrivate, type MarketplaceEnv } from "./marketplace-private";
import { handleAccountSocial, type AccountSocialEnv } from "./account-social";
import { handleAdmin, type AdminEnv } from "./admin";
import { handleAdPlacements, type AdPlacementsEnv } from "./ad-placements";

export default {
  async fetch(
    request: Request,
    env: PublicListingsEnv &
      AuthEnv &
      MarketplaceEnv &
      AccountSocialEnv &
      AdminEnv &
      AdPlacementsEnv,
  ): Promise<Response> {
    const url = new URL(request.url);
    const adPlacementResponse = await handleAdPlacements(request, env);
    if (adPlacementResponse) return adPlacementResponse;
    const adminResponse = await handleAdmin(request, env);
    if (adminResponse) return adminResponse;
    const socialResponse = await handleAccountSocial(request, env);
    if (socialResponse) return socialResponse;
    const marketplaceResponse = await handleMarketplacePrivate(request, env);
    if (marketplaceResponse) return marketplaceResponse;
    if (request.method === "GET" && url.pathname === "/v1/listings") {
      return handlePublicListingsRequest(request, env);
    }

    return baseWorker.fetch(request, env as never);
  },
};