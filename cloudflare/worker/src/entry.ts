import baseWorker from "./index";
import {
  handlePublicListingsRequest,
  type PublicListingsEnv,
} from "./public-listings";

export default {
  async fetch(request: Request, env: PublicListingsEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/v1/listings") {
      return handlePublicListingsRequest(request, env);
    }

    return baseWorker.fetch(request, env as never);
  },
};
