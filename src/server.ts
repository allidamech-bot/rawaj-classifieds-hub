import "./lib/error-capture";

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

function isSensitiveAuthPath(pathname: string) {
  return sensitiveAuthPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
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

function applySecurityHeaders(response: Response, request: Request): Response {
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
  if (response.status < 500) return applySecurityHeaders(response, request);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return applySecurityHeaders(response, request);

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return applySecurityHeaders(response, request);
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return applySecurityHeaders(
    new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
    request,
  );
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response, request);
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        request,
      );
    }
  },
};
