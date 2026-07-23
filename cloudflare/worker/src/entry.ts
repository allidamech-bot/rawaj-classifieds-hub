import baseWorker from "./index";
import { handlePublicListingsRequest, type PublicListingsEnv } from "./public-listings";
import { handleAuthRequest, type AuthEnv } from "./auth";
import { handleMarketplacePrivate, type MarketplaceEnv } from "./marketplace-private";

export default {
  async fetch(
    request: Request,
    env: PublicListingsEnv & AuthEnv & MarketplaceEnv,
  ): Promise<Response> {
    const url = new URL(request.url);
    const authResponse = await handleAuthRequest(request, env);
    if (authResponse) return authResponse;
    const marketplaceResponse = await handleMarketplacePrivate(request, env);
    if (marketplaceResponse) return marketplaceResponse;
    if (request.method === "GET" && url.pathname === "/v1/listings") {
      return handlePublicListingsRequest(request, env);
    }

    return baseWorker.fetch(request, env as never);
  },
};
