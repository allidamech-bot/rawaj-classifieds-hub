import { publicDataRuntimeConfig } from "@/lib/public-data/config";

export type LovableErrorMechanism =
  "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";

export type LovableErrorOptions = {
  mechanism?: LovableErrorMechanism;
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type LovableEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LovableErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: LovableEvents;
  }
}

const SECRET_QUERY_PARAMETER =
  /([?&](?:access_token|refresh_token|token|code|key|secret)=)[^&#\s]+/gi;
const BEARER_TOKEN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const EMAIL_ADDRESS = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

// The Worker provides the server-side log sink. Limit traffic before the edge limiter.
const MAX_CLIENT_REPORTS_PER_MINUTE = 3;
let reportWindowStartedAt = 0;
let reportWindowCount = 0;

const SAFE_ERROR_NAMES = new Set([
  "Error",
  "TypeError",
  "ReferenceError",
  "RangeError",
  "SyntaxError",
  "URIError",
  "EvalError",
  "AggregateError",
]);
const SAFE_ROUTE_GROUPS = new Set([
  "categories",
  "listings",
  "seller",
  "account",
  "chats",
  "admin",
  "auth",
  "login",
  "support",
]);
const SAFE_BOUNDARIES = new Set([
  "window_error",
  "unhandled_promise_rejection",
  "react_hydration_warning",
  "tanstack_root_error_component",
]);

function sendPrivacySafeClientError(
  error: unknown,
  context: Record<string, unknown>,
  options: LovableErrorOptions,
) {
  const baseUrl = publicDataRuntimeConfig.cloudflareApiBaseUrl;
  if (!baseUrl || typeof fetch !== "function") return;
  const timestamp = Date.now();
  if (timestamp - reportWindowStartedAt >= 60_000) {
    reportWindowStartedAt = timestamp;
    reportWindowCount = 0;
  }
  if (reportWindowCount >= MAX_CLIENT_REPORTS_PER_MINUTE) return;
  reportWindowCount += 1;

  const route = window.location.pathname.split("/").filter(Boolean)[0] ?? "";
  const boundary = context.boundary;
  const commit = buildCommit() ?? "";
  const name = error instanceof Error ? error.name : "NonErrorThrow";
  const payload = {
    v: 1,
    mechanism: options.mechanism ?? "manual",
    boundary: typeof boundary === "string" && SAFE_BOUNDARIES.has(boundary) ? boundary : "other",
    severity: options.severity ?? "error",
    routeGroup: route ? (SAFE_ROUTE_GROUPS.has(route) ? route : "other") : "home",
    buildCommit: /^[0-9a-f]{40}$/.test(commit) ? commit : "unknown",
    errorName: SAFE_ERROR_NAMES.has(name) ? name : "UnknownError",
  };

  // Never forward error messages, stack traces, cookies, auth headers,
  // user identifiers, query strings, or full URLs to this endpoint.
  try {
    void fetch(`${baseUrl}/v1/telemetry/client-errors`, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  } catch {
    // Monitoring failures must never affect user interactions.
  }
}

function redactText(value: string) {
  return value
    .replace(SECRET_QUERY_PARAMETER, "$1[redacted]")
    .replace(BEARER_TOKEN, "Bearer [redacted]")
    .replace(EMAIL_ADDRESS, "[redacted-email]");
}

function sanitizeError(error: unknown) {
  if (error instanceof Error) {
    const sanitized = new Error(redactText(error.message));
    sanitized.name = error.name;
    if (error.stack) sanitized.stack = redactText(error.stack);
    return sanitized;
  }

  return new Error(redactText(typeof error === "string" ? error : "Unknown client error"));
}

function buildCommit() {
  return document
    .querySelector('meta[name="rawaj-build-commit"]')
    ?.getAttribute("content")
    ?.slice(0, 40);
}

export function reportLovableError(
  error: unknown,
  context: Record<string, unknown> = {},
  options: LovableErrorOptions = {},
) {
  if (typeof window === "undefined") return;

  const mechanism = options.mechanism ?? "manual";
  try {
    window.__lovableEvents?.captureException?.(
      sanitizeError(error),
      {
        source: mechanism,
        route: window.location.pathname,
        buildCommit: buildCommit() ?? "unknown",
        ...context,
      },
      {
        mechanism,
        handled: options.handled ?? mechanism === "manual",
        severity: options.severity ?? "error",
      },
    );
  } catch {
    // A third-party reporter must not prevent our independent delivery path.
  }
  sendPrivacySafeClientError(error, context, { ...options, mechanism });
}
