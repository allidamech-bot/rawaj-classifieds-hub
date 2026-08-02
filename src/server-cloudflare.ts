import handler from "@tanstack/react-start/server-entry";

import { rawajBuildInfo } from "./lib/build-info";

type WorkerFetcher = {
  fetch(request: Request): Promise<Response>;
};

type SaudiCloudflareEnv = {
  ASSETS?: WorkerFetcher;
  SAUDI_API?: WorkerFetcher;
};

type NitroCloudflareRequest = Request & {
  runtime?: {
    cloudflare?: {
      env?: SaudiCloudflareEnv;
    };
  };
};

const saudiApiOrigin = "https://rawaj-saudi-classifieds.allidamech.workers.dev";

function runtimeEnv(request: Request, explicitEnv?: SaudiCloudflareEnv): SaudiCloudflareEnv {
  return explicitEnv ?? (request as NitroCloudflareRequest).runtime?.cloudflare?.env ?? {};
}

function isApiPath(pathname: string): boolean {
  return (
    pathname === "/v1" ||
    pathname.startsWith("/v1/") ||
    pathname === "/api" ||
    pathname.startsWith("/api/")
  );
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
  const targetUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, saudiApiOrigin);
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

  try {
    return serviceBinding
      ? await serviceBinding.fetch(proxiedRequest)
      : await fetch(proxiedRequest);
  } catch (error) {
    console.error(
      "SAUDI_API_BINDING_FAILURE",
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : String(error),
    );
    return new Response(
      JSON.stringify({
        error: {
          code: "gateway_unavailable",
          message: "Saudi marketplace data is temporarily unavailable.",
        },
      }),
      {
        status: 502,
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    );
  }
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
  async fetch(request: Request, explicitEnv?: SaudiCloudflareEnv): Promise<Response> {
    const url = new URL(request.url);
    const env = runtimeEnv(request, explicitEnv);

    if (isApiPath(url.pathname)) {
      return applyProductionHeaders(await proxySaudiApi(request, env), request);
    }

    if (isStaticAssetPath(url.pathname) && env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return applyProductionHeaders(assetResponse, request);
      }
    }

    // Nitro invokes this SSR service with the augmented Request only. Cloudflare
    // bindings are therefore read from request.runtime.cloudflare.env above.
    const response = await handler.fetch(request);
    return applyProductionHeaders(response, request);
  },
};
