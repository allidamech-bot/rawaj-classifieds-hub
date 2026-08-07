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

  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    console.error(
      JSON.stringify({
        event: "turnstile_configuration_missing",
        requestId,
        pathname: new URL(request.url).pathname,
        expectedAction,
      }),
    );
    return errorResponse("turnstile_unavailable", "تعذر تشغيل التحقق الأمني حالياً.", 503);
  }

  const token = await readToken(request);
  if (!token) {
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
      console.warn(
        JSON.stringify({
          event: "turnstile_siteverify_http_error",
          requestId,
          status: response.status,
          expectedAction,
        }),
      );
      return errorResponse("turnstile_unavailable", "تعذر إكمال التحقق الأمني. حاول مجدداً.", 503);
    }

    const result = (await response.json().catch(() => null)) as SiteverifyResponse | null;
    const allowedHostnames = configuredHostnames(env);
    const hostnameAllowed =
      allowedHostnames.size === 0 || (!!result?.hostname && allowedHostnames.has(result.hostname));
    const actionAllowed = !result?.action || result.action === expectedAction;

    if (!result?.success || !hostnameAllowed || !actionAllowed) {
      console.warn(
        JSON.stringify({
          event: "turnstile_validation_failed",
          requestId,
          expectedAction,
          hostname: result?.hostname ?? null,
          action: result?.action ?? null,
          errorCodes: result?.["error-codes"] ?? [],
          hostnameAllowed,
          actionAllowed,
        }),
      );
      return errorResponse("turnstile_failed", "فشل التحقق الأمني. أعد المحاولة.", 403);
    }

    return null;
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "turnstile_siteverify_unavailable",
        requestId,
        expectedAction,
        errorName: error instanceof Error ? error.name : "UnknownError",
      }),
    );
    return errorResponse("turnstile_unavailable", "تعذر إكمال التحقق الأمني. حاول مجدداً.", 503);
  } finally {
    clearTimeout(timeout);
  }
}

async function readToken(request: Request): Promise<string | null> {
  const contentType = request.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) return null;
  const body = (await request.clone().json().catch(() => null)) as Record<string, unknown> | null;
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
