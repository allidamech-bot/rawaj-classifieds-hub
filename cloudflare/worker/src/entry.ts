import baseWorker from "./index";
import { handlePublicListingsRequest, type PublicListingsEnv } from "./public-listings";
import { handleAuthRequest, type AuthEnv } from "./auth";
import { handleMarketplacePrivate, type MarketplaceEnv } from "./marketplace-private";
import { handleAccountSocial, type AccountSocialEnv } from "./account-social";

export default {
  async fetch(
    request: Request,
    env: PublicListingsEnv & AuthEnv & MarketplaceEnv & AccountSocialEnv,
  ): Promise<Response> {
    const url = new URL(request.url);
    const authResponse = await handleAuthRequest(request, env);
    if (authResponse) return authResponse;
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
