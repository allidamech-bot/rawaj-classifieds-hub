import "./lib/error-capture";

import { rawajBuildInfo } from "./lib/build-info";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

const sensitiveAuthPaths = ["/auth/callback", "/login", "/reset-password"];
const slowPublicRenderThresholdMs = 2_500;

function isSensitiveAuthPath(pathname: string) {
  return sensitiveAuthPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isPublicDocumentPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/categories" ||
    pathname === "/listings" ||
    pathname === "/offers" ||
    pathname === "/support" ||
    pathname === "/safety" ||
    pathname === "/prohibited" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/category/") ||
    pathname.startsWith("/syria/") ||
    pathname.startsWith("/listings/") ||
    pathname.startsWith("/seller/")
  );
}

function buildContentSecurityPolicy(isSecureRequest: boolean) {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co https://*.supabase.com wss://*.supabase.co wss://*.supabase.com https://fonts.googleapis.com https://fonts.gstatic.com https://vitals.vercel-insights.com https://*.vercel-insights.com",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ];
  if (isSecureRequest) directives.push("upgrade-insecure-requests");
  return `${directives.join("; ")};`;
}

function applyResponseHeaders(response: Response, request: Request, durationMs: number): Response {
  const headers = new Headers(response.headers);
  const url = new URL(request.url);
  const isSecureRequest = url.protocol === "https:";

  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "geolocation=(), microphone=(), camera=()");
  headers.set("x-frame-options", "DENY");
  headers.set("x-permitted-cross-domain-policies", "none");
  headers.set("cross-origin-opener-policy", "same-origin-allow-popups");
  headers.set("cross-origin-resource-policy", "same-site");
  headers.set("content-security-policy", buildContentSecurityPolicy(isSecureRequest));
  headers.set("server-timing", `rawaj;dur=${durationMs}`);
  headers.set("x-rawaj-build-commit", rawajBuildInfo.commitSha);
  headers.set("x-rawaj-build-environment", rawajBuildInfo.environment);

  if (isSecureRequest) {
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains; preload");
  }

  if (isSensitiveAuthPath(url.pathname)) {
    headers.set("cache-control", "no-store, max-age=0");
    headers.set("pragma", "no-cache");
    headers.set("expires", "0");
  }

  return new Response(response.body, { status: response.status, headers });
}

async function normalizeCatastrophicSsrResponse(
  response: Response,
  request: Request,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  logSsrFailure("catastrophic_ssr_response", request, consumeLastCapturedError());
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function logSsrFailure(event: string, request: Request, error: unknown, durationMs?: number) {
  const url = new URL(request.url);
  console.error(
    JSON.stringify({
      event,
      method: request.method,
      pathname: url.pathname,
      durationMs,
      buildCommit: rawajBuildInfo.commitSha,
      buildEnvironment: rawajBuildInfo.environment,
      error: safeErrorSummary(error),
    }),
  );
}

function logSlowPublicRender(request: Request, response: Response, durationMs: number) {
  const url = new URL(request.url);
  const contentType = response.headers.get("content-type") ?? "";
  if (
    request.method !== "GET" ||
    !isPublicDocumentPath(url.pathname) ||
    durationMs < slowPublicRenderThresholdMs
  ) {
    return;
  }

  console.warn(
    JSON.stringify({
      event: "slow_public_render",
      method: request.method,
      pathname: url.pathname,
      status: response.status,
      contentType: contentType.split(";", 1)[0],
      durationMs,
      buildCommit: rawajBuildInfo.commitSha,
      buildEnvironment: rawajBuildInfo.environment,
    }),
  );
}

function safeErrorSummary(error: unknown) {
  if (!error) return { name: "UnknownError" };
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: redactSensitiveText(error.message).slice(0, 320),
    };
  }
  return {
    name: "NonErrorThrow",
    message: redactSensitiveText(String(error)).slice(0, 320),
  };
}

function redactSensitiveText(value: string) {
  return value
    .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g, "[redacted-jwt]")
    .replace(/(?:token|apikey|api_key|authorization)=?\s*[^\s&]+/gi, "$1=[redacted]");
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const startedAt = Date.now();
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalizedResponse = await normalizeCatastrophicSsrResponse(response, request);
      const durationMs = Date.now() - startedAt;
      logSlowPublicRender(request, normalizedResponse, durationMs);
      return applyResponseHeaders(normalizedResponse, request, durationMs);
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      logSsrFailure("ssr_request_failed", request, error, durationMs);
      return applyResponseHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        request,
        durationMs,
      );
    }
  },
};
