import handler from "@tanstack/react-start/server-entry";

import { rawajBuildInfo } from "./lib/build-info";

type WorkerFetcher = {
  fetch(request: Request): Promise<Response>;
};

type SaudiCloudflareEnv = {
  ASSETS?: WorkerFetcher;
  SAUDI_API?: WorkerFetcher;
};

const saudiApiOrigin = "https://rawaj-saudi-classifieds.allidamech.workers.dev";

function isApiPath(pathname: string): boolean {
  return pathname === "/v1" || pathname.startsWith("/v1/");
}

function isStaticAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/assets/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.[a-zA-Z0-9]{2,8}$/.test(pathname)
  );
}

async function proxySaudiApi(
  request: Request,
  env: SaudiCloudflareEnv,
): Promise<Response> {
  const incomingUrl = new URL(request.url);
  const serviceBinding = env.SAUDI_API;
  const targetOrigin = serviceBinding
    ? "https://sa.rawa-j.com"
    : saudiApiOrigin;
  const targetUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, targetOrigin);
  const headers = new Headers(request.headers);

  for (const name of [
    "host",
    "origin",
    "referer",
    "cf-connecting-ip",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-proto",
    "x-real-ip",
  ]) {
    headers.delete(name);
  }
  headers.set("x-rawaj-proxy-market", "saudi");

  const proxiedRequest = new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });

  return serviceBinding ? serviceBinding.fetch(proxiedRequest) : fetch(proxiedRequest);
}

function applyProductionHeaders(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  const url = new URL(request.url);

  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-frame-options", "DENY");
  headers.set("cross-origin-opener-policy", "same-origin-allow-popups");
  headers.set("x-rawaj-build-commit", rawajBuildInfo.commitSha);
  headers.set("x-rawaj-build-environment", rawajBuildInfo.environment);

  if (url.protocol === "https:") {
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains; preload");
  }

  if (["/login", "/reset-password", "/auth/callback"].some((path) => url.pathname.startsWith(path))) {
    headers.set("cache-control", "no-store, max-age=0");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: SaudiCloudflareEnv): Promise<Response> {
    const url = new URL(request.url);

    if (isApiPath(url.pathname)) {
      return applyProductionHeaders(await proxySaudiApi(request, env), request);
    }

    if (isStaticAssetPath(url.pathname) && env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return applyProductionHeaders(assetResponse, request);
      }
    }

    // This import must remain static. TanStack's Vite plugin replaces the
    // server-entry module with the generated application handler at build time.
    const response = await handler.fetch(request);
    return applyProductionHeaders(response, request);
  },
};
