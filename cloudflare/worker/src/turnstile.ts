import { logSecurityEvent } from "./security-observability";

export interface TurnstileEnv {
  TURNSTILE_ENFORCEMENT?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_ALLOWED_HOSTNAMES?: string;
}

type SiteverifyResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2048;
const VERIFY_TIMEOUT_MS = 8_000;

export function isTurnstileEnforced(env: TurnstileEnv): boolean {
  return env.TURNSTILE_ENFORCEMENT?.trim().toLowerCase() === "enforce";
}

export async function requireTurnstile(
  request: Request,
  env: TurnstileEnv,
  requestId: string,
  expectedAction: string,
): Promise<Response | null> {
  if (!isTurnstileEnforced(env)) return null;

  const pathname = new URL(request.url).pathname;
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  const allowedHostnames = configuredHostnames(env);
  if (!secret || allowedHostnames.size === 0) {
    logSecurityEvent({
      event: "turnstile_configuration_missing",
      severity: "critical",
      requestId,
      method: request.method,
      pathname,
      status: 503,
      reason: !secret ? "secret_missing" : "hostname_allowlist_missing",
      action: expectedAction,
    });
    return errorResponse("turnstile_unavailable", "تعذر تشغيل التحقق الأمني حالياً.", 503);
  }

  const token = await readToken(request);
  if (!token) {
    logSecurityEvent({
      event: "turnstile_token_required",
      severity: "warning",
      requestId,
      method: request.method,
      pathname,
      status: 403,
      reason: "token_missing_or_invalid",
      action: expectedAction,
    });
    return errorResponse("turnstile_required", "أكمل التحقق الأمني ثم حاول مرة أخرى.", 403);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: request.headers.get("CF-Connecting-IP")?.trim() || undefined,
        idempotency_key: crypto.randomUUID(),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      logSecurityEvent({
        event: "turnstile_siteverify_http_error",
        severity: "critical",
        requestId,
        method: request.method,
        pathname,
        status: response.status,
        reason: "siteverify_http_error",
        action: expectedAction,
      });
      return errorResponse("turnstile_unavailable", "تعذر إكمال التحقق الأمني. حاول مجدداً.", 503);
    }

    const result = (await response.json().catch(() => null)) as SiteverifyResponse | null;
    const hostname = result?.hostname?.trim().toLowerCase() ?? "";
    const hostnameAllowed = Boolean(hostname) && allowedHostnames.has(hostname);
    const actionAllowed = result?.action === expectedAction;

    if (!result?.success || !hostnameAllowed || !actionAllowed) {
      const reason = !result?.success
        ? "siteverify_rejected"
        : !hostnameAllowed
          ? "hostname_mismatch"
          : "action_mismatch";
      logSecurityEvent({
        event: "turnstile_validation_failed",
        severity: "warning",
        requestId,
        method: request.method,
        pathname,
        status: 403,
        reason,
        action: expectedAction,
      });
      return errorResponse("turnstile_failed", "فشل التحقق الأمني. أعد المحاولة.", 403);
    }

    return null;
  } catch (error) {
    logSecurityEvent({
      event: "turnstile_siteverify_unavailable",
      severity: "critical",
      requestId,
      method: request.method,
      pathname,
      status: 503,
      reason: error instanceof Error ? error.name : "UnknownError",
      action: expectedAction,
    });
    return errorResponse("turnstile_unavailable", "تعذر إكمال التحقق الأمني. حاول مجدداً.", 503);
  } finally {
    clearTimeout(timeout);
  }
}

async function readToken(request: Request): Promise<string | null> {
  const contentType = request.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) return null;
  const body = (await request
    .clone()
    .json()
    .catch(() => null)) as Record<string, unknown> | null;
  const token = typeof body?.turnstileToken === "string" ? body.turnstileToken.trim() : "";
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  return token;
}

function configuredHostnames(env: TurnstileEnv): Set<string> {
  return new Set(
    (env.TURNSTILE_ALLOWED_HOSTNAMES ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function errorResponse(code: string, message: string, status: number): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
