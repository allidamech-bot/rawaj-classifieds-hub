import { corsHeadersForOrigin, type CorsEnv } from "./cors";

const PATH = "/v1/telemetry/client-errors";
const MAX_BODY_BYTES = 1_024;
const MECHANISMS = new Set(["manual", "onerror", "unhandledrejection", "react_error_boundary"]);
const BOUNDARIES = new Set([
  "window_error",
  "unhandled_promise_rejection",
  "react_hydration_warning",
  "tanstack_root_error_component",
  "other",
]);
const SEVERITIES = new Set(["error", "warning", "info"]);
const ROUTE_GROUPS = new Set([
  "home",
  "categories",
  "listings",
  "seller",
  "account",
  "chats",
  "admin",
  "auth",
  "login",
  "support",
  "other",
]);
const ERROR_NAMES = new Set([
  "Error",
  "TypeError",
  "ReferenceError",
  "RangeError",
  "SyntaxError",
  "URIError",
  "EvalError",
  "AggregateError",
  "NonErrorThrow",
  "UnknownError",
]);
const FIELDS = [
  "v",
  "mechanism",
  "boundary",
  "severity",
  "routeGroup",
  "buildCommit",
  "errorName",
] as const;

type Telemetry = {
  v: number;
  mechanism: string;
  boundary: string;
  severity: string;
  routeGroup: string;
  buildCommit: string;
  errorName: string;
};

function isTelemetry(value: unknown): value is Telemetry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== FIELDS.length) return false;
  if (Object.keys(record).some((field) => !FIELDS.includes(field as (typeof FIELDS)[number]))) {
    return false;
  }
  return (
    record.v === 1 &&
    typeof record.mechanism === "string" &&
    MECHANISMS.has(record.mechanism) &&
    typeof record.boundary === "string" &&
    BOUNDARIES.has(record.boundary) &&
    typeof record.severity === "string" &&
    SEVERITIES.has(record.severity) &&
    typeof record.routeGroup === "string" &&
    ROUTE_GROUPS.has(record.routeGroup) &&
    typeof record.errorName === "string" &&
    ERROR_NAMES.has(record.errorName) &&
    typeof record.buildCommit === "string" &&
    (record.buildCommit === "unknown" || /^[0-9a-f]{40}$/.test(record.buildCommit))
  );
}

async function readBoundedJson(request: Request): Promise<{ text: string } | { tooLarge: true }> {
  const reader = request.body?.getReader();
  if (!reader) return { text: "" };
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return { tooLarge: true };
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return { text };
  } finally {
    reader.releaseLock();
  }
}

function reject(status: number, code: string): Response {
  return new Response(JSON.stringify({ error: { code } }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * Strictly structured client error telemetry, routed through the existing
 * Cloudflare rate limiter and Worker log stream. Never accept messages,
 * stack traces, full URLs, headers, user IDs, or raw context fields.
 */
export async function handleClientErrorTelemetry(
  request: Request,
  env: CorsEnv,
  requestId: string,
): Promise<Response | null> {
  if (new URL(request.url).pathname !== PATH) return null;
  if (request.method !== "POST") return reject(405, "method_not_allowed");

  const origin = request.headers.get("Origin");
  if (!origin || corsHeadersForOrigin(origin, env).get("Access-Control-Allow-Origin") !== origin) {
    return reject(403, "origin_not_allowed");
  }
  if (request.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return reject(415, "unsupported_media_type");
  }
  const length = Number(request.headers.get("Content-Length"));
  if (request.headers.has("Content-Length") && (!Number.isFinite(length) || length > MAX_BODY_BYTES)) {
    return reject(413, "payload_too_large");
  }
  const body = await readBoundedJson(request);
  if ("tooLarge" in body) return reject(413, "payload_too_large");
  let payload: unknown;
  try {
    payload = JSON.parse(body.text);
  } catch {
    return reject(400, "invalid_telemetry");
  }
  if (!isTelemetry(payload)) return reject(400, "invalid_telemetry");

  // The event is actionable through the Cloudflare Worker log stream.
  // Never log arbitrary request text or request-supplied names beyond allowlisted enums.
  console.error(
    JSON.stringify({
      event: "client_runtime_error",
      requestId,
      mechanism: payload.mechanism,
      boundary: payload.boundary,
      severity: payload.severity,
      routeGroup: payload.routeGroup,
      buildCommit: payload.buildCommit,
      errorName: payload.errorName,
    }),
  );
  return new Response(null, { status: 202, headers: { "Cache-Control": "no-store" } });
}
