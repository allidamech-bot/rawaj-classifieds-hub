import { enforceAdminSecurityPerimeter, type AdminSecurityEnv } from "./admin-security";
import { inspectUploadedImage } from "./image-security";
import { logSecurityEvent } from "./security-observability";
import { handleSecuritySummary } from "./security-summary";
import { requireTurnstile, type TurnstileEnv } from "./turnstile";

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface SecurityEnv extends TurnstileEnv, AdminSecurityEnv {
  RATE_LIMIT_PUBLIC: RateLimitBinding;
  RATE_LIMIT_WRITE: RateLimitBinding;
  RATE_LIMIT_ABUSE: RateLimitBinding;
  RATE_LIMIT_UPLOAD: RateLimitBinding;
  RATE_LIMIT_ADMIN: RateLimitBinding;
}

type LimitClass = "public" | "write" | "abuse" | "upload" | "admin";

type LimitDecision = {
  className: LimitClass;
  binding: RateLimitBinding;
  scope: string;
};

const MAX_MARKETPLACE_IMAGE_REQUEST_BYTES = 9 * 1024 * 1024;
const MAX_MARKETPLACE_IMAGE_BYTES = 8 * 1024 * 1024;
const MARKETPLACE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function enforceRequestSecurity(
  request: Request,
  env: SecurityEnv,
  requestId: string,
): Promise<Response | null> {
  if (request.method === "OPTIONS") return null;

  const url = new URL(request.url);
  const path = normalizeApiPath(url.pathname);

  if (isMarketplaceImageUpload(path, request.method)) {
    const contentLength = readContentLength(request);
    if (contentLength !== null && contentLength > MAX_MARKETPLACE_IMAGE_REQUEST_BYTES) {
      logSecurityEvent({
        event: "upload_request_rejected",
        severity: "warning",
        requestId,
        method: request.method,
        pathname: path,
        status: 413,
        reason: "payload_too_large",
      });
      return securityJson(
        {
          error: {
            code: "payload_too_large",
            message: "Image upload request is too large.",
            requestId,
          },
        },
        413,
      );
    }
  }

  const decision = classifyRequest(path, request.method, env);
  const actor = await actorKey(request);
  const key = `${decision.className}:${decision.scope}:${actor}`;
  const { success } = await decision.binding.limit({ key });
  if (!success) {
    logSecurityEvent({
      event: "worker_rate_limited",
      severity: decision.className === "admin" ? "critical" : "warning",
      requestId,
      method: request.method,
      pathname: path,
      status: 429,
      reason: "rate_limit_exceeded",
      limitClass: decision.className,
    });

    const response = securityJson(
      {
        error: {
          code: "rate_limited",
          message: "Too many requests. Please try again shortly.",
          requestId,
        },
      },
      429,
    );
    response.headers.set("Retry-After", "60");
    return response;
  }

  if (isMarketplaceImageUpload(path, request.method)) {
    const imageResponse = await inspectMarketplaceImageRequest(request, requestId, path);
    if (imageResponse) return imageResponse;
  }

  const adminPerimeter = await enforceAdminSecurityPerimeter(request, env, requestId, path);
  if (adminPerimeter) return adminPerimeter;

  if (request.method === "GET" && path === "/v1/admin/security-summary") {
    return handleSecuritySummary(request, env, requestId);
  }

  const turnstileAction = protectedTurnstileAction(path, request.method);
  if (turnstileAction) {
    return requireTurnstile(request, env, requestId, turnstileAction);
  }

  return null;
}

async function inspectMarketplaceImageRequest(
  request: Request,
  requestId: string,
  path: string,
): Promise<Response | null> {
  const contentType = request.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data")) return null;

  const form = await request
    .clone()
    .formData()
    .catch(() => null);
  if (!form) {
    logSecurityEvent({
      event: "image_upload_rejected",
      severity: "warning",
      requestId,
      method: request.method,
      pathname: path,
      status: 400,
      reason: "invalid_multipart",
    });
    return securityJson(
      { error: { code: "invalid_upload", message: "Image upload request is invalid.", requestId } },
      400,
    );
  }

  const file = form.get("file");
  if (!(file instanceof File) || !MARKETPLACE_IMAGE_TYPES.has(file.type)) return null;
  if (file.size <= 0 || file.size > MAX_MARKETPLACE_IMAGE_BYTES) {
    logSecurityEvent({
      event: "image_upload_rejected",
      severity: "warning",
      requestId,
      method: request.method,
      pathname: path,
      status: 413,
      reason: "file_size_invalid",
    });
    return securityJson(
      { error: { code: "payload_too_large", message: "Image file is too large.", requestId } },
      413,
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspection = inspectUploadedImage(bytes, file.type);
  if (!inspection.ok) {
    logSecurityEvent({
      event: "image_upload_rejected",
      severity: "warning",
      requestId,
      method: request.method,
      pathname: path,
      status: 422,
      reason: inspection.reason,
    });
    return securityJson(
      {
        error: {
          code: "invalid_image_structure",
          message: "Image dimensions or structure are not supported.",
          requestId,
        },
      },
      422,
    );
  }

  if (inspection.data.hasPrivacyMetadata) {
    logSecurityEvent({
      event: "image_privacy_metadata_detected",
      severity: "info",
      requestId,
      method: request.method,
      pathname: path,
      status: 200,
      reason: "metadata_present",
    });
  }

  return null;
}

function classifyRequest(path: string, method: string, env: SecurityEnv): LimitDecision {
  const upperMethod = method.toUpperCase();

  if (/^\/v1\/admin(?:\/|$)/.test(path)) {
    return { className: "admin", binding: env.RATE_LIMIT_ADMIN, scope: normalizedScope(path) };
  }

  if (isMarketplaceImageUpload(path, upperMethod) || isChatAttachmentUpload(path, upperMethod)) {
    return { className: "upload", binding: env.RATE_LIMIT_UPLOAD, scope: normalizedScope(path) };
  }

  if (isAbuseProneMutation(path, upperMethod)) {
    return { className: "abuse", binding: env.RATE_LIMIT_ABUSE, scope: normalizedScope(path) };
  }

  if (!["GET", "HEAD"].includes(upperMethod)) {
    return { className: "write", binding: env.RATE_LIMIT_WRITE, scope: normalizedScope(path) };
  }

  return { className: "public", binding: env.RATE_LIMIT_PUBLIC, scope: normalizedScope(path) };
}

function protectedTurnstileAction(path: string, method: string): string | null {
  if (method.toUpperCase() !== "POST") return null;
  if (path === "/v1/account/support-requests") return "support_request";
  if (/^\/v1\/listings\/[^/]+\/reports$/.test(path)) return "listing_report";
  if (/^\/v1\/reviews\/[^/]+\/reports$/.test(path)) return "review_report";
  return null;
}

function isMarketplaceImageUpload(path: string, method: string): boolean {
  if (method.toUpperCase() !== "POST") return false;
  return path === "/v1/profile/media" || /^\/v1\/listings\/[^/]+\/images$/.test(path);
}

function isChatAttachmentUpload(path: string, method: string): boolean {
  return method.toUpperCase() === "POST" && /^\/v1\/conversations\/[^/]+\/attachments$/.test(path);
}

function isAbuseProneMutation(path: string, method: string): boolean {
  if (["GET", "HEAD"].includes(method.toUpperCase())) return false;
  return (
    /^\/v1\/conversations(?:\/|$)/.test(path) ||
    /^\/v1\/messages\/[^/]+\/report$/.test(path) ||
    /^\/v1\/listings\/[^/]+\/reports$/.test(path) ||
    /^\/v1\/reviews\/[^/]+\/(?:response|reports)$/.test(path) ||
    /^\/v1\/sellers\/[^/]+\/reviews$/.test(path) ||
    /^\/v1\/account\/support-requests(?:\/|$)/.test(path)
  );
}

function normalizeApiPath(pathname: string): string {
  return pathname.replace(/^\/api\b/, "/v1");
}

function normalizedScope(path: string): string {
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id")
    .replace(/\/[^/]{24,}(?=\/|$)/g, "/:id")
    .slice(0, 180);
}

async function actorKey(request: Request): Promise<string> {
  const authorization = request.headers.get("Authorization") ?? "";
  const bearer = /^Bearer\s+([^\s]+)$/i.exec(authorization)?.[1];
  if (bearer) {
    return `auth:${(await sha256Hex(bearer)).slice(0, 32)}`;
  }

  const ip = request.headers.get("CF-Connecting-IP")?.trim();
  if (ip) return `ip:${ip.slice(0, 64)}`;

  return "anonymous";
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readContentLength(request: Request): number | null {
  const raw = request.headers.get("Content-Length");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function securityJson(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
