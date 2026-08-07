import { authenticate, type AuthEnv } from "./auth";
import { logSecurityEvent } from "./security-observability";

export interface AdminSecurityEnv extends AuthEnv {
  ADMIN_SECURITY_ENFORCEMENT?: string;
  ADMIN_MAX_AUTH_AGE_SECONDS?: string;
}

type TokenPosture = {
  authTime: number | null;
  secondFactor: string | null;
};

const STAFF_ROLES = new Set(["moderator", "admin", "owner"]);
const DEFAULT_MAX_AUTH_AGE_SECONDS = 30 * 60;
const MIN_MAX_AUTH_AGE_SECONDS = 5 * 60;
const MAX_MAX_AUTH_AGE_SECONDS = 12 * 60 * 60;

export async function enforceAdminSecurityPerimeter(
  request: Request,
  env: AdminSecurityEnv,
  requestId: string,
  normalizedPath: string,
): Promise<Response | null> {
  if (!/^\/v1\/admin(?:\/|$)/.test(normalizedPath)) return null;

  const auth = await authenticate(request, env);
  if (!auth) {
    await recordAdminSecurityEvent(
      request,
      env,
      requestId,
      normalizedPath,
      null,
      [],
      "admin_auth_required",
    );
    return denied("auth_required", "Authentication required.", 401, requestId);
  }

  const staffRoles = auth.roles.filter((role) => STAFF_ROLES.has(role));
  if (staffRoles.length === 0) {
    await recordAdminSecurityEvent(
      request,
      env,
      requestId,
      normalizedPath,
      auth.userId,
      auth.roles,
      "admin_role_denied",
    );
    return denied("permission_denied", "Administrative access required.", 403, requestId);
  }

  if (!isAdminSecurityEnforced(env)) return null;

  const posture = readVerifiedTokenPosture(request);
  if (!posture.secondFactor) {
    await recordAdminSecurityEvent(
      request,
      env,
      requestId,
      normalizedPath,
      auth.userId,
      staffRoles,
      "admin_mfa_required",
    );
    return denied(
      "admin_mfa_required",
      "Multi-factor authentication is required for administration.",
      403,
      requestId,
    );
  }

  const maxAgeSeconds = configuredMaxAuthAgeSeconds(env);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    posture.authTime === null ||
    posture.authTime > nowSeconds + 60 ||
    nowSeconds - posture.authTime > maxAgeSeconds
  ) {
    await recordAdminSecurityEvent(
      request,
      env,
      requestId,
      normalizedPath,
      auth.userId,
      staffRoles,
      "admin_recent_auth_required",
    );
    const response = denied(
      "admin_recent_auth_required",
      "Recent authentication is required for administration.",
      401,
      requestId,
    );
    response.headers.set("X-Rawaj-Reauthentication-Required", "true");
    return response;
  }

  return null;
}

export function isAdminSecurityEnforced(env: AdminSecurityEnv): boolean {
  return env.ADMIN_SECURITY_ENFORCEMENT?.trim().toLowerCase() === "enforce";
}

function configuredMaxAuthAgeSeconds(env: AdminSecurityEnv): number {
  const parsed = Number(env.ADMIN_MAX_AUTH_AGE_SECONDS ?? "");
  if (!Number.isInteger(parsed)) return DEFAULT_MAX_AUTH_AGE_SECONDS;
  return Math.min(MAX_MAX_AUTH_AGE_SECONDS, Math.max(MIN_MAX_AUTH_AGE_SECONDS, parsed));
}

function readVerifiedTokenPosture(request: Request): TokenPosture {
  const header = request.headers.get("Authorization") ?? "";
  const token = /^Bearer\s+([^\s]+)$/i.exec(header)?.[1];
  if (!token) return { authTime: null, secondFactor: null };

  const payloadSegment = token.split(".")[1];
  if (!payloadSegment) return { authTime: null, secondFactor: null };

  try {
    const payload = JSON.parse(decodeBase64Url(payloadSegment)) as Record<string, unknown>;
    const firebase =
      payload.firebase && typeof payload.firebase === "object" && !Array.isArray(payload.firebase)
        ? (payload.firebase as Record<string, unknown>)
        : null;
    return {
      authTime: typeof payload.auth_time === "number" ? payload.auth_time : null,
      secondFactor:
        typeof firebase?.sign_in_second_factor === "string" && firebase.sign_in_second_factor.trim()
          ? firebase.sign_in_second_factor.trim().slice(0, 80)
          : null,
    };
  } catch {
    return { authTime: null, secondFactor: null };
  }
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
}

async function recordAdminSecurityEvent(
  request: Request,
  env: AdminSecurityEnv,
  requestId: string,
  normalizedPath: string,
  actorId: string | null,
  roles: string[],
  action: string,
): Promise<void> {
  const status = action === "admin_auth_required" || action === "admin_recent_auth_required" ? 401 : 403;
  logSecurityEvent({
    event: action,
    severity: action === "admin_role_denied" ? "critical" : "warning",
    requestId,
    method: request.method,
    pathname: normalizedPath,
    status,
    reason: action,
  });

  try {
    const ip = request.headers.get("CF-Connecting-IP")?.trim() ?? "";
    const userAgent = request.headers.get("User-Agent")?.trim() ?? "";
    const metadata = JSON.stringify({
      requestId,
      method: request.method.toUpperCase(),
      path: normalizedPath.slice(0, 180),
      roles: roles.slice(0, 8),
    });
    const result = await env.DB.prepare(
      `INSERT INTO audit_logs
        (id, actor_id, action, entity_type, entity_id, metadata, ip_hash, user_agent_hash, created_at)
       VALUES (?, ?, ?, 'admin_security', NULL, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        actorId,
        action,
        metadata,
        ip ? await sha256Hex(ip) : null,
        userAgent ? await sha256Hex(userAgent) : null,
        new Date().toISOString(),
      )
      .run();
    if (!result.success) {
      logSecurityEvent({
        event: "admin_security_audit_write_failed",
        severity: "critical",
        requestId,
        method: request.method,
        pathname: normalizedPath,
        status: 500,
        reason: action,
      });
    }
  } catch {
    logSecurityEvent({
      event: "admin_security_audit_write_failed",
      severity: "critical",
      requestId,
      method: request.method,
      pathname: normalizedPath,
      status: 500,
      reason: action,
    });
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function denied(code: string, message: string, status: number, requestId: string): Response {
  return new Response(JSON.stringify({ error: { code, message, requestId } }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
